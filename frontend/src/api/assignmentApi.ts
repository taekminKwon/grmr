import {
  assignmentStatusFromLabel,
  serializeAssignmentListFilters,
  type AssignmentApiErrorBody,
  type AssignmentCreateRequest,
  type AssignmentDetail,
  type AssignmentListFilters,
  type AssignmentListItem,
  type AssignmentQuestionSummary,
  type AssignmentTarget,
  type AssignmentUpdateRequest,
} from './assignmentTypes'
import type { QuestionPageResponse } from './questionTypes'

export class AssignmentApiError extends Error {
  code?: string
  status: number

  constructor(message: string, status: number, code?: string) {
    super(message)
    this.name = 'AssignmentApiError'
    this.status = status
    this.code = code
  }
}

const ASSIGNMENTS_PATH = '/api/assignments'

const DEFAULT_ERROR_MESSAGE = '요청을 처리하지 못했습니다. 잠시 후 다시 시도해주세요.'
const NETWORK_ERROR_MESSAGE = '네트워크 오류가 발생했습니다. 연결 상태를 확인해주세요.'

// Shape of `status` as it actually appears on the wire: a Korean label.
// `targetType` is already the raw wire value ("CLASS"/"STUDENT"), never translated.
type RawAssignmentListItem = {
  id: number
  title: string
  targetType: 'CLASS' | 'STUDENT'
  targetGroup?: string
  targetStudentId?: number
  target: string
  startDate: string
  dueDate: string
  progress: number
  status: string
}

type RawAssignmentQuestionSummary = {
  id: number
  order: number
  text: string
  category: string
}

type RawAssignmentDetail = RawAssignmentListItem & {
  questions: RawAssignmentQuestionSummary[]
}

type RawPageResponse<T> = {
  content: T[]
  page: number
  size: number
  totalElements: number
  totalPages: number
}

function parseAssignmentTarget(raw: RawAssignmentListItem): AssignmentTarget {
  if (raw.targetType === 'CLASS') {
    return { targetType: 'CLASS', targetGroup: raw.targetGroup as string }
  }
  return { targetType: 'STUDENT', targetStudentId: raw.targetStudentId as number }
}

function parseAssignmentListItem(raw: RawAssignmentListItem): AssignmentListItem {
  return {
    ...parseAssignmentTarget(raw),
    id: raw.id,
    title: raw.title,
    target: raw.target,
    startDate: raw.startDate,
    dueDate: raw.dueDate,
    progress: raw.progress,
    status: assignmentStatusFromLabel(raw.status),
  }
}

function parseAssignmentQuestionSummary(raw: RawAssignmentQuestionSummary): AssignmentQuestionSummary {
  return {
    id: raw.id,
    order: raw.order,
    text: raw.text,
    category: raw.category,
  }
}

function parseAssignmentDetail(raw: RawAssignmentDetail): AssignmentDetail {
  return {
    ...parseAssignmentListItem(raw),
    questions: raw.questions.map(parseAssignmentQuestionSummary),
  }
}

function serializeAssignmentTarget(target: AssignmentTarget) {
  if (target.targetType === 'CLASS') {
    return { targetType: target.targetType, targetGroup: target.targetGroup }
  }
  return { targetType: target.targetType, targetStudentId: target.targetStudentId }
}

function serializeAssignmentCreateRequest(request: AssignmentCreateRequest) {
  return {
    title: request.title,
    ...serializeAssignmentTarget(request),
    startDate: request.startDate,
    dueDate: request.dueDate,
    questionIds: request.questionIds,
  }
}

// Only includes keys the caller actually set, so a PATCH never invents fields
// (e.g. a stray targetGroup: null) that the backend would treat as a change.
function serializeAssignmentUpdateRequest(request: AssignmentUpdateRequest): Record<string, unknown> {
  const body: Record<string, unknown> = {}

  if (request.targetType !== undefined) {
    Object.assign(body, serializeAssignmentTarget(request as AssignmentTarget))
  }
  if (request.startDate !== undefined) {
    body.startDate = request.startDate
  }
  if (request.dueDate !== undefined) {
    body.dueDate = request.dueDate
  }
  if (request.questionIds !== undefined) {
    body.questionIds = request.questionIds
  }

  return body
}

async function request<T>(path: string, accessToken: string, init?: RequestInit): Promise<T> {
  let response: Response

  try {
    response = await fetch(path, {
      ...init,
      headers: {
        ...(init?.headers ?? {}),
        Authorization: `Bearer ${accessToken}`,
      },
    })
  } catch {
    throw new AssignmentApiError(NETWORK_ERROR_MESSAGE, 0)
  }

  if (!response.ok) {
    const body: Partial<AssignmentApiErrorBody> | null = await response.json().catch(() => null)
    throw new AssignmentApiError(body?.message ?? DEFAULT_ERROR_MESSAGE, response.status, body?.code)
  }

  return (await response.json()) as T
}

async function requestVoid(path: string, accessToken: string, init?: RequestInit): Promise<void> {
  let response: Response

  try {
    response = await fetch(path, {
      ...init,
      headers: {
        ...(init?.headers ?? {}),
        Authorization: `Bearer ${accessToken}`,
      },
    })
  } catch {
    throw new AssignmentApiError(NETWORK_ERROR_MESSAGE, 0)
  }

  if (!response.ok) {
    const body: Partial<AssignmentApiErrorBody> | null = await response.json().catch(() => null)
    throw new AssignmentApiError(body?.message ?? DEFAULT_ERROR_MESSAGE, response.status, body?.code)
  }
}

export interface AssignmentApi {
  listAssignments(
    accessToken: string,
    filters?: AssignmentListFilters,
  ): Promise<QuestionPageResponse<AssignmentListItem>>
  getAssignment(accessToken: string, id: number): Promise<AssignmentDetail>
  // 201 response omits `questions` (see docs/api-spec-detail.md#post-apiassignments),
  // unlike GET detail/PATCH which both return the full AssignmentDetail shape.
  createAssignment(accessToken: string, payload: AssignmentCreateRequest): Promise<AssignmentListItem>
  updateAssignment(accessToken: string, id: number, payload: AssignmentUpdateRequest): Promise<AssignmentDetail>
  deleteAssignment(accessToken: string, id: number): Promise<void>
}

async function listAssignments(
  accessToken: string,
  filters: AssignmentListFilters = {},
): Promise<QuestionPageResponse<AssignmentListItem>> {
  const query = serializeAssignmentListFilters(filters)
  const path = query ? `${ASSIGNMENTS_PATH}?${query}` : ASSIGNMENTS_PATH

  const raw = await request<RawPageResponse<RawAssignmentListItem>>(path, accessToken)

  return {
    ...raw,
    content: raw.content.map(parseAssignmentListItem),
  }
}

async function getAssignment(accessToken: string, id: number): Promise<AssignmentDetail> {
  const raw = await request<RawAssignmentDetail>(`${ASSIGNMENTS_PATH}/${id}`, accessToken)
  return parseAssignmentDetail(raw)
}

async function createAssignment(accessToken: string, payload: AssignmentCreateRequest): Promise<AssignmentListItem> {
  const raw = await request<RawAssignmentListItem>(ASSIGNMENTS_PATH, accessToken, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(serializeAssignmentCreateRequest(payload)),
  })

  return parseAssignmentListItem(raw)
}

async function updateAssignment(
  accessToken: string,
  id: number,
  payload: AssignmentUpdateRequest,
): Promise<AssignmentDetail> {
  const raw = await request<RawAssignmentDetail>(`${ASSIGNMENTS_PATH}/${id}`, accessToken, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(serializeAssignmentUpdateRequest(payload)),
  })

  return parseAssignmentDetail(raw)
}

async function deleteAssignment(accessToken: string, id: number): Promise<void> {
  await requestVoid(`${ASSIGNMENTS_PATH}/${id}`, accessToken, { method: 'DELETE' })
}

export const assignmentApi: AssignmentApi = {
  listAssignments,
  getAssignment,
  createAssignment,
  updateAssignment,
  deleteAssignment,
}

// Re-exported so callers only need to import from './assignmentApi'.
export type {
  AssignmentApiErrorBody,
  AssignmentClassTarget,
  AssignmentCreateRequest,
  AssignmentDetail,
  AssignmentListFilters,
  AssignmentListItem,
  AssignmentQuestionSummary,
  AssignmentStatus,
  AssignmentStudentTarget,
  AssignmentTarget,
  AssignmentTargetType,
  AssignmentUpdateRequest,
} from './assignmentTypes'
