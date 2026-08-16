import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { AssignmentApiError, assignmentApi } from '../api/assignmentApi'
import { ASSIGNMENT_STATUS_LABELS } from '../api/assignmentTypes'
import type { AssignmentDetail } from '../api/assignmentTypes'
import { useAuth } from '../auth/useAuth'
import AdminLayout from '../components/AdminLayout'
import Button from '../components/Button'
import './AssignmentDetailPage.css'

const GENERIC_ERROR_MESSAGE = '과제 정보를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.'
const NOT_FOUND_MESSAGE = '과제를 찾을 수 없습니다.'
const FORBIDDEN_MESSAGE = '과제를 조회할 권한이 없습니다. 관리자 계정으로 로그인했는지 확인해주세요.'
const SESSION_EXPIRED_MESSAGE = '세션이 만료되었습니다. 다시 로그인해주세요.'
const INVALID_ID_MESSAGE = '잘못된 과제 번호입니다.'
const DELETE_GENERIC_ERROR_MESSAGE = '과제를 삭제하지 못했습니다. 잠시 후 다시 시도해주세요.'
const DELETE_FORBIDDEN_MESSAGE = '과제를 삭제할 권한이 없습니다. 관리자 계정으로 로그인했는지 확인해주세요.'

type ErrorKind = 'expired' | 'forbidden' | 'not-found' | 'generic'

type QueryParams = { assignmentId: number; retryToken: number }

type FetchResult =
  | { params: QueryParams; status: 'success'; assignment: AssignmentDetail }
  | { params: QueryParams; status: 'error'; message: string; kind: ErrorKind }

// Route params are always strings; only positive integers are valid assignment IDs.
function parseAssignmentId(raw: string | undefined): number | null {
  if (!raw || !/^\d+$/.test(raw)) {
    return null
  }
  const id = Number(raw)
  return Number.isSafeInteger(id) && id > 0 ? id : null
}

function AssignmentDetailPage() {
  const { id: rawId } = useParams<{ id: string }>()
  const { session, logout } = useAuth()
  const navigate = useNavigate()

  const assignmentId = parseAssignmentId(rawId)

  const [retryToken, setRetryToken] = useState(0)
  const [result, setResult] = useState<FetchResult | null>(null)

  const [deleteStep, setDeleteStep] = useState<'idle' | 'confirm'>('idle')
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<{ message: string; expired: boolean } | null>(null)

  const accessToken = session?.accessToken

  useEffect(() => {
    if (!accessToken || assignmentId === null) {
      return
    }

    const params: QueryParams = { assignmentId, retryToken }
    let cancelled = false

    assignmentApi
      .getAssignment(accessToken, assignmentId)
      .then((assignment) => {
        if (cancelled) {
          return
        }
        setResult({ params, status: 'success', assignment })
      })
      .catch((error: unknown) => {
        if (cancelled) {
          return
        }
        if (error instanceof AssignmentApiError && error.status === 401) {
          setResult({ params, status: 'error', message: SESSION_EXPIRED_MESSAGE, kind: 'expired' })
        } else if (error instanceof AssignmentApiError && error.status === 403) {
          setResult({ params, status: 'error', message: FORBIDDEN_MESSAGE, kind: 'forbidden' })
        } else if (error instanceof AssignmentApiError && error.status === 404) {
          setResult({ params, status: 'error', message: NOT_FOUND_MESSAGE, kind: 'not-found' })
        } else if (error instanceof AssignmentApiError) {
          setResult({ params, status: 'error', message: error.message, kind: 'generic' })
        } else {
          setResult({ params, status: 'error', message: GENERIC_ERROR_MESSAGE, kind: 'generic' })
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

  function handleDeleteStart() {
    setDeleteStep('confirm')
    setDeleteError(null)
  }

  function handleDeleteCancel() {
    setDeleteStep('idle')
    setDeleteError(null)
  }

  async function handleDeleteConfirm() {
    if (!accessToken || assignmentId === null) {
      return
    }

    setDeleting(true)
    setDeleteError(null)
    try {
      await assignmentApi.deleteAssignment(accessToken, assignmentId)
      navigate('/admin/assignments')
    } catch (error) {
      if (error instanceof AssignmentApiError && error.status === 401) {
        setDeleteError({ message: SESSION_EXPIRED_MESSAGE, expired: true })
      } else if (error instanceof AssignmentApiError && error.status === 403) {
        setDeleteError({ message: DELETE_FORBIDDEN_MESSAGE, expired: false })
      } else if (error instanceof AssignmentApiError) {
        setDeleteError({ message: error.message, expired: false })
      } else {
        setDeleteError({ message: DELETE_GENERIC_ERROR_MESSAGE, expired: false })
      }
    } finally {
      setDeleting(false)
    }
  }

  if (assignmentId === null) {
    return (
      <AdminLayout active="assignments">
        <div className="assignment-detail-page">
          <div className="assignment-detail-error" role="alert">
            <p>{INVALID_ID_MESSAGE}</p>
            <Link className="assignment-detail-back-link" to="/admin/assignments">
              목록으로 돌아가기
            </Link>
          </div>
        </div>
      </AdminLayout>
    )
  }

  const isCurrent =
    result !== null && result.params.assignmentId === assignmentId && result.params.retryToken === retryToken
  const isLoading = !isCurrent
  const currentResult = isCurrent ? result : null
  const orderedQuestions =
    currentResult?.status === 'success'
      ? [...currentResult.assignment.questions].sort((a, b) => a.order - b.order)
      : []

  return (
    <AdminLayout active="assignments">
      <div className="assignment-detail-page">
        <header className="assignment-detail-header">
          <h1>과제 상세</h1>
          <Link className="assignment-detail-back-link" to="/admin/assignments">
            목록으로 돌아가기
          </Link>
        </header>

        {isLoading && (
          <p className="assignment-detail-status" role="status">
            불러오는 중...
          </p>
        )}

        {currentResult?.status === 'error' && (
          <div className="assignment-detail-error" role="alert">
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
          <div className="assignment-detail-card">
            <dl className="assignment-detail-meta">
              <div>
                <dt>제목</dt>
                <dd>{currentResult.assignment.title}</dd>
              </div>
              <div>
                <dt>대상</dt>
                <dd>{currentResult.assignment.target}</dd>
              </div>
              <div>
                <dt>시작일</dt>
                <dd>{currentResult.assignment.startDate}</dd>
              </div>
              <div>
                <dt>마감일</dt>
                <dd>{currentResult.assignment.dueDate}</dd>
              </div>
              <div>
                <dt>진행률</dt>
                <dd>{currentResult.assignment.progress}%</dd>
              </div>
              <div>
                <dt>상태</dt>
                <dd>
                  <span
                    className={`assignment-detail-status-badge assignment-detail-status-${currentResult.assignment.status.toLowerCase()}`}
                  >
                    {ASSIGNMENT_STATUS_LABELS[currentResult.assignment.status]}
                  </span>
                </dd>
              </div>
            </dl>

            <section className="assignment-detail-section">
              <h2>문제 목록</h2>
              {orderedQuestions.length === 0 ? (
                <p className="assignment-detail-empty">등록된 문제가 없습니다.</p>
              ) : (
                <table className="assignment-detail-question-table">
                  <caption className="sr-only">과제 문제 목록</caption>
                  <thead>
                    <tr>
                      <th scope="col">순서</th>
                      <th scope="col">문제</th>
                      <th scope="col">카테고리</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orderedQuestions.map((question) => (
                      <tr key={question.id}>
                        <td>{question.order}</td>
                        <td>{question.text}</td>
                        <td>{question.category}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </section>

            <div className="assignment-detail-actions">
              <Button type="button" onClick={() => navigate(`/admin/assignments/${assignmentId}/edit`)}>
                과제 수정
              </Button>
              {deleteStep === 'idle' && (
                <Button type="button" variant="secondary" onClick={handleDeleteStart}>
                  과제 삭제
                </Button>
              )}
            </div>

            {deleteStep === 'confirm' && (
              <div className="assignment-detail-delete-confirm">
                <p>정말 이 과제를 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.</p>
                <div className="assignment-detail-delete-confirm-actions">
                  <Button type="button" onClick={handleDeleteConfirm} disabled={deleting}>
                    {deleting ? '삭제 중...' : '삭제 확인'}
                  </Button>
                  <Button type="button" variant="secondary" onClick={handleDeleteCancel} disabled={deleting}>
                    취소
                  </Button>
                </div>
              </div>
            )}

            {deleteError && (
              <div className="assignment-detail-delete-error" role="alert">
                <p>{deleteError.message}</p>
                {deleteError.expired && (
                  <Button type="button" onClick={handleReSignIn}>
                    다시 로그인
                  </Button>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </AdminLayout>
  )
}

export default AssignmentDetailPage
