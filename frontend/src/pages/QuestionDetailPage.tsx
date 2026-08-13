import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { QuestionApiError, questionApi } from '../api/questionApi'
import { QUESTION_LEVEL_LABELS, QUESTION_STATUS_LABELS, QUESTION_TYPE_LABELS } from '../api/questionTypes'
import type { QuestionDetail } from '../api/questionTypes'
import { useAuth } from '../auth/useAuth'
import AdminLayout from '../components/AdminLayout'
import Button from '../components/Button'
import './QuestionDetailPage.css'

const GENERIC_ERROR_MESSAGE = '문제 정보를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.'
const NOT_FOUND_MESSAGE = '문제를 찾을 수 없습니다.'
const FORBIDDEN_MESSAGE = '문제를 조회할 권한이 없습니다. 관리자 계정으로 로그인했는지 확인해주세요.'
const SESSION_EXPIRED_MESSAGE = '세션이 만료되었습니다. 다시 로그인해주세요.'
const INVALID_ID_MESSAGE = '잘못된 문제 번호입니다.'

type ErrorKind = 'expired' | 'forbidden' | 'not-found' | 'generic'

type QueryParams = { questionId: number; retryToken: number }

type FetchResult =
  | { params: QueryParams; status: 'success'; question: QuestionDetail }
  | { params: QueryParams; status: 'error'; message: string; kind: ErrorKind }

// Route params are always strings; only positive integers are valid question IDs.
function parseQuestionId(raw: string | undefined): number | null {
  if (!raw || !/^\d+$/.test(raw)) {
    return null
  }
  const id = Number(raw)
  return Number.isSafeInteger(id) && id > 0 ? id : null
}

function QuestionDetailPage() {
  const { id: rawId } = useParams<{ id: string }>()
  const { session, logout } = useAuth()
  const navigate = useNavigate()

  const questionId = parseQuestionId(rawId)

  const [retryToken, setRetryToken] = useState(0)
  const [result, setResult] = useState<FetchResult | null>(null)

  const accessToken = session?.accessToken

  useEffect(() => {
    if (!accessToken || questionId === null) {
      return
    }

    const params: QueryParams = { questionId, retryToken }
    let cancelled = false

    questionApi
      .getQuestion(accessToken, questionId)
      .then((question) => {
        if (cancelled) {
          return
        }
        setResult({ params, status: 'success', question })
      })
      .catch((error: unknown) => {
        if (cancelled) {
          return
        }
        if (error instanceof QuestionApiError && error.status === 401) {
          setResult({ params, status: 'error', message: SESSION_EXPIRED_MESSAGE, kind: 'expired' })
        } else if (error instanceof QuestionApiError && error.status === 403) {
          setResult({ params, status: 'error', message: FORBIDDEN_MESSAGE, kind: 'forbidden' })
        } else if (error instanceof QuestionApiError && error.status === 404) {
          setResult({ params, status: 'error', message: NOT_FOUND_MESSAGE, kind: 'not-found' })
        } else if (error instanceof QuestionApiError) {
          setResult({ params, status: 'error', message: error.message, kind: 'generic' })
        } else {
          setResult({ params, status: 'error', message: GENERIC_ERROR_MESSAGE, kind: 'generic' })
        }
      })

    return () => {
      cancelled = true
    }
  }, [accessToken, questionId, retryToken])

  function handleReSignIn() {
    logout()
    navigate('/login', { replace: true })
  }

  function handleRetry() {
    setRetryToken((current) => current + 1)
  }

  if (questionId === null) {
    return (
      <AdminLayout active="questions">
        <div className="question-detail-page">
          <div className="question-detail-error" role="alert">
            <p>{INVALID_ID_MESSAGE}</p>
            <Link className="question-detail-back-link" to="/admin/questions">
              목록으로 돌아가기
            </Link>
          </div>
        </div>
      </AdminLayout>
    )
  }

  const isCurrent =
    result !== null && result.params.questionId === questionId && result.params.retryToken === retryToken
  const isLoading = !isCurrent
  const currentResult = isCurrent ? result : null

  return (
    <AdminLayout active="questions">
      <div className="question-detail-page">
        <header className="question-detail-header">
          <h1>문제 상세</h1>
          <Link className="question-detail-back-link" to="/admin/questions">
            목록으로 돌아가기
          </Link>
        </header>

        {isLoading && (
          <p className="question-detail-status" role="status">
            불러오는 중...
          </p>
        )}

        {currentResult?.status === 'error' && (
          <div className="question-detail-error" role="alert">
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
          <div className="question-detail-card">
            <dl className="question-detail-meta">
              <div>
                <dt>ID</dt>
                <dd>{currentResult.question.id}</dd>
              </div>
              <div>
                <dt>카테고리</dt>
                <dd>{currentResult.question.category}</dd>
              </div>
              <div>
                <dt>유형</dt>
                <dd>{QUESTION_TYPE_LABELS[currentResult.question.type]}</dd>
              </div>
              <div>
                <dt>난이도</dt>
                <dd>{QUESTION_LEVEL_LABELS[currentResult.question.level]}</dd>
              </div>
              <div>
                <dt>상태</dt>
                <dd>
                  <span
                    className={`question-detail-status-badge question-detail-status-${currentResult.question.status.toLowerCase()}`}
                  >
                    {QUESTION_STATUS_LABELS[currentResult.question.status]}
                  </span>
                </dd>
              </div>
              <div>
                <dt>등록일</dt>
                <dd>{currentResult.question.createdAt}</dd>
              </div>
            </dl>

            <section className="question-detail-section">
              <h2>문제 내용</h2>
              <p>{currentResult.question.text}</p>
            </section>

            <section className="question-detail-section">
              <h2>보기</h2>
              <ul className="question-detail-choices">
                {currentResult.question.choices.map((choice, index) => {
                  const isAnswer = choice === currentResult.question.answer
                  return (
                    <li
                      key={index}
                      className={
                        isAnswer ? 'question-detail-choice question-detail-choice-answer' : 'question-detail-choice'
                      }
                    >
                      <span>{choice}</span>
                      {isAnswer && <span className="question-detail-answer-badge">정답</span>}
                    </li>
                  )
                })}
              </ul>
            </section>

            <section className="question-detail-section">
              <h2>해설</h2>
              <p>{currentResult.question.explanation}</p>
            </section>
          </div>
        )}
      </div>
    </AdminLayout>
  )
}

export default QuestionDetailPage
