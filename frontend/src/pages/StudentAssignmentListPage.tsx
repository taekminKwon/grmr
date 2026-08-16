import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { MyAssignmentApiError, myAssignmentApi } from '../api/myAssignmentApi'
import type { MyAssignmentListItem, SubmissionStatus } from '../api/myAssignmentApi'
import { ASSIGNMENT_STATUS_LABELS } from '../api/assignmentTypes'
import { useAuth } from '../auth/useAuth'
import StudentLayout from '../components/StudentLayout'
import Button from '../components/Button'
import './StudentAssignmentListPage.css'

const PAGE_SIZE = 20

const GENERIC_ERROR_MESSAGE = '과제 목록을 불러오지 못했습니다. 잠시 후 다시 시도해주세요.'
const SESSION_EXPIRED_MESSAGE = '세션이 만료되었습니다. 다시 로그인해주세요.'
const FORBIDDEN_MESSAGE = '과제를 조회할 권한이 없습니다. 학생 계정으로 로그인했는지 확인해주세요.'

// Distinct from ASSIGNMENT_STATUS_LABELS (진행 중/마감) on purpose: submission
// status and assignment lifecycle status are independent axes and must never
// share the same label, or the two badges would look like duplicates.
const SUBMISSION_STATUS_LABELS: Readonly<Record<SubmissionStatus, string>> = {
  NOT_STARTED: '미시작',
  IN_PROGRESS: '풀이 중',
  SUBMITTED: '제출 완료',
}

type ErrorKind = 'expired' | 'forbidden' | 'generic'

type QueryParams = { page: number; retryToken: number }

type FetchResult =
  | {
      params: QueryParams
      status: 'success'
      items: MyAssignmentListItem[]
      totalPages: number
      totalElements: number
    }
  | { params: QueryParams; status: 'error'; message: string; kind: ErrorKind }

type AssignmentCta = { label: string; to: string | null }

// Closed-but-unsubmitted work must not offer a CTA that implies solving or
// submitting is still possible, even though its submissionStatus is still
// NOT_STARTED/IN_PROGRESS (see docs/api-spec-detail.md#제출-상태submissionstatus와-생명주기).
function resolveCta(item: MyAssignmentListItem): AssignmentCta {
  if (item.submissionStatus === 'SUBMITTED') {
    return { label: '결과 보기', to: `/student/assignments/${item.id}/result` }
  }
  if (item.status === 'CLOSED') {
    return { label: '마감됨', to: null }
  }
  if (item.submissionStatus === 'IN_PROGRESS') {
    return { label: '이어서 풀기', to: `/student/assignments/${item.id}` }
  }
  return { label: '시작하기', to: `/student/assignments/${item.id}` }
}

function StudentAssignmentListPage() {
  const { session, logout } = useAuth()
  const navigate = useNavigate()

  const [page, setPage] = useState(0)
  const [retryToken, setRetryToken] = useState(0)
  const [result, setResult] = useState<FetchResult | null>(null)

  const accessToken = session?.accessToken

  useEffect(() => {
    if (!accessToken) {
      return
    }

    const params: QueryParams = { page, retryToken }
    let cancelled = false

    myAssignmentApi
      .listAssignments(accessToken, { page, size: PAGE_SIZE })
      .then((response) => {
        if (cancelled) {
          return
        }
        setResult({
          params,
          status: 'success',
          items: response.content,
          totalPages: response.totalPages,
          totalElements: response.totalElements,
        })
      })
      .catch((error: unknown) => {
        if (cancelled) {
          return
        }
        if (error instanceof MyAssignmentApiError && error.status === 401) {
          setResult({ params, status: 'error', message: SESSION_EXPIRED_MESSAGE, kind: 'expired' })
        } else if (error instanceof MyAssignmentApiError && error.status === 403) {
          setResult({ params, status: 'error', message: FORBIDDEN_MESSAGE, kind: 'forbidden' })
        } else if (error instanceof MyAssignmentApiError) {
          setResult({ params, status: 'error', message: error.message, kind: 'generic' })
        } else {
          setResult({ params, status: 'error', message: GENERIC_ERROR_MESSAGE, kind: 'generic' })
        }
      })

    return () => {
      cancelled = true
    }
  }, [accessToken, page, retryToken])

  function handleReSignIn() {
    logout()
    navigate('/login', { replace: true })
  }

  function handleRetry() {
    setRetryToken((current) => current + 1)
  }

  const isCurrent = result !== null && result.params.page === page && result.params.retryToken === retryToken
  const isLoading = !isCurrent
  const currentResult = isCurrent ? result : null
  const items = currentResult?.status === 'success' ? currentResult.items : []
  const totalPages = currentResult?.status === 'success' ? currentResult.totalPages : 0
  const totalElements = currentResult?.status === 'success' ? currentResult.totalElements : 0
  const hasPrevPage = page > 0
  const hasNextPage = page + 1 < totalPages

  return (
    <StudentLayout active="assignments">
      <div className="student-assignment-list-page">
        <header className="student-assignment-list-header">
          <h1>내 과제</h1>
          <p className="student-assignment-list-subtitle">마감일이 가까운 순서로 표시됩니다.</p>
        </header>

        <section className="student-assignment-list-content" aria-live="polite">
          {isLoading && (
            <p className="student-assignment-list-status" role="status">
              불러오는 중...
            </p>
          )}

          {currentResult?.status === 'error' && (
            <div className="student-assignment-list-error" role="alert">
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

          {currentResult?.status === 'success' && items.length === 0 && (
            <p className="student-assignment-list-empty">받은 과제가 없습니다.</p>
          )}

          {currentResult?.status === 'success' && items.length > 0 && (
            <>
              <table className="student-assignment-table">
                <caption className="sr-only">내 과제 목록</caption>
                <thead>
                  <tr>
                    <th scope="col">제목</th>
                    <th scope="col">시작일</th>
                    <th scope="col">마감일</th>
                    <th scope="col">상태</th>
                    <th scope="col">제출 상태</th>
                    <th scope="col">진행률</th>
                    <th scope="col">
                      <span className="sr-only">동작</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => {
                    const cta = resolveCta(item)
                    return (
                      <tr key={item.id}>
                        <td className="student-assignment-table-title">{item.title}</td>
                        <td>{item.startDate}</td>
                        <td>{item.dueDate}</td>
                        <td>
                          <span
                            className={`student-assignment-status-badge student-assignment-status-${item.status.toLowerCase()}`}
                          >
                            {ASSIGNMENT_STATUS_LABELS[item.status]}
                          </span>
                        </td>
                        <td>
                          <span
                            className={`student-submission-status-badge student-submission-status-${item.submissionStatus.toLowerCase()}`}
                          >
                            {SUBMISSION_STATUS_LABELS[item.submissionStatus]}
                          </span>
                        </td>
                        <td>
                          <div className="student-assignment-progress-cell">
                            <span className="student-assignment-progress-track">
                              <span
                                className="student-assignment-progress-fill"
                                style={{ width: `${item.progress}%` }}
                              />
                            </span>
                            <span className="student-assignment-progress-value">{item.progress}%</span>
                          </div>
                        </td>
                        <td>
                          <Button
                            type="button"
                            disabled={cta.to === null}
                            onClick={() => {
                              if (cta.to) {
                                navigate(cta.to)
                              }
                            }}
                          >
                            {cta.label}
                          </Button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>

              <nav className="student-assignment-pagination" aria-label="페이지 이동">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setPage((current) => current - 1)}
                  disabled={!hasPrevPage}
                >
                  이전
                </Button>
                <span className="student-assignment-pagination-status">
                  {page + 1} / {Math.max(totalPages, 1)} 페이지 · 총 {totalElements}건
                </span>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setPage((current) => current + 1)}
                  disabled={!hasNextPage}
                >
                  다음
                </Button>
              </nav>
            </>
          )}
        </section>
      </div>
    </StudentLayout>
  )
}

export default StudentAssignmentListPage
