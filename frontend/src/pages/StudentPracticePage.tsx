import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { PracticeApiError, practiceApi } from '../api/practiceApi'
import type { PracticeAnswerResult, PracticeQuestion } from '../api/practiceApi'
import { QUESTION_LEVELS, QUESTION_LEVEL_LABELS } from '../api/questionTypes'
import type { QuestionLevel } from '../api/questionTypes'
import { useAuth } from '../auth/useAuth'
import StudentLayout from '../components/StudentLayout'
import Button from '../components/Button'
import './StudentPracticePage.css'

const LOAD_GENERIC_ERROR_MESSAGE = '문제를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.'
const LOAD_SESSION_EXPIRED_MESSAGE = '세션이 만료되었습니다. 다시 로그인해주세요.'
const LOAD_FORBIDDEN_MESSAGE = '문제를 조회할 권한이 없습니다. 학생 계정으로 로그인했는지 확인해주세요.'
const SUBMIT_GENERIC_ERROR_MESSAGE = '답안을 제출하지 못했습니다. 잠시 후 다시 시도해주세요.'
const SUBMIT_SESSION_EXPIRED_MESSAGE = '세션이 만료되었습니다. 다시 로그인해주세요.'
const SUBMIT_FORBIDDEN_MESSAGE = '답안을 제출할 권한이 없습니다. 학생 계정으로 로그인했는지 확인해주세요.'
const SELECTION_REQUIRED_MESSAGE = '보기를 선택하세요.'

type LevelFilter = QuestionLevel | ''
type FilterState = { category: string; level: LevelFilter }

const EMPTY_FILTERS: FilterState = { category: '', level: '' }

type DeliveryErrorKind = 'no-question' | 'expired' | 'forbidden' | 'generic'

type QueryParams = { filters: FilterState; requestToken: number }

type DeliveryResult =
  | { params: QueryParams; status: 'success'; question: PracticeQuestion }
  | { params: QueryParams; status: 'error'; kind: DeliveryErrorKind; message: string }

type SubmitErrorKind = 'expired' | 'forbidden' | 'contract' | 'generic'
type SubmitError = { kind: SubmitErrorKind; message: string }

function StudentPracticePage() {
  const { session, logout } = useAuth()
  const navigate = useNavigate()

  const [formState, setFormState] = useState<FilterState>(EMPTY_FILTERS)
  const [appliedFilters, setAppliedFilters] = useState<FilterState>(EMPTY_FILTERS)
  const [requestToken, setRequestToken] = useState(0)
  const [delivery, setDelivery] = useState<DeliveryResult | null>(null)

  const [selectedChoice, setSelectedChoice] = useState<string | null>(null)
  const [selectionError, setSelectionError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [answerResult, setAnswerResult] = useState<PracticeAnswerResult | null>(null)
  const [submitError, setSubmitError] = useState<SubmitError | null>(null)
  // A ref, not just `submitting` state, guards the double-submit check: state
  // updates commit after the event handler returns, so two rapid clicks in
  // the same tick would both read the pre-update `submitting` value.
  const submittingRef = useRef(false)

  const accessToken = session?.accessToken

  useEffect(() => {
    if (!accessToken) {
      return
    }

    const params: QueryParams = { filters: appliedFilters, requestToken }
    let cancelled = false

    practiceApi
      .getNextQuestion(accessToken, {
        category: appliedFilters.category.trim() || undefined,
        level: appliedFilters.level || undefined,
      })
      .then((question) => {
        if (cancelled) {
          return
        }
        setDelivery({ params, status: 'success', question })
        setSelectedChoice(null)
        setSelectionError(null)
        setAnswerResult(null)
        setSubmitError(null)
      })
      .catch((error: unknown) => {
        if (cancelled) {
          return
        }
        if (error instanceof PracticeApiError && error.status === 401) {
          setDelivery({ params, status: 'error', kind: 'expired', message: LOAD_SESSION_EXPIRED_MESSAGE })
        } else if (error instanceof PracticeApiError && error.status === 403) {
          setDelivery({ params, status: 'error', kind: 'forbidden', message: LOAD_FORBIDDEN_MESSAGE })
        } else if (error instanceof PracticeApiError && error.status === 404) {
          setDelivery({ params, status: 'error', kind: 'no-question', message: error.message })
        } else if (error instanceof PracticeApiError) {
          setDelivery({ params, status: 'error', kind: 'generic', message: error.message })
        } else {
          setDelivery({ params, status: 'error', kind: 'generic', message: LOAD_GENERIC_ERROR_MESSAGE })
        }
      })

    return () => {
      cancelled = true
    }
  }, [accessToken, appliedFilters, requestToken])

  function handleReSignIn() {
    logout()
    navigate('/login', { replace: true })
  }

  function handleFilterSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setAppliedFilters(formState)
  }

  function handleRequestNext() {
    setRequestToken((current) => current + 1)
  }

  async function submitChoice(choice: string, questionId: number) {
    if (!accessToken || submittingRef.current) {
      return
    }
    submittingRef.current = true
    setSubmitting(true)
    setSubmitError(null)
    try {
      const result = await practiceApi.submitAnswer(accessToken, { questionId, submittedAnswer: choice })
      setAnswerResult(result)
    } catch (error) {
      if (error instanceof PracticeApiError && error.status === 401) {
        setSubmitError({ kind: 'expired', message: SUBMIT_SESSION_EXPIRED_MESSAGE })
      } else if (error instanceof PracticeApiError && error.status === 403) {
        setSubmitError({ kind: 'forbidden', message: SUBMIT_FORBIDDEN_MESSAGE })
      } else if (error instanceof PracticeApiError && (error.status === 404 || error.status === 409)) {
        // A question that vanished (404) or is no longer a valid submission
        // target (409, e.g. deactivated) can't be retried as-is; the only
        // sane recovery is fetching a fresh question.
        setSubmitError({ kind: 'contract', message: error.message })
      } else if (error instanceof PracticeApiError) {
        setSubmitError({ kind: 'generic', message: error.message })
      } else {
        setSubmitError({ kind: 'generic', message: SUBMIT_GENERIC_ERROR_MESSAGE })
      }
    } finally {
      submittingRef.current = false
      setSubmitting(false)
    }
  }

  function handleAnswerFormSubmit(event: FormEvent<HTMLFormElement>, questionId: number) {
    event.preventDefault()
    if (submittingRef.current) {
      return
    }
    if (!selectedChoice) {
      setSelectionError(SELECTION_REQUIRED_MESSAGE)
      return
    }
    setSelectionError(null)
    void submitChoice(selectedChoice, questionId)
  }

  function handleRetrySubmit(questionId: number) {
    if (!selectedChoice) {
      return
    }
    void submitChoice(selectedChoice, questionId)
  }

  if (!session) {
    return null
  }

  const isCurrent =
    delivery !== null && delivery.params.filters === appliedFilters && delivery.params.requestToken === requestToken
  const isLoading = !isCurrent
  const currentDelivery = isCurrent ? delivery : null

  return (
    <StudentLayout active="practice">
      <div className="practice-page">
        <header className="practice-header">
          <h1>Practice</h1>
          <p className="practice-subtitle">객관식 문제를 풀고 즉시 결과를 확인하세요.</p>
        </header>

        <form className="practice-filter-form" onSubmit={handleFilterSubmit} aria-label="문제 검색 필터">
          <div className="practice-filter-field">
            <label htmlFor="practice-filter-category">카테고리</label>
            <input
              id="practice-filter-category"
              type="text"
              value={formState.category}
              onChange={(event) => setFormState((prev) => ({ ...prev, category: event.target.value }))}
              placeholder="예: 현재완료"
            />
          </div>

          <div className="practice-filter-field">
            <label htmlFor="practice-filter-level">난이도</label>
            <select
              id="practice-filter-level"
              value={formState.level}
              onChange={(event) => setFormState((prev) => ({ ...prev, level: event.target.value as LevelFilter }))}
            >
              <option value="">전체</option>
              {QUESTION_LEVELS.map((level) => (
                <option key={level} value={level}>
                  {QUESTION_LEVEL_LABELS[level]}
                </option>
              ))}
            </select>
          </div>

          <div className="practice-filter-actions">
            <Button type="submit">문제 불러오기</Button>
          </div>
        </form>

        <section className="practice-content" aria-live="polite">
          {isLoading && (
            <p className="practice-status" role="status">
              불러오는 중...
            </p>
          )}

          {currentDelivery?.status === 'error' && (
            <div className="practice-error" role="alert">
              <p>{currentDelivery.message}</p>
              {currentDelivery.kind === 'expired' && (
                <Button type="button" onClick={handleReSignIn}>
                  다시 로그인
                </Button>
              )}
              {(currentDelivery.kind === 'generic' || currentDelivery.kind === 'no-question') && (
                <Button type="button" onClick={handleRequestNext}>
                  다시 시도
                </Button>
              )}
            </div>
          )}

          {currentDelivery?.status === 'success' && (
            <div className="practice-question-card">
              <p className="practice-question-meta">
                {currentDelivery.question.category} · {QUESTION_LEVEL_LABELS[currentDelivery.question.level]}
              </p>
              <p className="practice-question-text">{currentDelivery.question.text}</p>

              {answerResult === null ? (
                <form
                  className="practice-answer-form"
                  onSubmit={(event) => handleAnswerFormSubmit(event, currentDelivery.question.id)}
                  aria-label="답안 제출"
                >
                  <fieldset className="practice-choices">
                    <legend>보기</legend>
                    {currentDelivery.question.choices.map((choice) => (
                      <label key={choice} className="practice-choice">
                        <input
                          type="radio"
                          name="practice-choice"
                          value={choice}
                          checked={selectedChoice === choice}
                          onChange={() => {
                            setSelectedChoice(choice)
                            setSelectionError(null)
                          }}
                          disabled={submitting}
                        />
                        <span>{choice}</span>
                      </label>
                    ))}
                  </fieldset>

                  {selectionError && (
                    <p className="practice-selection-error" role="alert">
                      {selectionError}
                    </p>
                  )}

                  <Button type="submit" disabled={submitting}>
                    {submitting ? '제출 중...' : '제출하기'}
                  </Button>
                </form>
              ) : (
                <div
                  className={`practice-result practice-result-${answerResult.correct ? 'correct' : 'incorrect'}`}
                  role="status"
                >
                  <p className="practice-result-headline">{answerResult.correct ? '정답입니다!' : '오답입니다.'}</p>
                  <dl className="practice-result-meta">
                    <div>
                      <dt>제출한 답안</dt>
                      <dd>{answerResult.submittedAnswer}</dd>
                    </div>
                    <div>
                      <dt>정답</dt>
                      <dd>{answerResult.correctAnswer}</dd>
                    </div>
                  </dl>
                  <p className="practice-result-explanation">{answerResult.explanation}</p>
                  <Button type="button" onClick={handleRequestNext}>
                    다음 문제
                  </Button>
                </div>
              )}

              {submitError && (
                <div className="practice-submit-error" role="alert">
                  <p>{submitError.message}</p>
                  {submitError.kind === 'expired' && (
                    <Button type="button" onClick={handleReSignIn}>
                      다시 로그인
                    </Button>
                  )}
                  {submitError.kind === 'generic' && (
                    <Button type="button" onClick={() => handleRetrySubmit(currentDelivery.question.id)}>
                      다시 시도
                    </Button>
                  )}
                  {submitError.kind === 'contract' && (
                    <Button type="button" onClick={handleRequestNext}>
                      다음 문제
                    </Button>
                  )}
                </div>
              )}
            </div>
          )}
        </section>
      </div>
    </StudentLayout>
  )
}

export default StudentPracticePage
