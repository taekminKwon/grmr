import { assignmentStatusFromLabel } from './assignmentTypes'
import { questionLevelFromLabel, type QuestionPageResponse } from './questionTypes'
import {
  serializeMyAssignmentListFilters,
  type AssignmentResult,
  type MyAssignmentApiErrorBody,
  type MyAssignmentListFilters,
  type MyAssignmentListItem,
  type MyAssignmentQuestion,
  type MyAssignmentQuestionsResponse,
  type SaveAnswerRequest,
  type SaveAnswerResult,
  type SubmissionStatus,
} from './myAssignmentTypes'

export class MyAssignmentApiError extends Error {
  code?: string
  status: number

  constructor(message: string, status: number, code?: string) {
    super(message)
    this.name = 'MyAssignmentApiError'
    this.status = status
    this.code = code
  }
}

const ASSIGNMENTS_PATH = '/api/me/assignments'

const DEFAULT_ERROR_MESSAGE = '요청을 처리하지 못했습니다. 잠시 후 다시 시도해주세요.'
const NETWORK_ERROR_MESSAGE = '네트워크 오류가 발생했습니다. 연결 상태를 확인해주세요.'

// Shape of `status` as it actually appears on the wire: a Korean label.
// `submissionStatus` is already the raw wire value (English enum name), never translated.
type RawMyAssignmentListItem = {
  id: number
  title: string
  startDate: string
  dueDate: string
  status: string
  submissionStatus: SubmissionStatus
  progress: number
}

// Shape of `level` as it appears on the wire: a Korean label.
type RawMyAssignmentQuestion = {
  id: number
  order: number
  category: string
  level: string
  text: string
  choices: string[]
  myAnswer: string | null
}

type RawMyAssignmentQuestionsResponse = {
  assignmentId: number
  submissionStatus: MyAssignmentQuestionsResponse['submissionStatus']
  questions: RawMyAssignmentQuestion[]
}

type RawPageResponse<T> = {
  content: T[]
  page: number
  size: number
  totalElements: number
  totalPages: number
}

function parseMyAssignmentListItem(raw: RawMyAssignmentListItem): MyAssignmentListItem {
  return {
    id: raw.id,
    title: raw.title,
    startDate: raw.startDate,
    dueDate: raw.dueDate,
    status: assignmentStatusFromLabel(raw.status),
    submissionStatus: raw.submissionStatus,
    progress: raw.progress,
  }
}

function parseMyAssignmentQuestion(raw: RawMyAssignmentQuestion): MyAssignmentQuestion {
  return {
    id: raw.id,
    order: raw.order,
    category: raw.category,
    level: questionLevelFromLabel(raw.level),
    text: raw.text,
    choices: raw.choices,
    myAnswer: raw.myAnswer,
  }
}

function parseMyAssignmentQuestionsResponse(raw: RawMyAssignmentQuestionsResponse): MyAssignmentQuestionsResponse {
  return {
    assignmentId: raw.assignmentId,
    submissionStatus: raw.submissionStatus,
    questions: raw.questions.map(parseMyAssignmentQuestion),
  }
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
    throw new MyAssignmentApiError(NETWORK_ERROR_MESSAGE, 0)
  }

  if (!response.ok) {
    const body: Partial<MyAssignmentApiErrorBody> | null = await response.json().catch(() => null)
    throw new MyAssignmentApiError(body?.message ?? DEFAULT_ERROR_MESSAGE, response.status, body?.code)
  }

  return (await response.json()) as T
}

export interface MyAssignmentApi {
  listAssignments(
    accessToken: string,
    filters?: MyAssignmentListFilters,
  ): Promise<QuestionPageResponse<MyAssignmentListItem>>
  getAssignmentQuestions(accessToken: string, assignmentId: number): Promise<MyAssignmentQuestionsResponse>
  // Path params (assignmentId/questionId) stay separate from the request
  // body, mirroring the backend's PUT .../answers/{questionId} route.
  saveAnswer(
    accessToken: string,
    assignmentId: number,
    questionId: number,
    payload: SaveAnswerRequest,
  ): Promise<SaveAnswerResult>
  submitAssignment(accessToken: string, assignmentId: number): Promise<AssignmentResult>
  getAssignmentResult(accessToken: string, assignmentId: number): Promise<AssignmentResult>
}

async function listAssignments(
  accessToken: string,
  filters: MyAssignmentListFilters = {},
): Promise<QuestionPageResponse<MyAssignmentListItem>> {
  const query = serializeMyAssignmentListFilters(filters)
  const path = query ? `${ASSIGNMENTS_PATH}?${query}` : ASSIGNMENTS_PATH

  const raw = await request<RawPageResponse<RawMyAssignmentListItem>>(path, accessToken)

  return {
    ...raw,
    content: raw.content.map(parseMyAssignmentListItem),
  }
}

async function getAssignmentQuestions(
  accessToken: string,
  assignmentId: number,
): Promise<MyAssignmentQuestionsResponse> {
  const raw = await request<RawMyAssignmentQuestionsResponse>(
    `${ASSIGNMENTS_PATH}/${assignmentId}/questions`,
    accessToken,
  )
  return parseMyAssignmentQuestionsResponse(raw)
}

// Response fields (questionId/answer/savedAt) carry no Korean-label
// enums, so the wire shape needs no translation before returning it.
async function saveAnswer(
  accessToken: string,
  assignmentId: number,
  questionId: number,
  payload: SaveAnswerRequest,
): Promise<SaveAnswerResult> {
  return request<SaveAnswerResult>(`${ASSIGNMENTS_PATH}/${assignmentId}/answers/${questionId}`, accessToken, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
}

// Grading result fields carry no Korean-label enums either (submissionStatus
// is always the literal "SUBMITTED"), so no translation is needed here.
async function submitAssignment(accessToken: string, assignmentId: number): Promise<AssignmentResult> {
  return request<AssignmentResult>(`${ASSIGNMENTS_PATH}/${assignmentId}/submit`, accessToken, {
    method: 'POST',
  })
}

async function getAssignmentResult(accessToken: string, assignmentId: number): Promise<AssignmentResult> {
  return request<AssignmentResult>(`${ASSIGNMENTS_PATH}/${assignmentId}/result`, accessToken)
}

export const myAssignmentApi: MyAssignmentApi = {
  listAssignments,
  getAssignmentQuestions,
  saveAnswer,
  submitAssignment,
  getAssignmentResult,
}

// Re-exported so callers only need to import from './myAssignmentApi'.
export type {
  AssignmentResult,
  AssignmentResultItem,
  MyAssignmentApiErrorBody,
  MyAssignmentListFilters,
  MyAssignmentListItem,
  MyAssignmentQuestion,
  MyAssignmentQuestionsResponse,
  SaveAnswerRequest,
  SaveAnswerResult,
  SubmissionStatus,
} from './myAssignmentTypes'
