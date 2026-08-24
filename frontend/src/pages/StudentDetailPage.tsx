import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { StudentApiError, studentApi } from '../api/studentApi'
import {
  STUDY_RECORD_PERIODS,
  STUDY_RECORD_TYPES,
  STUDY_RECORD_TYPE_LABELS,
  type StudentDetail,
  type StudyRecordPeriod,
  type StudyRecordRollup,
  type StudyRecordType,
} from '../api/studentTypes'
import { useAuth } from '../auth/useAuth'
import AdminLayout from '../components/AdminLayout'
import Button from '../components/Button'
import './StudentDetailPage.css'

const PAGE_SIZE = 20

const GENERIC_ERROR_MESSAGE = '학생 정보를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.'
const NOT_FOUND_MESSAGE = '학생을 찾을 수 없습니다.'
const FORBIDDEN_MESSAGE = '학생 정보를 조회할 권한이 없습니다. 관리자 계정으로 로그인했는지 확인해주세요.'
const SESSION_EXPIRED_MESSAGE = '세션이 만료되었습니다. 다시 로그인해주세요.'
const INVALID_ID_MESSAGE = '잘못된 학생 번호입니다.'

const HISTORY_GENERIC_ERROR_MESSAGE = '학습 이력을 불러오지 못했습니다. 잠시 후 다시 시도해주세요.'
const HISTORY_FORBIDDEN_MESSAGE = '학습 이력을 조회할 권한이 없습니다. 관리자 계정으로 로그인했는지 확인해주세요.'

const NO_GROUP_LABEL = '미배정'
const NEVER_STUDIED_LABEL = '학습 기록 없음'

const PERIOD_LABELS: Readonly<Record<StudyRecordPeriod, string>> = {
  '7d': '최근 7일',
  '30d': '최근 30일',
}

type FilterFormState = { period: StudyRecordPeriod; type: StudyRecordType | '' }

const DEFAULT_FILTERS: FilterFormState = { period: '30d', type: '' }

type ErrorKind = 'expired' | 'forbidden' | 'not-found' | 'generic'

// Route params are always strings; only positive integers are valid student IDs.
function parseStudentId(raw: string | undefined): number | null {
  if (!raw || !/^\d+$/.test(raw)) {
    return null
  }
  const id = Number(raw)
  return Number.isSafeInteger(id) && id > 0 ? id : null
}

type StudentQueryParams = { studentId: number; retryToken: number }

type StudentFetchResult =
  | { params: StudentQueryParams; status: 'success'; student: StudentDetail }
  | { params: StudentQueryParams; status: 'error'; message: string; kind: ErrorKind }

type HistoryQueryParams = {
  studentId: number
  appliedFilters: FilterFormState
  page: number
  retryToken: number
}

type HistoryFetchResult =
  | {
      params: HistoryQueryParams
      status: 'success'
      items: StudyRecordRollup[]
      totalPages: number
      totalElements: number
    }
  | { params: HistoryQueryParams; status: 'error'; message: string; kind: ErrorKind }

function StudentDetailPage() {
  const { id: rawId } = useParams<{ id: string }>()
  const { session, logout } = useAuth()
  const navigate = useNavigate()

  const studentId = parseStudentId(rawId)

  const [studentRetryToken, setStudentRetryToken] = useState(0)
  const [studentResult, setStudentResult] = useState<StudentFetchResult | null>(null)

  const [formState, setFormState] = useState<FilterFormState>(DEFAULT_FILTERS)
  const [appliedFilters, setAppliedFilters] = useState<FilterFormState>(DEFAULT_FILTERS)
  const [page, setPage] = useState(0)
  const [historyRetryToken, setHistoryRetryToken] = useState(0)
  const [historyResult, setHistoryResult] = useState<HistoryFetchResult | null>(null)

  const accessToken = session?.accessToken

  useEffect(() => {
    if (!accessToken || studentId === null) {
      return
    }

    const params: StudentQueryParams = { studentId, retryToken: studentRetryToken }
    let cancelled = false

    studentApi
      .getStudent(accessToken, studentId)
      .then((student) => {
        if (cancelled) {
          return
        }
        setStudentResult({ params, status: 'success', student })
      })
      .catch((error: unknown) => {
        if (cancelled) {
          return
        }
        if (error instanceof StudentApiError && error.status === 401) {
          setStudentResult({ params, status: 'error', message: SESSION_EXPIRED_MESSAGE, kind: 'expired' })
        } else if (error instanceof StudentApiError && error.status === 403) {
          setStudentResult({ params, status: 'error', message: FORBIDDEN_MESSAGE, kind: 'forbidden' })
        } else if (error instanceof StudentApiError && error.status === 404) {
          setStudentResult({ params, status: 'error', message: NOT_FOUND_MESSAGE, kind: 'not-found' })
        } else if (error instanceof StudentApiError) {
          setStudentResult({ params, status: 'error', message: error.message, kind: 'generic' })
        } else {
          setStudentResult({ params, status: 'error', message: GENERIC_ERROR_MESSAGE, kind: 'generic' })
        }
      })

    return () => {
      cancelled = true
    }
  }, [accessToken, studentId, studentRetryToken])

  const studentIsCurrent =
    studentResult !== null &&
    studentResult.params.studentId === studentId &&
    studentResult.params.retryToken === studentRetryToken
  const isStudentLoading = studentId !== null && !studentIsCurrent
  const currentStudentResult = studentIsCurrent ? studentResult : null
  const studentLoaded = currentStudentResult?.status === 'success'

  useEffect(() => {
    if (!accessToken || studentId === null || !studentLoaded) {
      return
    }

    const params: HistoryQueryParams = { studentId, appliedFilters, page, retryToken: historyRetryToken }
    let cancelled = false

    studentApi
      .listStudyRecords(accessToken, {
        studentId,
        period: appliedFilters.period,
        page,
        size: PAGE_SIZE,
        ...(appliedFilters.type ? { type: appliedFilters.type } : {}),
      })
      .then((response) => {
        if (cancelled) {
          return
        }
        setHistoryResult({
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
          setHistoryResult({ params, status: 'error', message: SESSION_EXPIRED_MESSAGE, kind: 'expired' })
        } else if (error instanceof StudentApiError && error.status === 403) {
          setHistoryResult({ params, status: 'error', message: HISTORY_FORBIDDEN_MESSAGE, kind: 'forbidden' })
        } else if (error instanceof StudentApiError && error.status === 404) {
          setHistoryResult({ params, status: 'error', message: NOT_FOUND_MESSAGE, kind: 'not-found' })
        } else if (error instanceof StudentApiError) {
          setHistoryResult({ params, status: 'error', message: error.message, kind: 'generic' })
        } else {
          setHistoryResult({ params, status: 'error', message: HISTORY_GENERIC_ERROR_MESSAGE, kind: 'generic' })
        }
      })

    return () => {
      cancelled = true
    }
  }, [accessToken, studentId, studentLoaded, appliedFilters, page, historyRetryToken])

  function handleFilterSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setAppliedFilters(formState)
    setPage(0)
  }

  function handleFilterReset() {
    setFormState(DEFAULT_FILTERS)
    setAppliedFilters(DEFAULT_FILTERS)
    setPage(0)
  }

  function handleReSignIn() {
    logout()
    navigate('/login', { replace: true })
  }

  function handleStudentRetry() {
    setStudentRetryToken((current) => current + 1)
  }

  function handleHistoryRetry() {
    setHistoryRetryToken((current) => current + 1)
  }

  if (studentId === null) {
    return (
      <AdminLayout active="students">
        <div className="student-detail-page">
          <div className="student-detail-error" role="alert">
            <p>{INVALID_ID_MESSAGE}</p>
            <Link className="student-detail-back-link" to="/admin/students">
              목록으로 돌아가기
            </Link>
          </div>
        </div>
      </AdminLayout>
    )
  }

  const historyIsCurrent =
    historyResult !== null &&
    historyResult.params.studentId === studentId &&
    historyResult.params.appliedFilters === appliedFilters &&
    historyResult.params.page === page &&
    historyResult.params.retryToken === historyRetryToken
  const isHistoryLoading = studentLoaded && !historyIsCurrent
  const currentHistoryResult = historyIsCurrent ? historyResult : null
  const historyItems = currentHistoryResult?.status === 'success' ? currentHistoryResult.items : []
  const totalPages = currentHistoryResult?.status === 'success' ? currentHistoryResult.totalPages : 0
  const totalElements = currentHistoryResult?.status === 'success' ? currentHistoryResult.totalElements : 0
  const hasPrevPage = page > 0
  const hasNextPage = page + 1 < totalPages

  return (
    <AdminLayout active="students">
      <div className="student-detail-page">
        <header className="student-detail-header">
          <h1>학생 상세</h1>
          <Link className="student-detail-back-link" to="/admin/students">
            목록으로 돌아가기
          </Link>
        </header>

        {isStudentLoading && (
          <p className="student-detail-status" role="status">
            불러오는 중...
          </p>
        )}

        {currentStudentResult?.status === 'error' && (
          <div className="student-detail-error" role="alert">
            <p>{currentStudentResult.message}</p>
            {currentStudentResult.kind === 'expired' && (
              <Button type="button" onClick={handleReSignIn}>
                다시 로그인
              </Button>
            )}
            {currentStudentResult.kind === 'generic' && (
              <Button type="button" onClick={handleStudentRetry}>
                다시 시도
              </Button>
            )}
          </div>
        )}

        {currentStudentResult?.status === 'success' && (
          <>
            <div className="student-detail-card">
              <dl className="student-detail-meta">
                <div>
                  <dt>이름</dt>
                  <dd>{currentStudentResult.student.name}</dd>
                </div>
                <div>
                  <dt>그룹</dt>
                  <dd>
                    {currentStudentResult.student.studentGroup ?? (
                      <span className="student-detail-cell-muted">{NO_GROUP_LABEL}</span>
                    )}
                  </dd>
                </div>
                <div>
                  <dt>최근 학습일</dt>
                  <dd>
                    {currentStudentResult.student.lastStudiedAt ?? (
                      <span className="student-detail-cell-muted">{NEVER_STUDIED_LABEL}</span>
                    )}
                  </dd>
                </div>
                <div>
                  <dt>누적 문제 수</dt>
                  <dd>{currentStudentResult.student.totalQuestionCount}</dd>
                </div>
                <div>
                  <dt>정답률</dt>
                  <dd>{currentStudentResult.student.accuracy}%</dd>
                </div>
                <div>
                  <dt>미제출 과제</dt>
                  <dd>{currentStudentResult.student.pendingAssignmentCount}</dd>
                </div>
              </dl>
            </div>

            <section className="student-detail-history">
              <h2>학습 이력</h2>

              <form
                className="student-detail-filter-form"
                onSubmit={handleFilterSubmit}
                aria-label="학습 이력 검색 필터"
              >
                <div className="student-detail-filter-field">
                  <label htmlFor="history-filter-period">기간</label>
                  <select
                    id="history-filter-period"
                    value={formState.period}
                    onChange={(event) =>
                      setFormState((prev) => ({ ...prev, period: event.target.value as StudyRecordPeriod }))
                    }
                  >
                    {STUDY_RECORD_PERIODS.map((period) => (
                      <option key={period} value={period}>
                        {PERIOD_LABELS[period]}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="student-detail-filter-field">
                  <label htmlFor="history-filter-type">유형</label>
                  <select
                    id="history-filter-type"
                    value={formState.type}
                    onChange={(event) =>
                      setFormState((prev) => ({ ...prev, type: event.target.value as StudyRecordType | '' }))
                    }
                  >
                    <option value="">전체</option>
                    {STUDY_RECORD_TYPES.map((type) => (
                      <option key={type} value={type}>
                        {STUDY_RECORD_TYPE_LABELS[type]}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="student-detail-filter-actions">
                  <Button type="submit">검색</Button>
                  <Button type="button" variant="secondary" onClick={handleFilterReset}>
                    초기화
                  </Button>
                </div>
              </form>

              <div className="student-detail-history-content" aria-live="polite">
                {isHistoryLoading && (
                  <p className="student-detail-status" role="status">
                    불러오는 중...
                  </p>
                )}

                {currentHistoryResult?.status === 'error' && (
                  <div className="student-detail-error" role="alert">
                    <p>{currentHistoryResult.message}</p>
                    {currentHistoryResult.kind === 'expired' && (
                      <Button type="button" onClick={handleReSignIn}>
                        다시 로그인
                      </Button>
                    )}
                    {currentHistoryResult.kind === 'generic' && (
                      <Button type="button" onClick={handleHistoryRetry}>
                        다시 시도
                      </Button>
                    )}
                  </div>
                )}

                {currentHistoryResult?.status === 'success' && historyItems.length === 0 && (
                  <p className="student-detail-empty">조건에 맞는 학습 이력이 없습니다.</p>
                )}

                {currentHistoryResult?.status === 'success' && historyItems.length > 0 && (
                  <>
                    <table className="student-detail-history-table">
                      <caption className="sr-only">학습 이력 목록</caption>
                      <thead>
                        <tr>
                          <th scope="col">날짜</th>
                          <th scope="col">유형</th>
                          <th scope="col">문제 수</th>
                          <th scope="col">정답 수</th>
                          <th scope="col">정답률</th>
                          <th scope="col">소요 시간(분)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {historyItems.map((item) => (
                          <tr key={`${item.date}-${item.type}`}>
                            <td>{item.date}</td>
                            <td>{STUDY_RECORD_TYPE_LABELS[item.type]}</td>
                            <td>{item.questionCount}</td>
                            <td>{item.correctCount}</td>
                            <td>{item.accuracy}%</td>
                            <td>{item.durationMinutes}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>

                    <nav className="student-detail-pagination" aria-label="페이지 이동">
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={() => setPage((current) => current - 1)}
                        disabled={!hasPrevPage}
                      >
                        이전
                      </Button>
                      <span className="student-detail-pagination-status">
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
              </div>
            </section>
          </>
        )}
      </div>
    </AdminLayout>
  )
}

export default StudentDetailPage
