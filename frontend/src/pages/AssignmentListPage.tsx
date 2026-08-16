import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AssignmentApiError, assignmentApi } from '../api/assignmentApi'
import { ASSIGNMENT_STATUSES, ASSIGNMENT_STATUS_LABELS } from '../api/assignmentTypes'
import type { AssignmentListItem, AssignmentStatus } from '../api/assignmentTypes'
import { useAuth } from '../auth/useAuth'
import AdminLayout from '../components/AdminLayout'
import Button from '../components/Button'
import './AssignmentListPage.css'

const PAGE_SIZE = 20

const GENERIC_ERROR_MESSAGE = '과제 목록을 불러오지 못했습니다. 잠시 후 다시 시도해주세요.'
const SESSION_EXPIRED_MESSAGE = '세션이 만료되었습니다. 다시 로그인해주세요.'
const FORBIDDEN_MESSAGE = '과제를 조회할 권한이 없습니다. 관리자 계정으로 로그인했는지 확인해주세요.'

type FilterFormState = { status: AssignmentStatus | ''; keyword: string }

const EMPTY_FILTERS: FilterFormState = { status: '', keyword: '' }

type ErrorKind = 'expired' | 'forbidden' | 'generic'

type QueryParams = { appliedFilters: FilterFormState; page: number; retryToken: number }

type FetchResult =
  | { params: QueryParams; status: 'success'; items: AssignmentListItem[]; totalPages: number; totalElements: number }
  | { params: QueryParams; status: 'error'; message: string; kind: ErrorKind }

function AssignmentListPage() {
  const { session, logout } = useAuth()
  const navigate = useNavigate()

  const [formState, setFormState] = useState<FilterFormState>(EMPTY_FILTERS)
  const [appliedFilters, setAppliedFilters] = useState<FilterFormState>(EMPTY_FILTERS)
  const [page, setPage] = useState(0)
  const [retryToken, setRetryToken] = useState(0)
  const [result, setResult] = useState<FetchResult | null>(null)

  const accessToken = session?.accessToken

  useEffect(() => {
    if (!accessToken) {
      return
    }

    const params: QueryParams = { appliedFilters, page, retryToken }
    let cancelled = false

    const filters = {
      page,
      size: PAGE_SIZE,
      ...(appliedFilters.status ? { status: appliedFilters.status } : {}),
      ...(appliedFilters.keyword.trim() ? { keyword: appliedFilters.keyword.trim() } : {}),
    }

    assignmentApi
      .listAssignments(accessToken, filters)
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
        if (error instanceof AssignmentApiError && error.status === 401) {
          setResult({ params, status: 'error', message: SESSION_EXPIRED_MESSAGE, kind: 'expired' })
        } else if (error instanceof AssignmentApiError && error.status === 403) {
          setResult({ params, status: 'error', message: FORBIDDEN_MESSAGE, kind: 'forbidden' })
        } else if (error instanceof AssignmentApiError) {
          setResult({ params, status: 'error', message: error.message, kind: 'generic' })
        } else {
          setResult({ params, status: 'error', message: GENERIC_ERROR_MESSAGE, kind: 'generic' })
        }
      })

    return () => {
      cancelled = true
    }
  }, [accessToken, appliedFilters, page, retryToken])

  function handleFilterSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setAppliedFilters(formState)
    setPage(0)
  }

  function handleFilterReset() {
    setFormState(EMPTY_FILTERS)
    setAppliedFilters(EMPTY_FILTERS)
    setPage(0)
  }

  function handleReSignIn() {
    logout()
    navigate('/login', { replace: true })
  }

  function handleRetry() {
    setRetryToken((current) => current + 1)
  }

  const isCurrent =
    result !== null &&
    result.params.appliedFilters === appliedFilters &&
    result.params.page === page &&
    result.params.retryToken === retryToken
  const isLoading = !isCurrent
  const currentResult = isCurrent ? result : null
  const items = currentResult?.status === 'success' ? currentResult.items : []
  const totalPages = currentResult?.status === 'success' ? currentResult.totalPages : 0
  const totalElements = currentResult?.status === 'success' ? currentResult.totalElements : 0
  const hasPrevPage = page > 0
  const hasNextPage = page + 1 < totalPages

  return (
    <AdminLayout active="assignments">
      <div className="assignment-list-page">
        <header className="assignment-list-header">
          <div>
            <h1>과제 관리</h1>
            <p className="assignment-list-subtitle">등록된 과제를 조건별로 조회합니다.</p>
          </div>
        </header>

        <form className="assignment-filter-form" onSubmit={handleFilterSubmit} aria-label="과제 검색 필터">
          <div className="assignment-filter-field">
            <label htmlFor="filter-status">상태</label>
            <select
              id="filter-status"
              value={formState.status}
              onChange={(event) =>
                setFormState((prev) => ({ ...prev, status: event.target.value as AssignmentStatus | '' }))
              }
            >
              <option value="">전체</option>
              {ASSIGNMENT_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {ASSIGNMENT_STATUS_LABELS[status]}
                </option>
              ))}
            </select>
          </div>

          <div className="assignment-filter-field assignment-filter-field-keyword">
            <label htmlFor="filter-keyword">키워드</label>
            <input
              id="filter-keyword"
              type="text"
              value={formState.keyword}
              onChange={(event) => setFormState((prev) => ({ ...prev, keyword: event.target.value }))}
              placeholder="과제 제목 검색"
            />
          </div>

          <div className="assignment-filter-actions">
            <Button type="submit">검색</Button>
            <Button type="button" variant="secondary" onClick={handleFilterReset}>
              초기화
            </Button>
          </div>
        </form>

        <section className="assignment-list-content" aria-live="polite">
          {isLoading && (
            <p className="assignment-list-status" role="status">
              불러오는 중...
            </p>
          )}

          {currentResult?.status === 'error' && (
            <div className="assignment-list-error" role="alert">
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
            <p className="assignment-list-empty">조건에 맞는 과제가 없습니다.</p>
          )}

          {currentResult?.status === 'success' && items.length > 0 && (
            <>
              <table className="assignment-table">
                <caption className="sr-only">과제 목록</caption>
                <thead>
                  <tr>
                    <th scope="col">제목</th>
                    <th scope="col">대상</th>
                    <th scope="col">시작일</th>
                    <th scope="col">마감일</th>
                    <th scope="col">진행률</th>
                    <th scope="col">상태</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr key={item.id}>
                      <td className="assignment-table-title">
                        <Link className="assignment-table-title-link" to={`/admin/assignments/${item.id}`}>
                          {item.title}
                        </Link>
                      </td>
                      <td>{item.target}</td>
                      <td>{item.startDate}</td>
                      <td>{item.dueDate}</td>
                      <td>
                        <div className="assignment-progress-cell">
                          <span className="assignment-progress-track">
                            <span
                              className="assignment-progress-fill"
                              style={{ width: `${item.progress}%` }}
                            />
                          </span>
                          <span className="assignment-progress-value">{item.progress}%</span>
                        </div>
                      </td>
                      <td>
                        <span className={`assignment-status-badge assignment-status-${item.status.toLowerCase()}`}>
                          {ASSIGNMENT_STATUS_LABELS[item.status]}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <nav className="assignment-pagination" aria-label="페이지 이동">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setPage((current) => current - 1)}
                  disabled={!hasPrevPage}
                >
                  이전
                </Button>
                <span className="assignment-pagination-status">
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
    </AdminLayout>
  )
}

export default AssignmentListPage
