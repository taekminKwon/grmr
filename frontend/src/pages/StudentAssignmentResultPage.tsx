import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { MyAssignmentApiError, myAssignmentApi } from '../api/myAssignmentApi'
import type { AssignmentResult } from '../api/myAssignmentApi'
import { useAuth } from '../auth/useAuth'
import StudentLayout from '../components/StudentLayout'
import Button from '../components/Button'
import { formatKoreanDateTime } from '../utils/formatDateTime'
import './StudentAssignmentResultPage.css'

const GENERIC_ERROR_MESSAGE = '결과를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.'
const NOT_FOUND_MESSAGE = '과제를 찾을 수 없습니다.'
const SESSION_EXPIRED_MESSAGE = '세션이 만료되었습니다. 다시 로그인해주세요.'
const FORBIDDEN_MESSAGE = '결과를 조회할 권한이 없습니다. 학생 계정으로 로그인했는지 확인해주세요.'
const NOT_SUBMITTED_MESSAGE = '아직 제출하지 않은 과제입니다.'
const INVALID_ID_MESSAGE = '잘못된 과제 번호입니다.'

type ErrorKind = 'expired' | 'forbidden' | 'not-found' | 'not-submitted' | 'generic'

// Route params are always strings; only positive integers are valid assignment IDs.
function parseAssignmentId(raw: string | undefined): number | null {
  if (!raw || !/^\d+$/.test(raw)) {
    return null
  }
  const id = Number(raw)
  return Number.isSafeInteger(id) && id > 0 ? id : null
}

type QueryParams = { assignmentId: number; retryToken: number }

type FetchResult =
  | { params: QueryParams; status: 'success'; result: AssignmentResult }
  | { params: QueryParams; status: 'error'; kind: ErrorKind; message: string }

function StudentAssignmentResultPage() {
  const { id: rawId } = useParams<{ id: string }>()
  const location = useLocation()
  const { session, logout } = useAuth()
  const navigate = useNavigate()

  const assignmentId = parseAssignmentId(rawId)

  const [retryToken, setRetryToken] = useState(0)
  const [result, setResult] = useState<FetchResult | null>(null)

  // Optional immediate-display hint carried in navigation state from the
  // submit flow. Captured once at mount (not re-derived on retry) and shown
  // only until the fetch below resolves — the fetch is always issued and its
  // response is the only value ever treated as confirmed, so this hint can
  // never leak a stale or forged result past the real server answer.
  const [navigationHint] = useState<AssignmentResult | null>(() => {
    const state = location.state as { result?: AssignmentResult } | null
    if (state?.result && assignmentId !== null && state.result.assignmentId === assignmentId) {
      return state.result
    }
    return null
  })

  const accessToken = session?.accessToken

  useEffect(() => {
    if (!accessToken || assignmentId === null) {
      return
    }

    const params: QueryParams = { assignmentId, retryToken }
    let cancelled = false

    myAssignmentApi
      .getAssignmentResult(accessToken, assignmentId)
      .then((data) => {
        if (cancelled) {
          return
        }
        setResult({ params, status: 'success', result: data })
      })
      .catch((error: unknown) => {
        if (cancelled) {
          return
        }
        if (error instanceof MyAssignmentApiError && error.status === 401) {
          setResult({ params, status: 'error', kind: 'expired', message: SESSION_EXPIRED_MESSAGE })
        } else if (error instanceof MyAssignmentApiError && error.status === 403) {
          setResult({ params, status: 'error', kind: 'forbidden', message: FORBIDDEN_MESSAGE })
        } else if (error instanceof MyAssignmentApiError && error.status === 404) {
          setResult({ params, status: 'error', kind: 'not-found', message: NOT_FOUND_MESSAGE })
        } else if (error instanceof MyAssignmentApiError && error.status === 409) {
          setResult({ params, status: 'error', kind: 'not-submitted', message: NOT_SUBMITTED_MESSAGE })
        } else if (error instanceof MyAssignmentApiError) {
          setResult({ params, status: 'error', kind: 'generic', message: error.message })
        } else {
          setResult({ params, status: 'error', kind: 'generic', message: GENERIC_ERROR_MESSAGE })
        }
      })

    return () => {
      cancelled = true
    }
  }, [accessToken, assignmentId, retryToken])

  function handleReSignIn() {
    logout()
    navigate('/login', { replace: true })
  }

  function handleRetry() {
    setRetryToken((current) => current + 1)
  }

  if (assignmentId === null) {
    return (
      <StudentLayout active="assignments">
        <div className="assignment-result-page">
          <div className="assignment-result-error" role="alert">
            <p>{INVALID_ID_MESSAGE}</p>
            <Link className="assignment-result-back-link" to="/student/assignments">
              내 과제로 돌아가기
            </Link>
          </div>
        </div>
      </StudentLayout>
    )
  }

  const isCurrent =
    result !== null && result.params.assignmentId === assignmentId && result.params.retryToken === retryToken
  const isLoading = !isCurrent
  const currentResult = isCurrent ? result : null

  // The fetch above is always issued and always wins once it settles; the
  // hint only fills the gap before that first settlement.
  const displayResult =
    currentResult?.status === 'success' ? currentResult.result : isLoading ? navigationHint : null

  return (
    <StudentLayout active="assignments">
      <div className="assignment-result-page">
        <header className="assignment-result-header">
          <h1>과제 결과</h1>
          <div className="assignment-result-header-links">
            <Link className="assignment-result-back-link" to={`/student/assignments/${assignmentId}`}>
              제출한 문제 보기
            </Link>
            <Link className="assignment-result-back-link" to="/student/assignments">
              내 과제로 돌아가기
            </Link>
          </div>
        </header>

        {isLoading && displayResult === null && (
          <p className="assignment-result-status" role="status">
            불러오는 중...
          </p>
        )}

        {currentResult?.status === 'error' && (
          <div className="assignment-result-error" role="alert">
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
            {currentResult.kind === 'not-submitted' && (
              <Button type="button" onClick={() => navigate(`/student/assignments/${assignmentId}`)}>
                과제 풀러 가기
              </Button>
            )}
          </div>
        )}

        {displayResult && (
          <div className="assignment-result-card">
            <dl className="assignment-result-meta">
              <div>
                <dt>제출 시각</dt>
                <dd>{formatKoreanDateTime(displayResult.submittedAt)}</dd>
              </div>
              <div>
                <dt>점수</dt>
                <dd>{displayResult.score}점</dd>
              </div>
              <div>
                <dt>정답 수</dt>
                <dd>
                  {displayResult.correctCount} / {displayResult.totalQuestions}
                </dd>
              </div>
              <div>
                <dt>응답 / 미응답</dt>
                <dd>
                  {displayResult.answeredQuestions} / {displayResult.totalQuestions - displayResult.answeredQuestions}
                </dd>
              </div>
            </dl>

            <section className="assignment-result-section">
              <h2>문항별 결과</h2>
              <ol className="assignment-result-list" aria-label="문항별 결과">
                {displayResult.results.map((item, index) => {
                  const isUnanswered = item.submittedAnswer === null
                  const state = item.correct ? 'correct' : isUnanswered ? 'unanswered' : 'incorrect'
                  const stateLabel = item.correct ? '정답' : isUnanswered ? '미응답' : '오답'

                  return (
                    <li key={item.questionId} className={`assignment-result-item assignment-result-item-${state}`}>
                      <div className="assignment-result-item-header">
                        <span className="assignment-result-item-order">{index + 1}번</span>
                        <span className={`assignment-result-badge assignment-result-badge-${state}`}>
                          {stateLabel}
                        </span>
                      </div>
                      <dl className="assignment-result-item-detail">
                        <div>
                          <dt>제출한 답안</dt>
                          <dd>{item.submittedAnswer ?? '제출한 답안 없음'}</dd>
                        </div>
                        <div>
                          <dt>정답</dt>
                          <dd>{item.correctAnswer}</dd>
                        </div>
                        <div>
                          <dt>해설</dt>
                          <dd>{item.explanation}</dd>
                        </div>
                      </dl>
                    </li>
                  )
                })}
              </ol>
            </section>
          </div>
        )}
      </div>
    </StudentLayout>
  )
}

export default StudentAssignmentResultPage
