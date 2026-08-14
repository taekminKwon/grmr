// DTOs for the STUDENT's own practice history (StudyRecord list/detail).
// `level` reuses the canonical QuestionLevel enum/labels owned by
// questionTypes.ts rather than duplicating them; `category` stays a free-form
// string, matching the backend contract for both this and the Question API.
import type { QuestionLevel } from './questionTypes'

// Phase 2 only ever produces PRACTICE records (no Assignment feature yet).
export type StudyRecordType = 'PRACTICE'

// List item: summary fields only. The submission-time question snapshot
// (text/choices/correctAnswer/explanation) is only available on the detail response.
export type StudyRecordSummary = {
  id: number
  questionId: number
  type: StudyRecordType
  category: string
  level: QuestionLevel
  correct: boolean
  submittedAt: string
}

// Immutable submission-time snapshot of the question. Never reflects later
// edits to the original question (see docs/api-spec-detail.md StudyRecord section).
export type StudyRecordQuestionSnapshot = {
  category: string
  level: QuestionLevel
  text: string
  choices: string[]
  correctAnswer: string
  explanation: string
}

export type StudyRecordDetail = {
  id: number
  questionId: number
  type: StudyRecordType
  question: StudyRecordQuestionSnapshot
  submittedAnswer: string
  correct: boolean
  submittedAt: string
}

export type StudyRecordListFilters = {
  category?: string
  page?: number
  size?: number
}

// Fixed field order keeps the serialized query string deterministic across calls.
export function serializeStudyRecordListFilters(filters: StudyRecordListFilters): string {
  const params = new URLSearchParams()

  if (filters.category) {
    params.set('category', filters.category)
  }
  // page is zero-based; 0 is a meaningful value and must not be treated as empty.
  if (filters.page !== undefined) {
    params.set('page', String(filters.page))
  }
  if (filters.size !== undefined) {
    params.set('size', String(filters.size))
  }

  return params.toString()
}
