// DTOs for the STUDENT assignment CBT flow (내 과제): listing, question
// delivery/draft-save, final submit, and result retrieval. `status` reuses the
// canonical AssignmentStatus enum/labels owned by assignmentTypes.ts (same
// wire values as the admin Assignment API — UPCOMING is never actually
// returned here since scheduled assignments are hidden from students, see
// docs/api-spec-detail.md#예정-과제-숨김-규칙). `level` reuses QuestionLevel
// from questionTypes.ts. Assignment status (진행 중/마감) and this student's own
// SubmissionStatus for that assignment are two independent axes — never conflate them.
import type { AssignmentStatus } from './assignmentTypes'
import type { QuestionLevel } from './questionTypes'

export const SUBMISSION_STATUSES = ['NOT_STARTED', 'IN_PROGRESS', 'SUBMITTED'] as const
export type SubmissionStatus = (typeof SUBMISSION_STATUSES)[number]
// Unlike AssignmentStatus, submissionStatus is already the raw wire value
// (the English enum name) — the backend never translates it to a Korean label.

export type MyAssignmentListItem = {
  id: number
  title: string
  startDate: string
  dueDate: string
  status: AssignmentStatus
  submissionStatus: SubmissionStatus
  // This student's own progress (draft-saved answer count ÷ total questions).
  // Same field name as the admin list's `progress`, but a different metric
  // (submission-rate across students) — see docs/api-spec-detail.md.
  progress: number
}

// Delivery shape intentionally omits `answer`/`explanation`/correctness: a
// student must never be able to read the correct answer or grading result
// before final submit, regardless of submissionStatus.
export type MyAssignmentQuestion = {
  id: number
  // 1-based solving order; matches the questionIds order set at assignment creation.
  order: number
  category: string
  level: QuestionLevel
  text: string
  choices: string[]
  // This student's own draft-saved answer for this question, or null if unanswered.
  myAnswer: string | null
}

export type MyAssignmentQuestionsResponse = {
  assignmentId: number
  // Calling this endpoint the first time creates the submission record as
  // IN_PROGRESS ("시작하기"); NOT_STARTED is never observed here.
  submissionStatus: Extract<SubmissionStatus, 'IN_PROGRESS' | 'SUBMITTED'>
  questions: MyAssignmentQuestion[]
}

export type SaveAnswerRequest = {
  answer: string
}

// Save-only response: no correctness/grading info, matching the CBT contract
// that grading is deferred entirely until final submit.
export type SaveAnswerResult = {
  questionId: number
  answer: string
  savedAt: string
}

export type AssignmentResultItem = {
  questionId: number
  // null for a question that had no draft-saved answer at submit time.
  submittedAnswer: string | null
  correct: boolean
  correctAnswer: string
  explanation: string
}

// Returned identically by both POST .../submit and GET .../result — the
// latter re-serves the immutable snapshot created at submit time without
// regrading, so repeated reads are stable.
export type AssignmentResult = {
  assignmentId: number
  submissionStatus: 'SUBMITTED'
  submittedAt: string
  totalQuestions: number
  answeredQuestions: number
  correctCount: number
  score: number
  results: AssignmentResultItem[]
}

export type MyAssignmentListFilters = {
  page?: number
  size?: number
}

export type MyAssignmentApiErrorBody = {
  code: string
  message: string
}

// Fixed field order keeps the serialized query string deterministic across calls.
export function serializeMyAssignmentListFilters(filters: MyAssignmentListFilters): string {
  const params = new URLSearchParams()

  // page is zero-based; 0 is a meaningful value and must not be treated as empty.
  if (filters.page !== undefined) {
    params.set('page', String(filters.page))
  }
  if (filters.size !== undefined) {
    params.set('size', String(filters.size))
  }

  return params.toString()
}
