// docs/api-spec-detail.md#학생-student-관리자-관점
// Unlike Question/Assignment, Student has no enum-valued fields translated to
// Korean labels on the wire — studentGroup is a free-text class name and the
// other fields are plain numbers/dates, so no label lookup tables are needed here.

export type StudentListItem = {
  id: number
  name: string
  // null when the student has no group assigned yet (cannot be a CLASS
  // assignment target in that case — see docs/api-spec-detail.md#대상target-지정).
  studentGroup: string | null
  // KST calendar date (e.g. "2026-08-01") of the student's most recent
  // StudyRecord, across both PRACTICE and ASSIGNMENT. null if never studied.
  lastStudiedAt: string | null
  totalQuestionCount: number
  // Percentage (0-100, rounded). 0 when totalQuestionCount is 0.
  accuracy: number
  pendingAssignmentCount: number
}

export type StudentPageResponse<T> = {
  content: T[]
  page: number
  size: number
  totalElements: number
  totalPages: number
}

export type StudentListFilters = {
  keyword?: string
  group?: string
  page?: number
  size?: number
}

export type StudentApiErrorBody = {
  code: string
  message: string
}

// Same field structure as StudentListItem (docs/api-spec-detail.md#get-apistudentsid--학생-상세-조회).
export type StudentDetail = StudentListItem

// Fixed field order keeps the serialized query string deterministic across calls.
export function serializeStudentListFilters(filters: StudentListFilters): string {
  const params = new URLSearchParams()

  if (filters.keyword) {
    params.set('keyword', filters.keyword)
  }
  if (filters.group) {
    params.set('group', filters.group)
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

// docs/api-spec-detail.md#학습-이력-studyrecord — the admin-facing StudyRecord
// rollup. `type`'s query/response wire value is always the literal enum name
// ("ASSIGNMENT"/"PRACTICE"), never a translated label, unlike Assignment.status.
// Defined locally (not imported from practiceHistoryTypes.ts) since that file's
// StudyRecordType models a different, STUDENT-facing endpoint (Phase 2 scope,
// PRACTICE-only) and this is an unrelated admin rollup contract.
export const STUDY_RECORD_TYPES = ['ASSIGNMENT', 'PRACTICE'] as const
export type StudyRecordType = (typeof STUDY_RECORD_TYPES)[number]

export const STUDY_RECORD_TYPE_LABELS: Readonly<Record<StudyRecordType, string>> = {
  ASSIGNMENT: '과제',
  PRACTICE: '자유 학습',
}

export const STUDY_RECORD_PERIODS = ['7d', '30d'] as const
export type StudyRecordPeriod = (typeof STUDY_RECORD_PERIODS)[number]

// One row per (studentId, date, type) rollup group.
// durationMinutes is always 0 (no reliable time-tracking data source yet — see docs).
export type StudyRecordRollup = {
  studentId: number
  studentName: string
  date: string
  type: StudyRecordType
  questionCount: number
  correctCount: number
  accuracy: number
  durationMinutes: number
}

export type StudyRecordListFilters = {
  studentId?: number
  period?: StudyRecordPeriod
  type?: StudyRecordType
  page?: number
  size?: number
}

// Fixed field order keeps the serialized query string deterministic across calls.
export function serializeStudyRecordListFilters(filters: StudyRecordListFilters): string {
  const params = new URLSearchParams()

  if (filters.studentId !== undefined) {
    params.set('studentId', String(filters.studentId))
  }
  if (filters.period) {
    params.set('period', filters.period)
  }
  if (filters.type) {
    params.set('type', filters.type)
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
