import { useEffect, useState } from 'react'
import type { FormEvent, KeyboardEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { AssignmentApiError, assignmentApi } from '../api/assignmentApi'
import { ASSIGNMENT_TARGET_TYPES } from '../api/assignmentTypes'
import type { AssignmentDetail, AssignmentTargetType } from '../api/assignmentTypes'
import { QuestionApiError, questionApi } from '../api/questionApi'
import {
  QUESTION_LEVELS,
  QUESTION_LEVEL_LABELS,
  QUESTION_STATUSES,
  QUESTION_STATUS_LABELS,
} from '../api/questionTypes'
import type { QuestionLevel, QuestionListItem, QuestionStatus } from '../api/questionTypes'
import { useAuth } from '../auth/useAuth'
import AdminLayout from '../components/AdminLayout'
import Button from '../components/Button'
import './AssignmentEditPage.css'

const SEARCH_PAGE_SIZE = 10

const LOAD_GENERIC_ERROR_MESSAGE = '과제 정보를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.'
const LOAD_NOT_FOUND_MESSAGE = '과제를 찾을 수 없습니다.'
const LOAD_FORBIDDEN_MESSAGE = '과제를 조회할 권한이 없습니다. 관리자 계정으로 로그인했는지 확인해주세요.'
const SESSION_EXPIRED_MESSAGE = '세션이 만료되었습니다. 다시 로그인해주세요.'
const INVALID_ID_MESSAGE = '잘못된 과제 번호입니다.'
const SUBMIT_GENERIC_ERROR_MESSAGE = '과제를 수정하지 못했습니다. 잠시 후 다시 시도해주세요.'
const SUBMIT_FORBIDDEN_MESSAGE = '과제를 수정할 권한이 없습니다. 관리자 계정으로 로그인했는지 확인해주세요.'
const QUESTION_SEARCH_ERROR_MESSAGE = '문제 목록을 불러오지 못했습니다. 잠시 후 다시 시도해주세요.'

const TARGET_TYPE_LABELS: Readonly<Record<AssignmentTargetType, string>> = {
  CLASS: '반(그룹)',
  STUDENT: '개별 학생',
}

// Only the fields the selected-questions table renders; keeps items sourced
// from the loaded detail (AssignmentQuestionSummary) and from search results
// (QuestionListItem) structurally interchangeable.
type SelectedQuestion = { id: number; text: string; category: string }

type FormErrors = {
  targetGroup?: string
  targetStudentId?: string
  startDate?: string
  dueDate?: string
  questions?: string
}

type LoadErrorKind = 'expired' | 'forbidden' | 'not-found' | 'generic'

type LoadQueryParams = { assignmentId: number; retryToken: number }

type LoadResult =
  | { params: LoadQueryParams; status: 'success'; assignment: AssignmentDetail }
  | { params: LoadQueryParams; status: 'error'; message: string; kind: LoadErrorKind }

type QuestionFilterFormState = {
  category: string
  level: QuestionLevel | ''
  status: QuestionStatus | ''
  keyword: string
}

const EMPTY_QUESTION_FILTERS: QuestionFilterFormState = { category: '', level: '', status: '', keyword: '' }

type QuestionQueryParams = { appliedFilters: QuestionFilterFormState; page: number; retryToken: number }

type QuestionFetchResult =
  | {
      params: QuestionQueryParams
      status: 'success'
      items: QuestionListItem[]
      totalPages: number
      totalElements: number
    }
  | { params: QuestionQueryParams; status: 'error'; message: string }

// Route params are always strings; only positive integers are valid assignment IDs.
function parseAssignmentId(raw: string | undefined): number | null {
  if (!raw || !/^\d+$/.test(raw)) {
    return null
  }
  const id = Number(raw)
  return Number.isSafeInteger(id) && id > 0 ? id : null
}

function validate(state: {
  targetType: AssignmentTargetType
  targetGroup: string
  targetStudentId: string
  startDate: string
  dueDate: string
  selectedQuestions: SelectedQuestion[]
}): FormErrors {
  const errors: FormErrors = {}

  if (state.targetType === 'CLASS') {
    if (!state.targetGroup.trim()) {
      errors.targetGroup = '반 이름을 입력하세요.'
    }
  } else {
    const raw = state.targetStudentId.trim()
    if (!raw || !/^\d+$/.test(raw) || Number(raw) <= 0) {
      errors.targetStudentId = '유효한 학생 ID를 입력하세요.'
    }
  }

  if (!state.startDate) {
    errors.startDate = '시작일을 선택하세요.'
  }
  if (!state.dueDate) {
    errors.dueDate = '마감일을 선택하세요.'
  }
  if (state.startDate && state.dueDate && state.startDate > state.dueDate) {
    errors.dueDate = '시작일은 마감일보다 늦을 수 없습니다.'
  }

  if (state.selectedQuestions.length === 0) {
    errors.questions = '문제를 1개 이상 선택하세요.'
  }

  return errors
}

function AssignmentEditPage() {
  const { id: rawId } = useParams<{ id: string }>()
  const { session, logout } = useAuth()
  const navigate = useNavigate()

  const assignmentId = parseAssignmentId(rawId)

  const [loadRetryToken, setLoadRetryToken] = useState(0)
  const [loadResult, setLoadResult] = useState<LoadResult | null>(null)
  // The assignment whose fields have already been seeded into the form below;
  // compared by reference against a freshly loaded assignment to seed exactly
  // once per load, without a dedicated effect (see the render-time check below).
  const [seededAssignment, setSeededAssignment] = useState<AssignmentDetail | null>(null)

  const [title, setTitle] = useState('')
  const [targetType, setTargetType] = useState<AssignmentTargetType>('CLASS')
  const [targetGroup, setTargetGroup] = useState('')
  const [targetStudentId, setTargetStudentId] = useState('')
  const [startDate, setStartDate] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [selectedQuestions, setSelectedQuestions] = useState<SelectedQuestion[]>([])

  const [errors, setErrors] = useState<FormErrors>({})
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<{ message: string; expired: boolean } | null>(null)

  const [questionFormState, setQuestionFormState] = useState<QuestionFilterFormState>(EMPTY_QUESTION_FILTERS)
  const [appliedQuestionFilters, setAppliedQuestionFilters] =
    useState<QuestionFilterFormState>(EMPTY_QUESTION_FILTERS)
  const [questionPage, setQuestionPage] = useState(0)
  const [questionRetryToken, setQuestionRetryToken] = useState(0)
  const [questionResult, setQuestionResult] = useState<QuestionFetchResult | null>(null)

  const accessToken = session?.accessToken

  useEffect(() => {
    if (!accessToken || assignmentId === null) {
      return
    }

    const params: LoadQueryParams = { assignmentId, retryToken: loadRetryToken }
    let cancelled = false

    assignmentApi
      .getAssignment(accessToken, assignmentId)
      .then((assignment) => {
        if (cancelled) {
          return
        }
        setLoadResult({ params, status: 'success', assignment })
      })
      .catch((error: unknown) => {
        if (cancelled) {
          return
        }
        if (error instanceof AssignmentApiError && error.status === 401) {
          setLoadResult({ params, status: 'error', message: SESSION_EXPIRED_MESSAGE, kind: 'expired' })
        } else if (error instanceof AssignmentApiError && error.status === 403) {
          setLoadResult({ params, status: 'error', message: LOAD_FORBIDDEN_MESSAGE, kind: 'forbidden' })
        } else if (error instanceof AssignmentApiError && error.status === 404) {
          setLoadResult({ params, status: 'error', message: LOAD_NOT_FOUND_MESSAGE, kind: 'not-found' })
        } else if (error instanceof AssignmentApiError) {
          setLoadResult({ params, status: 'error', message: error.message, kind: 'generic' })
        } else {
          setLoadResult({ params, status: 'error', message: LOAD_GENERIC_ERROR_MESSAGE, kind: 'generic' })
        }
      })

    return () => {
      cancelled = true
    }
  }, [accessToken, assignmentId, loadRetryToken])

  useEffect(() => {
    if (!accessToken || assignmentId === null) {
      return
    }

    const params: QuestionQueryParams = {
      appliedFilters: appliedQuestionFilters,
      page: questionPage,
      retryToken: questionRetryToken,
    }
    let cancelled = false

    const filters = {
      page: questionPage,
      size: SEARCH_PAGE_SIZE,
      ...(appliedQuestionFilters.category.trim() ? { category: appliedQuestionFilters.category.trim() } : {}),
      ...(appliedQuestionFilters.level ? { level: appliedQuestionFilters.level } : {}),
      ...(appliedQuestionFilters.status ? { status: appliedQuestionFilters.status } : {}),
      ...(appliedQuestionFilters.keyword.trim() ? { keyword: appliedQuestionFilters.keyword.trim() } : {}),
    }

    questionApi
      .listQuestions(accessToken, filters)
      .then((response) => {
        if (cancelled) {
          return
        }
        setQuestionResult({
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
        const message = error instanceof QuestionApiError ? error.message : QUESTION_SEARCH_ERROR_MESSAGE
        setQuestionResult({ params, status: 'error', message })
      })

    return () => {
      cancelled = true
    }
  }, [accessToken, assignmentId, appliedQuestionFilters, questionPage, questionRetryToken])

  function handleQuestionFilterSubmit() {
    setAppliedQuestionFilters(questionFormState)
    setQuestionPage(0)
  }

  // The question filter fields live inside the outer <form> (a page can't
  // nest <form> elements), so Enter must be handled manually here instead of
  // relying on native submit-on-Enter, which would otherwise submit the outer
  // save form.
  function handleQuestionFilterKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter') {
      event.preventDefault()
      handleQuestionFilterSubmit()
    }
  }

  function handleQuestionFilterReset() {
    setQuestionFormState(EMPTY_QUESTION_FILTERS)
    setAppliedQuestionFilters(EMPTY_QUESTION_FILTERS)
    setQuestionPage(0)
  }

  function handleQuestionRetry() {
    setQuestionRetryToken((current) => current + 1)
  }

  // Toggling clears the opposite target field so a stale CLASS group name or
  // STUDENT id can never survive a switch and slip into the submitted payload.
  function handleTargetTypeChange(next: AssignmentTargetType) {
    setTargetType(next)
    setTargetGroup('')
    setTargetStudentId('')
    setErrors((prev) => ({ ...prev, targetGroup: undefined, targetStudentId: undefined }))
  }

  function addQuestion(question: QuestionListItem) {
    setSelectedQuestions((current) =>
      current.some((item) => item.id === question.id)
        ? current
        : [...current, { id: question.id, text: question.text, category: question.category }],
    )
  }

  function removeQuestion(id: number) {
    setSelectedQuestions((current) => current.filter((item) => item.id !== id))
  }

  function moveQuestion(index: number, direction: -1 | 1) {
    setSelectedQuestions((current) => {
      const targetIndex = index + direction
      if (targetIndex < 0 || targetIndex >= current.length) {
        return current
      }
      const next = [...current]
      ;[next[index], next[targetIndex]] = [next[targetIndex], next[index]]
      return next
    })
  }

  function handleReSignIn() {
    logout()
    navigate('/login', { replace: true })
  }

  function handleLoadRetry() {
    setLoadRetryToken((current) => current + 1)
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (assignmentId === null || !accessToken) {
      return
    }

    const formState = { targetType, targetGroup, targetStudentId, startDate, dueDate, selectedQuestions }
    const validationErrors = validate(formState)
    setErrors(validationErrors)
    setSubmitError(null)

    if (Object.keys(validationErrors).length > 0) {
      return
    }

    setSubmitting(true)
    try {
      const target =
        targetType === 'CLASS'
          ? { targetType: 'CLASS' as const, targetGroup: targetGroup.trim() }
          : { targetType: 'STUDENT' as const, targetStudentId: Number(targetStudentId.trim()) }

      await assignmentApi.updateAssignment(accessToken, assignmentId, {
        ...target,
        startDate,
        dueDate,
        questionIds: selectedQuestions.map((question) => question.id),
      })
      navigate(`/admin/assignments/${assignmentId}`)
    } catch (error) {
      if (error instanceof AssignmentApiError && error.status === 401) {
        setSubmitError({ message: SESSION_EXPIRED_MESSAGE, expired: true })
      } else if (error instanceof AssignmentApiError && error.status === 403) {
        setSubmitError({ message: SUBMIT_FORBIDDEN_MESSAGE, expired: false })
      } else if (error instanceof AssignmentApiError) {
        // Covers 400 (INVALID_ASSIGNMENT), 404 (ASSIGNMENT_NOT_FOUND), and 409
        // (ASSIGNMENT_ALREADY_CLOSED) — the server message is already the
        // correct Korean text to show as-is.
        setSubmitError({ message: error.message, expired: false })
      } else {
        setSubmitError({ message: SUBMIT_GENERIC_ERROR_MESSAGE, expired: false })
      }
    } finally {
      setSubmitting(false)
    }
  }

  if (assignmentId === null) {
    return (
      <AdminLayout active="assignments">
        <div className="assignment-edit-page">
          <div className="assignment-edit-error" role="alert">
            <p>{INVALID_ID_MESSAGE}</p>
            <Link className="assignment-edit-back-link" to="/admin/assignments">
              목록으로 돌아가기
            </Link>
          </div>
        </div>
      </AdminLayout>
    )
  }

  const isLoadCurrent =
    loadResult !== null &&
    loadResult.params.assignmentId === assignmentId &&
    loadResult.params.retryToken === loadRetryToken
  const isLoading = !isLoadCurrent
  const currentLoadResult = isLoadCurrent ? loadResult : null

  // Seeds the editable fields from the freshly loaded detail exactly once per
  // load, without a dedicated effect (an "adjusting state while rendering"
  // update: https://react.dev/learn/you-might-not-need-an-effect). React
  // re-renders immediately with the new state before committing, so the form
  // below never paints with stale/empty values.
  if (currentLoadResult?.status === 'success' && currentLoadResult.assignment !== seededAssignment) {
    const { assignment } = currentLoadResult
    setSeededAssignment(assignment)
    setTitle(assignment.title)
    setTargetType(assignment.targetType)
    setTargetGroup(assignment.targetType === 'CLASS' ? assignment.targetGroup : '')
    setTargetStudentId(assignment.targetType === 'STUDENT' ? String(assignment.targetStudentId) : '')
    setStartDate(assignment.startDate)
    setDueDate(assignment.dueDate)
    setSelectedQuestions(
      [...assignment.questions]
        .sort((a, b) => a.order - b.order)
        .map((question) => ({ id: question.id, text: question.text, category: question.category })),
    )
  }

  const isQuestionSearchCurrent =
    questionResult !== null &&
    questionResult.params.appliedFilters === appliedQuestionFilters &&
    questionResult.params.page === questionPage &&
    questionResult.params.retryToken === questionRetryToken
  const isQuestionSearchLoading = !isQuestionSearchCurrent
  const currentQuestionResult = isQuestionSearchCurrent ? questionResult : null
  const questionItems = currentQuestionResult?.status === 'success' ? currentQuestionResult.items : []
  const questionTotalPages = currentQuestionResult?.status === 'success' ? currentQuestionResult.totalPages : 0
  const questionTotalElements = currentQuestionResult?.status === 'success' ? currentQuestionResult.totalElements : 0
  const hasPrevQuestionPage = questionPage > 0
  const hasNextQuestionPage = questionPage + 1 < questionTotalPages

  return (
    <AdminLayout active="assignments">
      <div className="assignment-edit-page">
        <header className="assignment-edit-header">
          <h1>과제 수정</h1>
          <Link className="assignment-edit-back-link" to={`/admin/assignments/${assignmentId}`}>
            상세로 돌아가기
          </Link>
        </header>

        {isLoading && (
          <p className="assignment-edit-status" role="status">
            불러오는 중...
          </p>
        )}

        {currentLoadResult?.status === 'error' && (
          <div className="assignment-edit-error" role="alert">
            <p>{currentLoadResult.message}</p>
            {currentLoadResult.kind === 'expired' && (
              <Button type="button" onClick={handleReSignIn}>
                다시 로그인
              </Button>
            )}
            {currentLoadResult.kind === 'generic' && (
              <Button type="button" onClick={handleLoadRetry}>
                다시 시도
              </Button>
            )}
          </div>
        )}

        {currentLoadResult?.status === 'success' && (
          <form className="assignment-edit-form" onSubmit={handleSubmit} noValidate aria-label="과제 수정">
            <div className="assignment-edit-field">
              <span className="assignment-edit-field-label">과제명</span>
              <p className="assignment-edit-title-value">{title}</p>
            </div>

            <div className="assignment-edit-field">
              <label htmlFor="edit-target-type">대상 유형</label>
              <select
                id="edit-target-type"
                value={targetType}
                onChange={(event) => handleTargetTypeChange(event.target.value as AssignmentTargetType)}
              >
                {ASSIGNMENT_TARGET_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {TARGET_TYPE_LABELS[type]}
                  </option>
                ))}
              </select>
            </div>

            {targetType === 'CLASS' ? (
              <div className="assignment-edit-field">
                <label htmlFor="edit-target-group">반 이름</label>
                <input
                  id="edit-target-group"
                  type="text"
                  value={targetGroup}
                  onChange={(event) => setTargetGroup(event.target.value)}
                  placeholder="예: 중1 A반"
                  aria-invalid={Boolean(errors.targetGroup)}
                  aria-describedby={errors.targetGroup ? 'edit-target-group-error' : undefined}
                />
                {errors.targetGroup && (
                  <p id="edit-target-group-error" className="assignment-edit-field-error" role="alert">
                    {errors.targetGroup}
                  </p>
                )}
              </div>
            ) : (
              <div className="assignment-edit-field">
                <label htmlFor="edit-target-student-id">학생 ID</label>
                <input
                  id="edit-target-student-id"
                  type="number"
                  min="1"
                  step="1"
                  value={targetStudentId}
                  onChange={(event) => setTargetStudentId(event.target.value)}
                  aria-invalid={Boolean(errors.targetStudentId)}
                  aria-describedby={errors.targetStudentId ? 'edit-target-student-id-error' : undefined}
                />
                {errors.targetStudentId && (
                  <p id="edit-target-student-id-error" className="assignment-edit-field-error" role="alert">
                    {errors.targetStudentId}
                  </p>
                )}
              </div>
            )}

            <div className="assignment-edit-field-row">
              <div className="assignment-edit-field">
                <label htmlFor="edit-start-date">시작일</label>
                <input
                  id="edit-start-date"
                  type="date"
                  value={startDate}
                  onChange={(event) => setStartDate(event.target.value)}
                  aria-invalid={Boolean(errors.startDate)}
                  aria-describedby={errors.startDate ? 'edit-start-date-error' : undefined}
                />
                {errors.startDate && (
                  <p id="edit-start-date-error" className="assignment-edit-field-error" role="alert">
                    {errors.startDate}
                  </p>
                )}
              </div>

              <div className="assignment-edit-field">
                <label htmlFor="edit-due-date">마감일</label>
                <input
                  id="edit-due-date"
                  type="date"
                  value={dueDate}
                  onChange={(event) => setDueDate(event.target.value)}
                  aria-invalid={Boolean(errors.dueDate)}
                  aria-describedby={errors.dueDate ? 'edit-due-date-error' : undefined}
                />
                {errors.dueDate && (
                  <p id="edit-due-date-error" className="assignment-edit-field-error" role="alert">
                    {errors.dueDate}
                  </p>
                )}
              </div>
            </div>

            <section className="assignment-edit-section">
              <h2>문제 검색</h2>

              <div
                className="assignment-question-filter-form"
                role="search"
                aria-label="문제 검색 필터"
              >
                <div className="assignment-question-filter-field">
                  <label htmlFor="edit-question-search-category">카테고리</label>
                  <input
                    id="edit-question-search-category"
                    type="text"
                    value={questionFormState.category}
                    onChange={(event) =>
                      setQuestionFormState((prev) => ({ ...prev, category: event.target.value }))
                    }
                    onKeyDown={handleQuestionFilterKeyDown}
                    placeholder="예: 현재완료"
                  />
                </div>

                <div className="assignment-question-filter-field">
                  <label htmlFor="edit-question-search-level">난이도</label>
                  <select
                    id="edit-question-search-level"
                    value={questionFormState.level}
                    onChange={(event) =>
                      setQuestionFormState((prev) => ({ ...prev, level: event.target.value as QuestionLevel | '' }))
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

                <div className="assignment-question-filter-field">
                  <label htmlFor="edit-question-search-status">상태</label>
                  <select
                    id="edit-question-search-status"
                    value={questionFormState.status}
                    onChange={(event) =>
                      setQuestionFormState((prev) => ({ ...prev, status: event.target.value as QuestionStatus | '' }))
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

                <div className="assignment-question-filter-field assignment-question-filter-field-keyword">
                  <label htmlFor="edit-question-search-keyword">키워드</label>
                  <input
                    id="edit-question-search-keyword"
                    type="text"
                    value={questionFormState.keyword}
                    onChange={(event) =>
                      setQuestionFormState((prev) => ({ ...prev, keyword: event.target.value }))
                    }
                    onKeyDown={handleQuestionFilterKeyDown}
                    placeholder="문제 본문 검색"
                  />
                </div>

                <div className="assignment-question-filter-actions">
                  <Button type="button" onClick={handleQuestionFilterSubmit}>
                    검색
                  </Button>
                  <Button type="button" variant="secondary" onClick={handleQuestionFilterReset}>
                    초기화
                  </Button>
                </div>
              </div>

              <div className="assignment-question-search-content" aria-live="polite">
                {isQuestionSearchLoading && (
                  <p className="assignment-question-search-status" role="status">
                    불러오는 중...
                  </p>
                )}

                {currentQuestionResult?.status === 'error' && (
                  <div className="assignment-question-search-error" role="alert">
                    <p>{currentQuestionResult.message}</p>
                    <Button type="button" onClick={handleQuestionRetry}>
                      다시 시도
                    </Button>
                  </div>
                )}

                {currentQuestionResult?.status === 'success' && questionItems.length === 0 && (
                  <p className="assignment-question-search-empty">조건에 맞는 문제가 없습니다.</p>
                )}

                {currentQuestionResult?.status === 'success' && questionItems.length > 0 && (
                  <>
                    <table className="assignment-question-search-table">
                      <caption className="sr-only">문제 검색 결과</caption>
                      <thead>
                        <tr>
                          <th scope="col">ID</th>
                          <th scope="col">카테고리</th>
                          <th scope="col">난이도</th>
                          <th scope="col">문제 내용</th>
                          <th scope="col">추가</th>
                        </tr>
                      </thead>
                      <tbody>
                        {questionItems.map((item) => {
                          const isSelected = selectedQuestions.some((question) => question.id === item.id)
                          return (
                            <tr key={item.id}>
                              <td>{item.id}</td>
                              <td>{item.category}</td>
                              <td>{QUESTION_LEVEL_LABELS[item.level]}</td>
                              <td className="assignment-question-search-text">{item.text}</td>
                              <td>
                                <Button
                                  type="button"
                                  variant="secondary"
                                  onClick={() => addQuestion(item)}
                                  disabled={isSelected}
                                >
                                  {isSelected ? '추가됨' : '추가'}
                                </Button>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>

                    <nav className="assignment-question-search-pagination" aria-label="문제 검색 페이지 이동">
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={() => setQuestionPage((current) => current - 1)}
                        disabled={!hasPrevQuestionPage}
                      >
                        이전
                      </Button>
                      <span className="assignment-question-search-pagination-status">
                        {questionPage + 1} / {Math.max(questionTotalPages, 1)} 페이지 · 총 {questionTotalElements}건
                      </span>
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={() => setQuestionPage((current) => current + 1)}
                        disabled={!hasNextQuestionPage}
                      >
                        다음
                      </Button>
                    </nav>
                  </>
                )}
              </div>
            </section>

            <section className="assignment-edit-section">
              <h2>{`선택한 문제 (${selectedQuestions.length}개)`}</h2>

              {errors.questions && (
                <p className="assignment-edit-field-error" role="alert">
                  {errors.questions}
                </p>
              )}

              {selectedQuestions.length === 0 ? (
                <p className="assignment-selected-questions-empty">위 검색 결과에서 문제를 추가하세요.</p>
              ) : (
                <table className="assignment-selected-questions-table">
                  <caption className="sr-only">선택한 문제 목록</caption>
                  <thead>
                    <tr>
                      <th scope="col">순서</th>
                      <th scope="col">문제</th>
                      <th scope="col">카테고리</th>
                      <th scope="col">이동</th>
                      <th scope="col">삭제</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedQuestions.map((question, index) => (
                      <tr key={question.id}>
                        <td>{index + 1}</td>
                        <td className="assignment-selected-questions-text">{question.text}</td>
                        <td>{question.category}</td>
                        <td>
                          <div className="assignment-selected-questions-move">
                            <Button
                              type="button"
                              variant="secondary"
                              onClick={() => moveQuestion(index, -1)}
                              disabled={index === 0}
                              aria-label={`${question.text} 위로 이동`}
                            >
                              위로
                            </Button>
                            <Button
                              type="button"
                              variant="secondary"
                              onClick={() => moveQuestion(index, 1)}
                              disabled={index === selectedQuestions.length - 1}
                              aria-label={`${question.text} 아래로 이동`}
                            >
                              아래로
                            </Button>
                          </div>
                        </td>
                        <td>
                          <Button
                            type="button"
                            variant="secondary"
                            onClick={() => removeQuestion(question.id)}
                            aria-label={`${question.text} 삭제`}
                          >
                            삭제
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </section>

            {submitError && (
              <div className="assignment-edit-submit-error" role="alert">
                <p>{submitError.message}</p>
                {submitError.expired && (
                  <Button type="button" onClick={handleReSignIn}>
                    다시 로그인
                  </Button>
                )}
              </div>
            )}

            <div className="assignment-edit-actions">
              <Button type="submit" disabled={submitting}>
                {submitting ? '저장 중...' : '변경 사항 저장'}
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={() => navigate(`/admin/assignments/${assignmentId}`)}
              >
                취소
              </Button>
            </div>
          </form>
        )}
      </div>
    </AdminLayout>
  )
}

export default AssignmentEditPage
