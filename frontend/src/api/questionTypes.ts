// Canonical enum keys and their Korean display labels for the Question API.
// The backend's wire format for `type`/`level`/`status` fields (in JSON bodies,
// query params, and responses) IS the Korean label string, not the enum name
// (see backend QuestionType/QuestionLevel/QuestionStatus#fromLabel and the
// *Response classes). These maps are the single source of truth for that
// mapping so no UI code should ever define its own copy.

export const QUESTION_TYPES = ['MULTIPLE_CHOICE', 'FILL_IN_BLANK', 'ERROR_FINDING'] as const
export type QuestionType = (typeof QUESTION_TYPES)[number]

export const QUESTION_TYPE_LABELS: Readonly<Record<QuestionType, string>> = {
  MULTIPLE_CHOICE: '객관식',
  FILL_IN_BLANK: '빈칸',
  ERROR_FINDING: '오류 찾기',
}

// Phase 1 (MVP) only supports MULTIPLE_CHOICE; FILL_IN_BLANK/ERROR_FINDING are
// future scope. UI filter/select options must be built from this list, not
// from QUESTION_TYPES, even though the wider union stays available for typing
// values the backend could already return.
export const PHASE_1_QUESTION_TYPES: readonly QuestionType[] = ['MULTIPLE_CHOICE']

export const QUESTION_LEVELS = ['BASIC', 'INTERMEDIATE', 'ADVANCED'] as const
export type QuestionLevel = (typeof QUESTION_LEVELS)[number]

export const QUESTION_LEVEL_LABELS: Readonly<Record<QuestionLevel, string>> = {
  BASIC: '기초',
  INTERMEDIATE: '보통',
  ADVANCED: '심화',
}

export const QUESTION_STATUSES = ['DRAFT', 'ACTIVE', 'INACTIVE'] as const
export type QuestionStatus = (typeof QUESTION_STATUSES)[number]

export const QUESTION_STATUS_LABELS: Readonly<Record<QuestionStatus, string>> = {
  DRAFT: '초안',
  ACTIVE: '사용 중',
  INACTIVE: '사용 중지',
}

function buildLabelLookup<T extends string>(labels: Readonly<Record<T, string>>): Record<string, T> {
  return Object.fromEntries(Object.entries(labels).map(([key, label]) => [label, key])) as Record<string, T>
}

const QUESTION_TYPE_BY_LABEL = buildLabelLookup(QUESTION_TYPE_LABELS)
const QUESTION_LEVEL_BY_LABEL = buildLabelLookup(QUESTION_LEVEL_LABELS)
const QUESTION_STATUS_BY_LABEL = buildLabelLookup(QUESTION_STATUS_LABELS)

export function questionTypeFromLabel(label: string): QuestionType {
  const type = QUESTION_TYPE_BY_LABEL[label]
  if (!type) {
    throw new Error(`알 수 없는 문제 유형입니다: ${label}`)
  }
  return type
}

export function questionLevelFromLabel(label: string): QuestionLevel {
  const level = QUESTION_LEVEL_BY_LABEL[label]
  if (!level) {
    throw new Error(`알 수 없는 난이도입니다: ${label}`)
  }
  return level
}

export function questionStatusFromLabel(label: string): QuestionStatus {
  const status = QUESTION_STATUS_BY_LABEL[label]
  if (!status) {
    throw new Error(`알 수 없는 상태입니다: ${label}`)
  }
  return status
}

export type QuestionListItem = {
  id: number
  category: string
  type: QuestionType
  level: QuestionLevel
  status: QuestionStatus
  text: string
}

export type QuestionDetail = QuestionListItem & {
  choices: string[]
  answer: string
  explanation: string
  createdAt: string
}

export type QuestionPageResponse<T> = {
  content: T[]
  page: number
  size: number
  totalElements: number
  totalPages: number
}

export type QuestionCreateRequest = {
  category: string
  type: QuestionType
  level: QuestionLevel
  text: string
  choices: string[]
  answer: string
  explanation: string
}

// Partial update: only fields present are changed (matches backend PATCH semantics).
export type QuestionUpdateRequest = Partial<QuestionCreateRequest>

export type QuestionListFilters = {
  category?: string
  type?: QuestionType
  level?: QuestionLevel
  status?: QuestionStatus
  keyword?: string
  page?: number
  size?: number
}

export type QuestionApiErrorBody = {
  code: string
  message: string
}

// Fixed field order keeps the serialized query string deterministic across calls.
export function serializeQuestionListFilters(filters: QuestionListFilters): string {
  const params = new URLSearchParams()

  if (filters.category) {
    params.set('category', filters.category)
  }
  if (filters.type) {
    params.set('type', QUESTION_TYPE_LABELS[filters.type])
  }
  if (filters.level) {
    params.set('level', QUESTION_LEVEL_LABELS[filters.level])
  }
  if (filters.status) {
    params.set('status', QUESTION_STATUS_LABELS[filters.status])
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
