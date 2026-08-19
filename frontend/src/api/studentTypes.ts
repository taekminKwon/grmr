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
