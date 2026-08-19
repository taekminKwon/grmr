import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { StudentApiError, studentApi } from '../api/studentApi'
import type { StudentListItem } from '../api/studentTypes'
import { useAuth } from '../auth/useAuth'
import AdminLayout from '../components/AdminLayout'
import Button from '../components/Button'
import './StudentListPage.css'

const PAGE_SIZE = 20

const GENERIC_ERROR_MESSAGE = '학생 목록을 불러오지 못했습니다. 잠시 후 다시 시도해주세요.'
const SESSION_EXPIRED_MESSAGE = '세션이 만료되었습니다. 다시 로그인해주세요.'
const FORBIDDEN_MESSAGE = '학생 목록을 조회할 권한이 없습니다. 관리자 계정으로 로그인했는지 확인해주세요.'

const NO_GROUP_LABEL = '미배정'
const NEVER_STUDIED_LABEL = '학습 기록 없음'

type FilterFormState = { keyword: string; group: string }

const EMPTY_FILTERS: FilterFormState = { keyword: '', group: '' }

type ErrorKind = 'expired' | 'forbidden' | 'generic'

type QueryParams = { appliedFilters: FilterFormState; page: number; retryToken: number }

type FetchResult =
  | { params: QueryParams; status: 'success'; items: StudentListItem[]; totalPages: number; totalElements: number }
  | { params: QueryParams; status: 'error'; message: string; kind: ErrorKind }

function StudentListPage() {
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
      ...(appliedFilters.keyword.trim() ? { keyword: appliedFilters.keyword.trim() } : {}),
      ...(appliedFilters.group.trim() ? { group: appliedFilters.group.trim() } : {}),
    }

    studentApi
      .listStudents(accessToken, filters)
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
        if (error instanceof StudentApiError && error.status === 401) {
          setResult({ params, status: 'error', message: SESSION_EXPIRED_MESSAGE, kind: 'expired' })
        } else if (error instanceof StudentApiError && error.status === 403) {
          setResult({ params, status: 'error', message: FORBIDDEN_MESSAGE, kind: 'forbidden' })
        } else if (error instanceof StudentApiError) {
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
    <AdminLayout active="students">
      <div className="student-list-page">
        <header className="student-list-header">
          <div>
            <h1>학생 관리</h1>
            <p className="student-list-subtitle">등록된 학생을 조건별로 조회합니다.</p>
          </div>
        </header>

        <form className="student-filter-form" onSubmit={handleFilterSubmit} aria-label="학생 검색 필터">
          <div className="student-filter-field student-filter-field-keyword">
            <label htmlFor="filter-keyword">이름</label>
            <input
              id="filter-keyword"
              type="text"
              value={formState.keyword}
              onChange={(event) => setFormState((prev) => ({ ...prev, keyword: event.target.value }))}
              placeholder="학생 이름 검색"
            />
          </div>

          <div className="student-filter-field">
            <label htmlFor="filter-group">그룹</label>
            <input
              id="filter-group"
              type="text"
              value={formState.group}
              onChange={(event) => setFormState((prev) => ({ ...prev, group: event.target.value }))}
              placeholder="예: 중1 A반"
            />
          </div>

          <div className="student-filter-actions">
            <Button type="submit">검색</Button>
            <Button type="button" variant="secondary" onClick={handleFilterReset}>
              초기화
            </Button>
          </div>
        </form>

        <section className="student-list-content" aria-live="polite">
          {isLoading && (
            <p className="student-list-status" role="status">
              불러오는 중...
            </p>
          )}

          {currentResult?.status === 'error' && (
            <div className="student-list-error" role="alert">
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
            <p className="student-list-empty">조건에 맞는 학생이 없습니다.</p>
          )}

          {currentResult?.status === 'success' && items.length > 0 && (
            <>
              <table className="student-table">
                <caption className="sr-only">학생 목록</caption>
                <thead>
                  <tr>
                    <th scope="col">이름</th>
                    <th scope="col">그룹</th>
                    <th scope="col">최근 학습일</th>
                    <th scope="col">누적 문제 수</th>
                    <th scope="col">정답률</th>
                    <th scope="col">미제출 과제</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr key={item.id}>
                      <td>
                        <Link className="student-table-name-link" to={`/admin/students/${item.id}`}>
                          {item.name}
                        </Link>
                      </td>
                      <td>
                        {item.studentGroup ?? <span className="student-cell-muted">{NO_GROUP_LABEL}</span>}
                      </td>
                      <td>
                        {item.lastStudiedAt ?? <span className="student-cell-muted">{NEVER_STUDIED_LABEL}</span>}
                      </td>
                      <td>{item.totalQuestionCount}</td>
                      <td>{item.accuracy}%</td>
                      <td>{item.pendingAssignmentCount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <nav className="student-pagination" aria-label="페이지 이동">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setPage((current) => current - 1)}
                  disabled={!hasPrevPage}
                >
                  이전
                </Button>
                <span className="student-pagination-status">
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

export default StudentListPage
