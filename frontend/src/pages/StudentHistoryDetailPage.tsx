import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { StudyRecordApiError, historyApi } from '../api/practiceHistoryApi'
import type { StudyRecordDetail } from '../api/practiceHistoryApi'
import { QUESTION_LEVEL_LABELS } from '../api/questionTypes'
import { useAuth } from '../auth/useAuth'
import StudentLayout from '../components/StudentLayout'
import Button from '../components/Button'
import './StudentHistoryDetailPage.css'

const GENERIC_ERROR_MESSAGE = '학습 기록을 불러오지 못했습니다. 잠시 후 다시 시도해주세요.'
const NOT_FOUND_MESSAGE = '학습 기록을 찾을 수 없습니다.'
const FORBIDDEN_MESSAGE = '학습 기록을 조회할 권한이 없습니다. 학생 계정으로 로그인했는지 확인해주세요.'
const SESSION_EXPIRED_MESSAGE = '세션이 만료되었습니다. 다시 로그인해주세요.'
const INVALID_ID_MESSAGE = '잘못된 학습 기록 번호입니다.'

type ErrorKind = 'expired' | 'forbidden' | 'not-found' | 'generic'

type QueryParams = { recordId: number; retryToken: number }

type FetchResult =
  | { params: QueryParams; status: 'success'; record: StudyRecordDetail }
  | { params: QueryParams; status: 'error'; message: string; kind: ErrorKind }

// Route params are always strings; only positive integers are valid record IDs.
function parseRecordId(raw: string | undefined): number | null {
  if (!raw || !/^\d+$/.test(raw)) {
    return null
  }
  const id = Number(raw)
  return Number.isSafeInteger(id) && id > 0 ? id : null
}

function StudentHistoryDetailPage() {
  const { id: rawId } = useParams<{ id: string }>()
  const { session, logout } = useAuth()
  const navigate = useNavigate()

  const recordId = parseRecordId(rawId)

  const [retryToken, setRetryToken] = useState(0)
  const [result, setResult] = useState<FetchResult | null>(null)

  const accessToken = session?.accessToken

  useEffect(() => {
    if (!accessToken || recordId === null) {
      return
    }

    const params: QueryParams = { recordId, retryToken }
    let cancelled = false

    historyApi
      .getRecord(accessToken, recordId)
      .then((record) => {
        if (cancelled) {
          return
        }
        setResult({ params, status: 'success', record })
      })
      .catch((error: unknown) => {
        if (cancelled) {
          return
        }
        if (error instanceof StudyRecordApiError && error.status === 401) {
          setResult({ params, status: 'error', message: SESSION_EXPIRED_MESSAGE, kind: 'expired' })
        } else if (error instanceof StudyRecordApiError && error.status === 403) {
          setResult({ params, status: 'error', message: FORBIDDEN_MESSAGE, kind: 'forbidden' })
        } else if (error instanceof StudyRecordApiError && error.status === 404) {
          setResult({ params, status: 'error', message: NOT_FOUND_MESSAGE, kind: 'not-found' })
        } else if (error instanceof StudyRecordApiError) {
          setResult({ params, status: 'error', message: error.message, kind: 'generic' })
        } else {
          setResult({ params, status: 'error', message: GENERIC_ERROR_MESSAGE, kind: 'generic' })
        }
      })

    return () => {
      cancelled = true
    }
  }, [accessToken, recordId, retryToken])

  function handleReSignIn() {
    logout()
    navigate('/login', { replace: true })
  }

  function handleRetry() {
    setRetryToken((current) => current + 1)
  }

  if (recordId === null) {
    return (
      <StudentLayout active="history">
        <div className="history-detail-page">
          <div className="history-detail-error" role="alert">
            <p>{INVALID_ID_MESSAGE}</p>
            <Link className="history-detail-back-link" to="/student/history">
              목록으로 돌아가기
            </Link>
          </div>
        </div>
      </StudentLayout>
    )
  }

  const isCurrent =
    result !== null && result.params.recordId === recordId && result.params.retryToken === retryToken
  const isLoading = !isCurrent
  const currentResult = isCurrent ? result : null

  return (
    <StudentLayout active="history">
      <div className="history-detail-page">
        <header className="history-detail-header">
          <h1>학습 기록 상세</h1>
          <Link className="history-detail-back-link" to="/student/history">
            목록으로 돌아가기
          </Link>
        </header>

        {isLoading && (
          <p className="history-detail-status" role="status">
            불러오는 중...
          </p>
        )}

        {currentResult?.status === 'error' && (
          <div className="history-detail-error" role="alert">
            <p>{currentResult.message}</p>
            {currentResult.kind === 'expired' && (
              <Button type="button" onClick={handleReSignIn}>
                다시 로그인
              </Button>
            )}
            {currentResult.kind === 'generic' && (
              <Button type="button" onClick={handleRetry}>
                다시 시도
              </Button>
            )}
          </div>
        )}

        {currentResult?.status === 'success' && (
          <div className="history-detail-card">
            <dl className="history-detail-meta">
              <div>
                <dt>카테고리</dt>
                <dd>{currentResult.record.question.category}</dd>
              </div>
              <div>
                <dt>난이도</dt>
                <dd>{QUESTION_LEVEL_LABELS[currentResult.record.question.level]}</dd>
              </div>
              <div>
                <dt>결과</dt>
                <dd>
                  <span
                    className={`history-detail-result-badge history-detail-result-${
                      currentResult.record.correct ? 'correct' : 'incorrect'
                    }`}
                  >
                    {currentResult.record.correct ? '정답' : '오답'}
                  </span>
                </dd>
              </div>
              <div>
                <dt>제출한 답안</dt>
                <dd>{currentResult.record.submittedAnswer}</dd>
              </div>
              <div>
                <dt>정답</dt>
                <dd>{currentResult.record.question.correctAnswer}</dd>
              </div>
              <div>
                <dt>제출 시각</dt>
                <dd>{currentResult.record.submittedAt}</dd>
              </div>
            </dl>

            <section className="history-detail-section">
              <h2>문제 내용</h2>
              <p>{currentResult.record.question.text}</p>
            </section>

            <section className="history-detail-section">
              <h2>보기</h2>
              <ul className="history-detail-choices" aria-label="보기">
                {currentResult.record.question.choices.map((choice, index) => {
                  const isCorrectChoice = choice === currentResult.record.question.correctAnswer
                  const isSubmittedChoice = choice === currentResult.record.submittedAnswer
                  const className = [
                    'history-detail-choice',
                    isCorrectChoice ? 'history-detail-choice-correct' : '',
                    isSubmittedChoice && !isCorrectChoice ? 'history-detail-choice-submitted' : '',
                  ]
                    .filter(Boolean)
                    .join(' ')

                  return (
                    <li key={index} className={className}>
                      <span>{choice}</span>
                      <span className="history-detail-choice-badges">
                        {isCorrectChoice && (
                          <span className="history-detail-choice-badge history-detail-choice-badge-correct">
                            정답
                          </span>
                        )}
                        {isSubmittedChoice && (
                          <span className="history-detail-choice-badge history-detail-choice-badge-submitted">
                            내 답안
                          </span>
                        )}
                      </span>
                    </li>
                  )
                })}
              </ul>
            </section>

            <section className="history-detail-section">
              <h2>해설</h2>
              <p>{currentResult.record.question.explanation}</p>
            </section>
          </div>
        )}
      </div>
    </StudentLayout>
  )
}

export default StudentHistoryDetailPage
