import { useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { QuestionApiError, questionApi } from '../api/questionApi'
import { QUESTION_LEVELS, QUESTION_LEVEL_LABELS, QUESTION_TYPE_LABELS } from '../api/questionTypes'
import type { QuestionLevel } from '../api/questionTypes'
import { useAuth } from '../auth/useAuth'
import AdminLayout from '../components/AdminLayout'
import Button from '../components/Button'
import './QuestionCreatePage.css'

const MIN_CHOICES = 2
const MAX_CHOICES = 6
const INITIAL_CHOICE_COUNT = 4

const GENERIC_ERROR_MESSAGE = '문제를 저장하지 못했습니다. 잠시 후 다시 시도해주세요.'
const FORBIDDEN_MESSAGE = '문제를 생성할 권한이 없습니다. 관리자 계정으로 로그인했는지 확인해주세요.'
const SESSION_EXPIRED_MESSAGE = '세션이 만료되었습니다. 다시 로그인해주세요.'

type Choice = { id: number; value: string }

type FormErrors = {
  category?: string
  level?: string
  text?: string
  choices?: string
  answer?: string
  explanation?: string
}

function createInitialChoices(count: number): Choice[] {
  return Array.from({ length: count }, (_, index) => ({ id: index, value: '' }))
}

function validate(state: {
  category: string
  level: QuestionLevel | ''
  text: string
  choices: Choice[]
  answer: string
  explanation: string
}): FormErrors {
  const errors: FormErrors = {}

  if (!state.category.trim()) {
    errors.category = '카테고리를 입력하세요.'
  }
  if (!state.level) {
    errors.level = '난이도를 선택하세요.'
  }
  if (!state.text.trim()) {
    errors.text = '문제 내용을 입력하세요.'
  }

  const blankChoiceExists = state.choices.some((choice) => !choice.value.trim())
  if (state.choices.length < MIN_CHOICES) {
    errors.choices = `보기를 ${MIN_CHOICES}개 이상 입력하세요.`
  } else if (blankChoiceExists) {
    errors.choices = '빈 보기가 없도록 모든 보기를 입력하세요.'
  }

  if (!errors.choices) {
    if (!state.answer.trim()) {
      errors.answer = '정답을 선택하세요.'
    } else if (!state.choices.some((choice) => choice.value.trim() === state.answer.trim())) {
      errors.answer = '정답은 보기 목록에 포함되어야 합니다.'
    }
  } else {
    errors.answer = '정답을 선택하세요.'
  }

  if (!state.explanation.trim()) {
    errors.explanation = '해설을 입력하세요.'
  }

  return errors
}

function QuestionCreatePage() {
  const { session, logout } = useAuth()
  const navigate = useNavigate()

  const nextChoiceIdRef = useRef(INITIAL_CHOICE_COUNT)

  const [category, setCategory] = useState('')
  const [level, setLevel] = useState<QuestionLevel | ''>('')
  const [text, setText] = useState('')
  const [choices, setChoices] = useState<Choice[]>(() => createInitialChoices(INITIAL_CHOICE_COUNT))
  const [answer, setAnswer] = useState('')
  const [explanation, setExplanation] = useState('')

  const [errors, setErrors] = useState<FormErrors>({})
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<{ message: string; expired: boolean; forbidden: boolean } | null>(
    null,
  )

  const accessToken = session?.accessToken

  function updateChoice(id: number, value: string) {
    setChoices((current) => current.map((choice) => (choice.id === id ? { ...choice, value } : choice)))
  }

  function addChoice() {
    const id = nextChoiceIdRef.current++
    setChoices((current) => [...current, { id, value: '' }])
  }

  function removeChoice(id: number) {
    setChoices((current) => {
      if (current.length <= MIN_CHOICES) {
        return current
      }
      const removed = current.find((choice) => choice.id === id)
      const next = current.filter((choice) => choice.id !== id)
      if (removed && removed.value.trim() === answer.trim()) {
        setAnswer('')
      }
      return next
    })
  }

  function handleReSignIn() {
    logout()
    navigate('/login', { replace: true })
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const formState = { category, level, text, choices, answer, explanation }
    const validationErrors = validate(formState)
    setErrors(validationErrors)
    setSubmitError(null)

    if (Object.keys(validationErrors).length > 0 || !accessToken || !level) {
      return
    }

    setSubmitting(true)
    try {
      await questionApi.createQuestion(accessToken, {
        category: category.trim(),
        type: 'MULTIPLE_CHOICE',
        level,
        text: text.trim(),
        choices: choices.map((choice) => choice.value.trim()),
        answer: answer.trim(),
        explanation: explanation.trim(),
      })
      navigate('/admin/questions', { state: { questionCreated: true } })
    } catch (error) {
      if (error instanceof QuestionApiError && error.status === 401) {
        setSubmitError({ message: SESSION_EXPIRED_MESSAGE, expired: true, forbidden: false })
      } else if (error instanceof QuestionApiError && error.status === 403) {
        setSubmitError({ message: FORBIDDEN_MESSAGE, expired: false, forbidden: true })
      } else if (error instanceof QuestionApiError) {
        setSubmitError({ message: error.message, expired: false, forbidden: false })
      } else {
        setSubmitError({ message: GENERIC_ERROR_MESSAGE, expired: false, forbidden: false })
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AdminLayout active="questions">
      <div className="question-create-page">
        <header className="question-create-header">
          <h1>문제 추가</h1>
          <p className="question-create-subtitle">객관식 문제를 새로 등록합니다.</p>
        </header>

        <form className="question-create-form" onSubmit={handleSubmit} noValidate aria-label="문제 추가">
          <div className="question-create-field">
            <label htmlFor="create-category">카테고리</label>
            <input
              id="create-category"
              type="text"
              value={category}
              onChange={(event) => setCategory(event.target.value)}
              aria-invalid={Boolean(errors.category)}
              aria-describedby={errors.category ? 'create-category-error' : undefined}
            />
            {errors.category && (
              <p id="create-category-error" className="question-create-field-error" role="alert">
                {errors.category}
              </p>
            )}
          </div>

          <div className="question-create-field">
            <label htmlFor="create-type">유형</label>
            <select id="create-type" value="MULTIPLE_CHOICE" disabled aria-readonly="true">
              <option value="MULTIPLE_CHOICE">{QUESTION_TYPE_LABELS.MULTIPLE_CHOICE}</option>
            </select>
          </div>

          <div className="question-create-field">
            <label htmlFor="create-level">난이도</label>
            <select
              id="create-level"
              value={level}
              onChange={(event) => setLevel(event.target.value as QuestionLevel | '')}
              aria-invalid={Boolean(errors.level)}
              aria-describedby={errors.level ? 'create-level-error' : undefined}
            >
              <option value="">선택하세요</option>
              {QUESTION_LEVELS.map((item) => (
                <option key={item} value={item}>
                  {QUESTION_LEVEL_LABELS[item]}
                </option>
              ))}
            </select>
            {errors.level && (
              <p id="create-level-error" className="question-create-field-error" role="alert">
                {errors.level}
              </p>
            )}
          </div>

          <div className="question-create-field">
            <label htmlFor="create-text">문제 내용</label>
            <textarea
              id="create-text"
              value={text}
              onChange={(event) => setText(event.target.value)}
              rows={3}
              aria-invalid={Boolean(errors.text)}
              aria-describedby={errors.text ? 'create-text-error' : undefined}
            />
            {errors.text && (
              <p id="create-text-error" className="question-create-field-error" role="alert">
                {errors.text}
              </p>
            )}
          </div>

          <fieldset className="question-create-choices">
            <legend>보기 및 정답</legend>

            {choices.map((choice, index) => (
              <div className="question-create-choice-row" key={choice.id}>
                <label htmlFor={`create-choice-${choice.id}`}>{`보기 ${index + 1}`}</label>
                <input
                  id={`create-choice-${choice.id}`}
                  type="text"
                  value={choice.value}
                  onChange={(event) => updateChoice(choice.id, event.target.value)}
                />
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => removeChoice(choice.id)}
                  disabled={choices.length <= MIN_CHOICES}
                >
                  삭제
                </Button>
              </div>
            ))}

            {errors.choices && (
              <p className="question-create-field-error" role="alert">
                {errors.choices}
              </p>
            )}

            <Button type="button" variant="secondary" onClick={addChoice} disabled={choices.length >= MAX_CHOICES}>
              보기 추가
            </Button>
          </fieldset>

          <div className="question-create-field">
            <label htmlFor="create-answer">정답</label>
            <select
              id="create-answer"
              value={answer}
              onChange={(event) => setAnswer(event.target.value)}
              aria-invalid={Boolean(errors.answer)}
              aria-describedby={errors.answer ? 'create-answer-error' : undefined}
            >
              <option value="">선택하세요</option>
              {choices
                .filter((choice) => choice.value.trim())
                .map((choice) => (
                  <option key={choice.id} value={choice.value}>
                    {choice.value}
                  </option>
                ))}
            </select>
            {errors.answer && (
              <p id="create-answer-error" className="question-create-field-error" role="alert">
                {errors.answer}
              </p>
            )}
          </div>

          <div className="question-create-field">
            <label htmlFor="create-explanation">해설</label>
            <textarea
              id="create-explanation"
              value={explanation}
              onChange={(event) => setExplanation(event.target.value)}
              rows={3}
              aria-invalid={Boolean(errors.explanation)}
              aria-describedby={errors.explanation ? 'create-explanation-error' : undefined}
            />
            {errors.explanation && (
              <p id="create-explanation-error" className="question-create-field-error" role="alert">
                {errors.explanation}
              </p>
            )}
          </div>

          {submitError && (
            <div className="question-create-submit-error" role="alert">
              <p>{submitError.message}</p>
              {submitError.expired && (
                <Button type="button" onClick={handleReSignIn}>
                  다시 로그인
                </Button>
              )}
            </div>
          )}

          <div className="question-create-actions">
            <Button type="submit" disabled={submitting}>
              {submitting ? '저장 중...' : '문제 저장'}
            </Button>
            <Button type="button" variant="secondary" onClick={() => navigate('/admin/questions')}>
              취소
            </Button>
          </div>
        </form>
      </div>
    </AdminLayout>
  )
}

export default QuestionCreatePage
