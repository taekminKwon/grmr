import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { QuestionApiError, questionApi } from '../api/questionApi'
import {
  PHASE_1_QUESTION_TYPES,
  QUESTION_LEVELS,
  QUESTION_LEVEL_LABELS,
  QUESTION_STATUSES,
  QUESTION_STATUS_LABELS,
  QUESTION_TYPE_LABELS,
} from '../api/questionTypes'
import type { QuestionLevel, QuestionListItem, QuestionStatus, QuestionType } from '../api/questionTypes'
import { useAuth } from '../auth/useAuth'
import AdminLayout from '../components/AdminLayout'
import Button from '../components/Button'
import './QuestionListPage.css'

const PAGE_SIZE = 20

const GENERIC_ERROR_MESSAGE = '문제 목록을 불러오지 못했습니다. 잠시 후 다시 시도해주세요.'

type FilterFormState = {
  category: string
  type: QuestionType | ''
  level: QuestionLevel | ''
  status: QuestionStatus | ''
  keyword: string
}

const EMPTY_FILTERS: FilterFormState = { category: '', type: '', level: '', status: '', keyword: '' }

type QueryParams = { appliedFilters: FilterFormState; page: number; retryToken: number }

type FetchResult =
  | { params: QueryParams; status: 'success'; items: QuestionListItem[]; totalPages: number; totalElements: number }
  | { params: QueryParams; status: 'error'; message: string; expired: boolean }

function QuestionListPage() {
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
      ...(appliedFilters.category.trim() ? { category: appliedFilters.category.trim() } : {}),
      ...(appliedFilters.type ? { type: appliedFilters.type } : {}),
      ...(appliedFilters.level ? { level: appliedFilters.level } : {}),
      ...(appliedFilters.status ? { status: appliedFilters.status } : {}),
      ...(appliedFilters.keyword.trim() ? { keyword: appliedFilters.keyword.trim() } : {}),
    }

    questionApi
      .listQuestions(accessToken, filters)
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
        const expired = error instanceof QuestionApiError && error.status === 401
        const message = error instanceof QuestionApiError ? error.message : GENERIC_ERROR_MESSAGE
        setResult({ params, status: 'error', message, expired })
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
    <AdminLayout active="questions">
      <div className="question-list-page">
        <header className="question-list-header">
          <h1>문제 관리</h1>
          <p className="question-list-subtitle">등록된 문제를 조건별로 조회합니다.</p>
        </header>

        <form className="question-filter-form" onSubmit={handleFilterSubmit} aria-label="문제 검색 필터">
          <div className="question-filter-field">
            <label htmlFor="filter-category">카테고리</label>
            <input
              id="filter-category"
              type="text"
              value={formState.category}
              onChange={(event) => setFormState((prev) => ({ ...prev, category: event.target.value }))}
              placeholder="예: 현재완료"
            />
          </div>

          <div className="question-filter-field">
            <label htmlFor="filter-type">유형</label>
            <select
              id="filter-type"
              value={formState.type}
              onChange={(event) =>
                setFormState((prev) => ({ ...prev, type: event.target.value as QuestionType | '' }))
              }
            >
              <option value="">전체</option>
              {PHASE_1_QUESTION_TYPES.map((type) => (
                <option key={type} value={type}>
                  {QUESTION_TYPE_LABELS[type]}
                </option>
              ))}
            </select>
          </div>

          <div className="question-filter-field">
            <label htmlFor="filter-level">난이도</label>
            <select
              id="filter-level"
              value={formState.level}
              onChange={(event) =>
                setFormState((prev) => ({ ...prev, level: event.target.value as QuestionLevel | '' }))
              }
            >
              <option value="">전체</option>
              {QUESTION_LEVELS.map((level) => (
                <option key={level} value={level}>
                  {QUESTION_LEVEL_LABELS[level]}
                </option>
              ))}
            </select>
          </div>

          <div className="question-filter-field">
            <label htmlFor="filter-status">상태</label>
            <select
              id="filter-status"
              value={formState.status}
              onChange={(event) =>
                setFormState((prev) => ({ ...prev, status: event.target.value as QuestionStatus | '' }))
              }
            >
              <option value="">전체</option>
              {QUESTION_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {QUESTION_STATUS_LABELS[status]}
                </option>
              ))}
            </select>
          </div>

          <div className="question-filter-field question-filter-field-keyword">
            <label htmlFor="filter-keyword">키워드</label>
            <input
              id="filter-keyword"
              type="text"
              value={formState.keyword}
              onChange={(event) => setFormState((prev) => ({ ...prev, keyword: event.target.value }))}
              placeholder="문제 본문 검색"
            />
          </div>

          <div className="question-filter-actions">
            <Button type="submit">검색</Button>
            <Button type="button" variant="secondary" onClick={handleFilterReset}>
              초기화
            </Button>
          </div>
        </form>

        <section className="question-list-content" aria-live="polite">
          {isLoading && (
            <p className="question-list-status" role="status">
              불러오는 중...
            </p>
          )}

          {currentResult?.status === 'error' && (
            <div className="question-list-error" role="alert">
              <p>{currentResult.message}</p>
              {currentResult.expired ? (
                <Button type="button" onClick={handleReSignIn}>
                  다시 로그인
                </Button>
              ) : (
                <Button type="button" onClick={handleRetry}>
                  다시 시도
                </Button>
              )}
            </div>
          )}

          {currentResult?.status === 'success' && items.length === 0 && (
            <p className="question-list-empty">조건에 맞는 문제가 없습니다.</p>
          )}

          {currentResult?.status === 'success' && items.length > 0 && (
            <>
              <table className="question-table">
                <caption className="sr-only">문제 목록</caption>
                <thead>
                  <tr>
                    <th scope="col">ID</th>
                    <th scope="col">카테고리</th>
                    <th scope="col">유형</th>
                    <th scope="col">난이도</th>
                    <th scope="col">상태</th>
                    <th scope="col">문제 내용</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr key={item.id}>
                      <td>{item.id}</td>
                      <td>{item.category}</td>
                      <td>{QUESTION_TYPE_LABELS[item.type]}</td>
                      <td>{QUESTION_LEVEL_LABELS[item.level]}</td>
                      <td>
                        <span className={`question-status-badge question-status-${item.status.toLowerCase()}`}>
                          {QUESTION_STATUS_LABELS[item.status]}
                        </span>
                      </td>
                      <td className="question-table-text">{item.text}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <nav className="question-pagination" aria-label="페이지 이동">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setPage((current) => current - 1)}
                  disabled={!hasPrevPage}
                >
                  이전
                </Button>
                <span className="question-pagination-status">
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

export default QuestionListPage
