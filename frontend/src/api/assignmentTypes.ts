// Canonical enum keys and their Korean display labels for the admin Assignment API.
// The backend's wire format for `status` (in query params and responses) IS the
// Korean label string, not the enum name (see docs/api-spec-detail.md#과제-assignment).
// `targetType` is the exception: its wire value is always the literal English
// enum name ("CLASS"/"STUDENT"), never translated.

export const ASSIGNMENT_STATUSES = ['UPCOMING', 'IN_PROGRESS', 'CLOSED'] as const
export type AssignmentStatus = (typeof ASSIGNMENT_STATUSES)[number]

export const ASSIGNMENT_STATUS_LABELS: Readonly<Record<AssignmentStatus, string>> = {
  UPCOMING: '예정',
  IN_PROGRESS: '진행 중',
  CLOSED: '마감',
}

function buildLabelLookup<T extends string>(labels: Readonly<Record<T, string>>): Record<string, T> {
  return Object.fromEntries(Object.entries(labels).map(([key, label]) => [label, key])) as Record<string, T>
}

const ASSIGNMENT_STATUS_BY_LABEL = buildLabelLookup(ASSIGNMENT_STATUS_LABELS)

export function assignmentStatusFromLabel(label: string): AssignmentStatus {
  const status = ASSIGNMENT_STATUS_BY_LABEL[label]
  if (!status) {
    throw new Error(`알 수 없는 과제 상태입니다: ${label}`)
  }
  return status
}

export const ASSIGNMENT_TARGET_TYPES = ['CLASS', 'STUDENT'] as const
export type AssignmentTargetType = (typeof ASSIGNMENT_TARGET_TYPES)[number]

export type AssignmentClassTarget = {
  targetType: 'CLASS'
  targetGroup: string
}

export type AssignmentStudentTarget = {
  targetType: 'STUDENT'
  targetStudentId: number
}

// Discriminated union mirroring the backend rule: the target field present
// depends entirely on targetType, and the other field is never sent/received.
export type AssignmentTarget = AssignmentClassTarget | AssignmentStudentTarget

export type AssignmentListItem = AssignmentTarget & {
  id: number
  title: string
  // Display string for the target: targetGroup as-is for CLASS, the student's
  // name for STUDENT. Never used to derive targetGroup/targetStudentId.
  target: string
  startDate: string
  dueDate: string
  progress: number
  status: AssignmentStatus
}

export type AssignmentQuestionSummary = {
  id: number
  // 1-based solving order; array index + 1 by contract.
  order: number
  text: string
  category: string
}

export type AssignmentDetail = AssignmentListItem & {
  questions: AssignmentQuestionSummary[]
}

export type AssignmentCreateRequest = AssignmentTarget & {
  title: string
  startDate: string
  dueDate: string
  questionIds: number[]
}

// Partial update: only fields present are changed (matches backend PATCH
// semantics). If targetType is included, its matching target field must be
// included too; the pair is either both present or both absent.
export type AssignmentUpdateRequest = {
  startDate?: string
  dueDate?: string
  questionIds?: number[]
} & (AssignmentClassTarget | AssignmentStudentTarget | { targetType?: undefined })

export type AssignmentListFilters = {
  status?: AssignmentStatus
  keyword?: string
  page?: number
  size?: number
}

export type AssignmentApiErrorBody = {
  code: string
  message: string
}

// Fixed field order keeps the serialized query string deterministic across calls.
export function serializeAssignmentListFilters(filters: AssignmentListFilters): string {
  const params = new URLSearchParams()

  if (filters.status) {
    params.set('status', ASSIGNMENT_STATUS_LABELS[filters.status])
  }
  if (filters.keyword) {
    params.set('keyword', filters.keyword)
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

// Mirrors the backend's automatic status computation (docs/api-spec-detail.md
// #상태status-계산-규칙): boundary dates (startDate/dueDate themselves) fall
// inside IN_PROGRESS. Exposed for the fake adapter, which has no server to
// compute this for it; the real client never calls this since the backend
// always returns status already computed.
export function computeAssignmentStatus(startDate: string, dueDate: string, today: Date = new Date()): AssignmentStatus {
  const todayKey = today.toISOString().slice(0, 10)
  if (todayKey < startDate) {
    return 'UPCOMING'
  }
  if (todayKey > dueDate) {
    return 'CLOSED'
  }
  return 'IN_PROGRESS'
}
