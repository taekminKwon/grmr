import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { MyAssignmentApiError, myAssignmentApi } from '../api/myAssignmentApi'
import type { MyAssignmentQuestion, SubmissionStatus } from '../api/myAssignmentApi'
import { QUESTION_LEVEL_LABELS } from '../api/questionTypes'
import { useAuth } from '../auth/useAuth'
import StudentLayout from '../components/StudentLayout'
import Button from '../components/Button'
import { formatKoreanDateTime } from '../utils/formatDateTime'
import './StudentAssignmentSolvePage.css'

const LOAD_GENERIC_ERROR_MESSAGE = '문제를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.'
const LOAD_NOT_FOUND_MESSAGE = '과제를 찾을 수 없습니다.'
const LOAD_SESSION_EXPIRED_MESSAGE = '세션이 만료되었습니다. 다시 로그인해주세요.'
const LOAD_FORBIDDEN_MESSAGE = '과제를 조회할 권한이 없습니다. 학생 계정으로 로그인했는지 확인해주세요.'
const INVALID_ID_MESSAGE = '잘못된 과제 번호입니다.'
const SAVE_GENERIC_ERROR_MESSAGE = '답안을 저장하지 못했습니다. 다시 시도해주세요.'
const SAVE_SESSION_EXPIRED_MESSAGE = '세션이 만료되어 답안을 저장하지 못했습니다.'
const SAVE_FORBIDDEN_MESSAGE = '답안을 저장할 권한이 없습니다.'
const SUBMIT_GENERIC_ERROR_MESSAGE = '과제를 제출하지 못했습니다. 잠시 후 다시 시도해주세요.'
const SUBMIT_SESSION_EXPIRED_MESSAGE = '세션이 만료되어 제출하지 못했습니다. 다시 로그인해주세요.'
const SUBMIT_FORBIDDEN_MESSAGE = '과제를 제출할 권한이 없습니다. 학생 계정으로 로그인했는지 확인해주세요.'

// Route params are always strings; only positive integers are valid assignment IDs.
function parseAssignmentId(raw: string | undefined): number | null {
  if (!raw || !/^\d+$/.test(raw)) {
    return null
  }
  const id = Number(raw)
  return Number.isSafeInteger(id) && id > 0 ? id : null
}

type LoadErrorKind = 'not-found' | 'expired' | 'forbidden' | 'generic'

type QueryParams = { assignmentId: number; retryToken: number }

type LoadResult =
  | { params: QueryParams; status: 'success'; submissionStatus: SubmissionStatus; questions: MyAssignmentQuestion[] }
  | { params: QueryParams; status: 'error'; kind: LoadErrorKind; message: string }

type SaveErrorKind = 'expired' | 'forbidden' | 'conflict' | 'generic'

type SaveState =
  | { status: 'idle' }
  | { status: 'saving' }
  | { status: 'saved'; savedAt: string }
  | { status: 'error'; kind: SaveErrorKind; message: string }

type SubmitErrorKind = 'expired' | 'forbidden' | 'closed' | 'already-submitted' | 'generic'
type SubmitError = { kind: SubmitErrorKind; message: string }

function StudentAssignmentSolvePage() {
  const { id: rawId } = useParams<{ id: string }>()
  const { session, logout } = useAuth()
  const navigate = useNavigate()

  const assignmentId = parseAssignmentId(rawId)

  const [retryToken, setRetryToken] = useState(0)
  const [load, setLoad] = useState<LoadResult | null>(null)
  const [currentIndex, setCurrentIndex] = useState(0)
  // Locally selected choice per question, used only to render the checked
  // radio — never for progress, counts, or submit gating.
  const [answers, setAnswers] = useState<Record<number, string | null>>({})
  // Last answer actually confirmed persisted by the backend (from the
  // initial load, or a successful save response). This is the only source
  // used for answered/unanswered counts and for deciding whether it is safe
  // to submit, per the contract that PostgreSQL-persisted drafts are
  // authoritative.
  const [persistedAnswers, setPersistedAnswers] = useState<Record<number, string | null>>({})
  const [saveStates, setSaveStates] = useState<Record<number, SaveState>>({})
  // Set when a save/submit conflict reveals the assignment was already
  // submitted (e.g. from another tab) even though the page's own load
  // response still said IN_PROGRESS — forces the read-only view without
  // waiting for a refetch, so no further edits can appear to "succeed".
  const [forcedSubmitted, setForcedSubmitted] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<SubmitError | null>(null)

  // Per-question save sequence counters: a save response is only applied if
  // it is still the latest one issued for that question, so a stale
  // out-of-order response can never overwrite a newer local choice.
  const saveSeqRef = useRef<Record<number, number>>({})

  const accessToken = session?.accessToken

  useEffect(() => {
    if (!accessToken || assignmentId === null) {
      return
    }

    const params: QueryParams = { assignmentId, retryToken }
    let cancelled = false

    myAssignmentApi
      .getAssignmentQuestions(accessToken, assignmentId)
      .then((response) => {
        if (cancelled) {
          return
        }
        setLoad({
          params,
          status: 'success',
          submissionStatus: response.submissionStatus,
          questions: response.questions,
        })

        const initialAnswers: Record<number, string | null> = {}
        response.questions.forEach((question) => {
          initialAnswers[question.id] = question.myAnswer
        })
        setAnswers(initialAnswers)
        // Load data is already persisted per the contract, so it seeds
        // both the local selection and the authoritative persisted state.
        setPersistedAnswers(initialAnswers)
        setSaveStates({})
        saveSeqRef.current = {}
        setForcedSubmitted(false)
        setSubmitError(null)
        setConfirmOpen(false)

        // Resume at the first unanswered question (smallest order), or the
        // first question if every question already has a draft answer.
        const firstUnansweredIndex = response.questions.findIndex((question) => question.myAnswer === null)
        setCurrentIndex(firstUnansweredIndex === -1 ? 0 : firstUnansweredIndex)
      })
      .catch((error: unknown) => {
        if (cancelled) {
          return
        }
        if (error instanceof MyAssignmentApiError && error.status === 401) {
          setLoad({ params, status: 'error', kind: 'expired', message: LOAD_SESSION_EXPIRED_MESSAGE })
        } else if (error instanceof MyAssignmentApiError && error.status === 403) {
          setLoad({ params, status: 'error', kind: 'forbidden', message: LOAD_FORBIDDEN_MESSAGE })
        } else if (error instanceof MyAssignmentApiError && error.status === 404) {
          setLoad({ params, status: 'error', kind: 'not-found', message: LOAD_NOT_FOUND_MESSAGE })
        } else if (error instanceof MyAssignmentApiError) {
          setLoad({ params, status: 'error', kind: 'generic', message: error.message })
        } else {
          setLoad({ params, status: 'error', kind: 'generic', message: LOAD_GENERIC_ERROR_MESSAGE })
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

  function handleRetryLoad() {
    setRetryToken((current) => current + 1)
  }

  function saveDraft(questionId: number, choice: string) {
    if (!accessToken || assignmentId === null) {
      return
    }
    const seq = (saveSeqRef.current[questionId] ?? 0) + 1
    saveSeqRef.current[questionId] = seq
    setSaveStates((prev) => ({ ...prev, [questionId]: { status: 'saving' } }))

    myAssignmentApi
      .saveAnswer(accessToken, assignmentId, questionId, { answer: choice })
      .then((result) => {
        // A newer save for this question has already been issued; this
        // response is stale and must not overwrite the newer state.
        if (saveSeqRef.current[questionId] !== seq) {
          return
        }
        setSaveStates((prev) => ({ ...prev, [questionId]: { status: 'saved', savedAt: result.savedAt } }))
        setPersistedAnswers((prev) => ({ ...prev, [questionId]: result.answer }))
      })
      .catch((error: unknown) => {
        if (saveSeqRef.current[questionId] !== seq) {
          return
        }
        if (error instanceof MyAssignmentApiError && error.status === 401) {
          setSaveStates((prev) => ({
            ...prev,
            [questionId]: { status: 'error', kind: 'expired', message: SAVE_SESSION_EXPIRED_MESSAGE },
          }))
        } else if (error instanceof MyAssignmentApiError && error.status === 403) {
          setSaveStates((prev) => ({
            ...prev,
            [questionId]: { status: 'error', kind: 'forbidden', message: SAVE_FORBIDDEN_MESSAGE },
          }))
        } else if (error instanceof MyAssignmentApiError && error.status === 409) {
          // ASSIGNMENT_CLOSED or ASSIGNMENT_ALREADY_SUBMITTED: either way the
          // draft was not actually persisted, so this must never look like a
          // successful save.
          setSaveStates((prev) => ({
            ...prev,
            [questionId]: { status: 'error', kind: 'conflict', message: error.message },
          }))
          if (error.code === 'ASSIGNMENT_ALREADY_SUBMITTED') {
            setForcedSubmitted(true)
          }
        } else if (error instanceof MyAssignmentApiError) {
          setSaveStates((prev) => ({
            ...prev,
            [questionId]: { status: 'error', kind: 'generic', message: error.message },
          }))
        } else {
          setSaveStates((prev) => ({
            ...prev,
            [questionId]: { status: 'error', kind: 'generic', message: SAVE_GENERIC_ERROR_MESSAGE },
          }))
        }
      })
  }

  function handleSelectAnswer(questionId: number, choice: string) {
    setAnswers((prev) => ({ ...prev, [questionId]: choice }))
    saveDraft(questionId, choice)
  }

  function handleRetrySave(questionId: number) {
    const choice = answers[questionId]
    if (!choice) {
      return
    }
    saveDraft(questionId, choice)
  }

  function handleOpenConfirm() {
    // Defensive: the trigger button is already disabled while a save is
    // pending or failed, but this guard keeps the dialog from ever opening
    // out of sync with that state.
    if (hasUnsavedChanges) {
      return
    }
    setSubmitError(null)
    setConfirmOpen(true)
  }

  function handleCancelConfirm() {
    setConfirmOpen(false)
    setSubmitError(null)
  }

  function handleConfirmSubmit() {
    // Never submit while a draft save is still in flight or has failed —
    // the backend would grade whatever it already has persisted, which may
    // not include the student's latest selection.
    if (!accessToken || assignmentId === null || submitting || hasUnsavedChanges) {
      return
    }
    setSubmitting(true)
    setSubmitError(null)

    myAssignmentApi
      .submitAssignment(accessToken, assignmentId)
      .then((result) => {
        navigate(`/student/assignments/${assignmentId}/result`, { state: { result } })
      })
      .catch((error: unknown) => {
        if (error instanceof MyAssignmentApiError && error.status === 401) {
          setSubmitError({ kind: 'expired', message: SUBMIT_SESSION_EXPIRED_MESSAGE })
        } else if (error instanceof MyAssignmentApiError && error.status === 403) {
          setSubmitError({ kind: 'forbidden', message: SUBMIT_FORBIDDEN_MESSAGE })
        } else if (error instanceof MyAssignmentApiError && error.code === 'ASSIGNMENT_CLOSED') {
          setSubmitError({ kind: 'closed', message: error.message })
        } else if (error instanceof MyAssignmentApiError && error.code === 'ASSIGNMENT_ALREADY_SUBMITTED') {
          setForcedSubmitted(true)
          setConfirmOpen(false)
          setSubmitError({ kind: 'already-submitted', message: error.message })
        } else if (error instanceof MyAssignmentApiError) {
          setSubmitError({ kind: 'generic', message: error.message })
        } else {
          setSubmitError({ kind: 'generic', message: SUBMIT_GENERIC_ERROR_MESSAGE })
        }
      })
      .finally(() => {
        setSubmitting(false)
      })
  }

  const isCurrent =
    load !== null &&
    assignmentId !== null &&
    load.params.assignmentId === assignmentId &&
    load.params.retryToken === retryToken
  const isLoading = assignmentId !== null && !isCurrent
  const currentLoad = isCurrent ? load : null

  const questions = currentLoad?.status === 'success' ? currentLoad.questions : []
  const totalCount = questions.length
  // Persisted-only: an optimistic local selection must never inflate the
  // answered count or unblock submission before the backend confirms it.
  const answeredCount = questions.filter((question) => persistedAnswers[question.id] != null).length
  const unansweredCount = totalCount - answeredCount
  const progressPercent = totalCount === 0 ? 0 : Math.round((answeredCount / totalCount) * 100)

  // Questions whose latest save attempt is still in flight or has failed.
  // Final submission must never race a pending save or count a failed one,
  // so these gate both opening and confirming the submit dialog.
  const pendingQuestions = questions.filter((question) => saveStates[question.id]?.status === 'saving')
  const failedQuestions = questions.filter((question) => saveStates[question.id]?.status === 'error')
  const hasUnsavedChanges = pendingQuestions.length > 0 || failedQuestions.length > 0

  const readOnly = currentLoad?.status === 'success' && (currentLoad.submissionStatus === 'SUBMITTED' || forcedSubmitted)

  const safeIndex = Math.min(currentIndex, Math.max(totalCount - 1, 0))
  const currentQuestion = totalCount > 0 ? questions[safeIndex] : null
  const currentSaveState: SaveState = currentQuestion
    ? (saveStates[currentQuestion.id] ?? { status: 'idle' })
    : { status: 'idle' }

  function handlePrev() {
    setCurrentIndex((index) => Math.max(0, index - 1))
  }

  function handleNext() {
    setCurrentIndex((index) => Math.min(totalCount - 1, index + 1))
  }

  return (
    <StudentLayout active="assignments">
      <div className="assignment-solve-page">
        {assignmentId === null && (
          <div className="assignment-solve-error" role="alert">
            <p>{INVALID_ID_MESSAGE}</p>
            <Link className="assignment-solve-back-link" to="/student/assignments">
              목록으로 돌아가기
            </Link>
          </div>
        )}

        {assignmentId !== null && isLoading && (
          <p className="assignment-solve-status" role="status">
            불러오는 중...
          </p>
        )}

        {currentLoad?.status === 'error' && (
          <div className="assignment-solve-error" role="alert">
            <p>{currentLoad.message}</p>
            {currentLoad.kind === 'expired' && (
              <Button type="button" onClick={handleReSignIn}>
                다시 로그인
              </Button>
            )}
            {currentLoad.kind === 'generic' && (
              <Button type="button" onClick={handleRetryLoad}>
                다시 시도
              </Button>
            )}
            {(currentLoad.kind === 'not-found' || currentLoad.kind === 'forbidden') && (
              <Link className="assignment-solve-back-link" to="/student/assignments">
                목록으로 돌아가기
              </Link>
            )}
          </div>
        )}

        {currentLoad?.status === 'success' && currentQuestion && (
          <>
            <header className="assignment-solve-header">
              <h1>과제 풀이</h1>
              {readOnly ? (
                <div className="assignment-solve-submitted-banner" role="status">
                  <p>이미 제출된 과제입니다. 답안을 더 이상 수정할 수 없습니다.</p>
                  <Button type="button" onClick={() => navigate(`/student/assignments/${assignmentId}/result`)}>
                    결과 보기
                  </Button>
                </div>
              ) : (
                <div className="assignment-solve-progress" aria-live="polite">
                  <span className="assignment-solve-progress-track">
                    <span className="assignment-solve-progress-fill" style={{ width: `${progressPercent}%` }} />
                  </span>
                  <span className="assignment-solve-progress-label">
                    답변 완료 {answeredCount} / {totalCount}문항 ({progressPercent}%)
                  </span>
                </div>
              )}
            </header>

            <nav className="assignment-solve-navigator" aria-label="문항 이동">
              {questions.map((question, index) => {
                const answered = persistedAnswers[question.id] != null
                const hasSaveError = saveStates[question.id]?.status === 'error'
                const isCurrentQuestion = index === safeIndex
                const classNames = [
                  'assignment-solve-nav-item',
                  answered ? 'assignment-solve-nav-item-answered' : 'assignment-solve-nav-item-unanswered',
                  isCurrentQuestion ? 'assignment-solve-nav-item-current' : '',
                  hasSaveError ? 'assignment-solve-nav-item-error' : '',
                ]
                  .filter(Boolean)
                  .join(' ')

                return (
                  <button
                    key={question.id}
                    type="button"
                    className={classNames}
                    aria-current={isCurrentQuestion ? 'true' : undefined}
                    aria-label={`${question.order}번 문항, ${answered ? '답변 완료' : '미답변'}`}
                    onClick={() => setCurrentIndex(index)}
                  >
                    {question.order}
                  </button>
                )
              })}
            </nav>

            <section className="assignment-solve-question-card">
              <p className="assignment-solve-question-meta">
                {currentQuestion.category} · {QUESTION_LEVEL_LABELS[currentQuestion.level]} · {currentQuestion.order}/
                {totalCount}
              </p>
              <p className="assignment-solve-question-text">{currentQuestion.text}</p>

              {/* Locked while the submit dialog is open so a change can never
                  race the persisted state the dialog is about to confirm. */}
              <fieldset className="assignment-solve-choices" disabled={readOnly || confirmOpen}>
                <legend>보기</legend>
                {currentQuestion.choices.map((choice) => (
                  <label key={choice} className="assignment-solve-choice">
                    <input
                      type="radio"
                      name={`assignment-solve-choice-${currentQuestion.id}`}
                      value={choice}
                      checked={answers[currentQuestion.id] === choice}
                      onChange={() => handleSelectAnswer(currentQuestion.id, choice)}
                      disabled={readOnly || confirmOpen}
                    />
                    <span>{choice}</span>
                  </label>
                ))}
              </fieldset>

              {!readOnly && (
                <div className="assignment-solve-save-status" aria-live="polite">
                  {currentSaveState.status === 'saving' && <span>저장 중...</span>}
                  {currentSaveState.status === 'saved' && (
                    <span>저장됨 · {formatKoreanDateTime(currentSaveState.savedAt)}</span>
                  )}
                  {currentSaveState.status === 'error' && (
                    <div className="assignment-solve-save-error" role="alert">
                      <span>{currentSaveState.message}</span>
                      {currentSaveState.kind === 'expired' ? (
                        <Button type="button" onClick={handleReSignIn}>
                          다시 로그인
                        </Button>
                      ) : (
                        <Button type="button" onClick={() => handleRetrySave(currentQuestion.id)}>
                          다시 저장
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              )}
            </section>

            {!readOnly && hasUnsavedChanges && (
              <div className="assignment-solve-unsaved-banner" role="alert">
                <p>모든 답안이 저장된 후에 제출할 수 있습니다.</p>
                <ul>
                  {pendingQuestions.map((question) => (
                    <li key={question.id}>{question.order}번 문항 저장 중...</li>
                  ))}
                  {failedQuestions.map((question) => (
                    <li key={question.id}>
                      <span>{question.order}번 문항 저장 실패</span>
                      <Button type="button" onClick={() => handleRetrySave(question.id)}>
                        다시 저장
                      </Button>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="assignment-solve-nav-actions">
              <Button type="button" variant="secondary" onClick={handlePrev} disabled={safeIndex === 0}>
                이전 문제
              </Button>
              <Button type="button" variant="secondary" onClick={handleNext} disabled={safeIndex === totalCount - 1}>
                다음 문제
              </Button>
              {!readOnly && (
                <Button type="button" onClick={handleOpenConfirm} disabled={hasUnsavedChanges}>
                  제출하기
                </Button>
              )}
            </div>

            {confirmOpen && (
              <div className="assignment-solve-confirm-overlay">
                <div
                  role="dialog"
                  aria-modal="true"
                  aria-labelledby="assignment-solve-confirm-title"
                  className="assignment-solve-confirm-dialog"
                >
                  <h2 id="assignment-solve-confirm-title">과제를 제출하시겠습니까?</h2>
                  <p>
                    답변 완료 {answeredCount}문항 · 미답변 {unansweredCount}문항
                  </p>
                  <p className="assignment-solve-confirm-note">제출 후에는 답안을 수정할 수 없습니다.</p>

                  {submitError && submitError.kind !== 'already-submitted' && (
                    <div className="assignment-solve-submit-error" role="alert">
                      <p>{submitError.message}</p>
                      {submitError.kind === 'expired' && (
                        <Button type="button" onClick={handleReSignIn}>
                          다시 로그인
                        </Button>
                      )}
                    </div>
                  )}

                  <div className="assignment-solve-confirm-actions">
                    <Button type="button" variant="secondary" onClick={handleCancelConfirm} disabled={submitting}>
                      취소
                    </Button>
                    <Button type="button" onClick={handleConfirmSubmit} disabled={submitting || hasUnsavedChanges}>
                      {submitting ? '제출 중...' : '제출 확정'}
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {!confirmOpen && submitError && (
              <div className="assignment-solve-submit-error" role="alert">
                <p>{submitError.message}</p>
                {submitError.kind === 'expired' && (
                  <Button type="button" onClick={handleReSignIn}>
                    다시 로그인
                  </Button>
                )}
                {submitError.kind === 'already-submitted' && (
                  <Button type="button" onClick={() => navigate(`/student/assignments/${assignmentId}/result`)}>
                    결과 보기
                  </Button>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </StudentLayout>
  )
}

export default StudentAssignmentSolvePage
