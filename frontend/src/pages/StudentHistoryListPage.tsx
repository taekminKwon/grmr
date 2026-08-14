import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { StudyRecordApiError, historyApi } from '../api/practiceHistoryApi'
import type { StudyRecordSummary } from '../api/practiceHistoryApi'
import { QUESTION_LEVEL_LABELS } from '../api/questionTypes'
import { useAuth } from '../auth/useAuth'
import StudentLayout from '../components/StudentLayout'
import Button from '../components/Button'
import { formatKoreanDateTime } from '../utils/formatDateTime'
import './StudentHistoryListPage.css'

const PAGE_SIZE = 20

const GENERIC_ERROR_MESSAGE = '학습 기록을 불러오지 못했습니다. 잠시 후 다시 시도해주세요.'
const SESSION_EXPIRED_MESSAGE = '세션이 만료되었습니다. 다시 로그인해주세요.'
const FORBIDDEN_MESSAGE = '학습 기록을 조회할 권한이 없습니다. 학생 계정으로 로그인했는지 확인해주세요.'

type FilterFormState = { category: string }

const EMPTY_FILTERS: FilterFormState = { category: '' }

type ErrorKind = 'expired' | 'forbidden' | 'generic'

type QueryParams = { appliedFilters: FilterFormState; page: number; retryToken: number }

type FetchResult =
  | {
      params: QueryParams
      status: 'success'
      items: StudyRecordSummary[]
      totalPages: number
      totalElements: number
    }
  | { params: QueryParams; status: 'error'; message: string; kind: ErrorKind }

function StudentHistoryListPage() {
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

    historyApi
      .listRecords(accessToken, {
        page,
        size: PAGE_SIZE,
        ...(appliedFilters.category.trim() ? { category: appliedFilters.category.trim() } : {}),
      })
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
        if (error instanceof StudyRecordApiError && error.status === 401) {
          setResult({ params, status: 'error', message: SESSION_EXPIRED_MESSAGE, kind: 'expired' })
        } else if (error instanceof StudyRecordApiError && error.status === 403) {
          setResult({ params, status: 'error', message: FORBIDDEN_MESSAGE, kind: 'forbidden' })
        } else if (error instanceof StudyRecordApiError) {
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
    <StudentLayout active="history">
      <div className="history-list-page">
        <header className="history-list-header">
          <h1>My Study</h1>
          <p className="history-list-subtitle">지금까지 풀어본 문제와 결과를 확인하세요.</p>
        </header>

        <form className="history-filter-form" onSubmit={handleFilterSubmit} aria-label="학습 기록 검색 필터">
          <div className="history-filter-field">
            <label htmlFor="history-filter-category">카테고리</label>
            <input
              id="history-filter-category"
              type="text"
              value={formState.category}
              onChange={(event) => setFormState({ category: event.target.value })}
              placeholder="예: 가정법"
            />
          </div>

          <div className="history-filter-actions">
            <Button type="submit">검색</Button>
            <Button type="button" variant="secondary" onClick={handleFilterReset}>
              초기화
            </Button>
          </div>
        </form>

        <section className="history-list-content" aria-live="polite">
          {isLoading && (
            <p className="history-list-status" role="status">
              불러오는 중...
            </p>
          )}

          {currentResult?.status === 'error' && (
            <div className="history-list-error" role="alert">
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
            <p className="history-list-empty">학습 기록이 없습니다.</p>
          )}

          {currentResult?.status === 'success' && items.length > 0 && (
            <>
              <table className="history-table">
                <caption className="sr-only">학습 기록 목록</caption>
                <thead>
                  <tr>
                    <th scope="col">카테고리</th>
                    <th scope="col">난이도</th>
                    <th scope="col">결과</th>
                    <th scope="col">제출 시각</th>
                    <th scope="col">문제 내용</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr key={item.id}>
                      <td>{item.category}</td>
                      <td>{QUESTION_LEVEL_LABELS[item.level]}</td>
                      <td>
                        <span
                          className={`history-result-badge history-result-${item.correct ? 'correct' : 'incorrect'}`}
                        >
                          {item.correct ? '정답' : '오답'}
                        </span>
                      </td>
                      <td>{formatKoreanDateTime(item.submittedAt)}</td>
                      <td className="history-table-text">
                        <Link className="history-table-text-link" to={`/student/history/${item.id}`}>
                          {item.text}
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <nav className="history-pagination" aria-label="페이지 이동">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setPage((current) => current - 1)}
                  disabled={!hasPrevPage}
                >
                  이전
                </Button>
                <span className="history-pagination-status">
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

export default StudentHistoryListPage
