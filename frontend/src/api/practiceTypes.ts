// DTOs for the STUDENT practice flow: fetching the next practice question and
// submitting an answer. Type/level enums and their Korean wire labels are
// owned by questionTypes.ts and reused here rather than duplicated.
import { QUESTION_LEVEL_LABELS, type QuestionLevel, type QuestionType } from './questionTypes'

// Delivery shape intentionally omits `answer`/`explanation`: a student must
// not be able to read the correct answer before submitting one.
export type PracticeQuestion = {
  id: number
  category: string
  type: QuestionType
  level: QuestionLevel
  text: string
  choices: string[]
}

export type PracticeQuestionFilters = {
  category?: string
  level?: QuestionLevel
}

export type PracticeAnswerRequest = {
  questionId: number
  submittedAnswer: string
}

// The graded record. Includes `correctAnswer`/`explanation` because by this
// point the student has already submitted an answer.
export type PracticeAnswerResult = {
  id: number
  questionId: number
  correct: boolean
  submittedAnswer: string
  correctAnswer: string
  explanation: string
  submittedAt: string
}

// Fixed field order keeps the serialized query string deterministic across calls.
export function serializePracticeQuestionFilters(filters: PracticeQuestionFilters): string {
  const params = new URLSearchParams()

  if (filters.category) {
    params.set('category', filters.category)
  }
  if (filters.level) {
    params.set('level', QUESTION_LEVEL_LABELS[filters.level])
  }

  return params.toString()
}
