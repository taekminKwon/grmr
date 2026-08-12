import {
  QUESTION_LEVEL_LABELS,
  QUESTION_TYPE_LABELS,
  questionLevelFromLabel,
  questionStatusFromLabel,
  questionTypeFromLabel,
  serializeQuestionListFilters,
  type QuestionApiErrorBody,
  type QuestionCreateRequest,
  type QuestionDetail,
  type QuestionListFilters,
  type QuestionListItem,
  type QuestionPageResponse,
} from './questionTypes'

export class QuestionApiError extends Error {
  code?: string
  status: number

  constructor(message: string, status: number, code?: string) {
    super(message)
    this.name = 'QuestionApiError'
    this.status = status
    this.code = code
  }
}

const QUESTIONS_PATH = '/api/questions'

const DEFAULT_ERROR_MESSAGE = '요청을 처리하지 못했습니다. 잠시 후 다시 시도해주세요.'
const NETWORK_ERROR_MESSAGE = '네트워크 오류가 발생했습니다. 연결 상태를 확인해주세요.'

// Shape of `type`/`level`/`status` as they actually appear on the wire: Korean labels.
type RawQuestionListItem = {
  id: number
  category: string
  type: string
  level: string
  status: string
  text: string
}

type RawQuestionDetail = RawQuestionListItem & {
  choices: string[]
  answer: string
  explanation: string
  createdAt: string
}

type RawPageResponse<T> = {
  content: T[]
  page: number
  size: number
  totalElements: number
  totalPages: number
}

function parseQuestionListItem(raw: RawQuestionListItem): QuestionListItem {
  return {
    id: raw.id,
    category: raw.category,
    type: questionTypeFromLabel(raw.type),
    level: questionLevelFromLabel(raw.level),
    status: questionStatusFromLabel(raw.status),
    text: raw.text,
  }
}

function parseQuestionDetail(raw: RawQuestionDetail): QuestionDetail {
  return {
    ...parseQuestionListItem(raw),
    choices: raw.choices,
    answer: raw.answer,
    explanation: raw.explanation,
    createdAt: raw.createdAt,
  }
}

function serializeQuestionCreateRequest(request: QuestionCreateRequest) {
  return {
    category: request.category,
    type: QUESTION_TYPE_LABELS[request.type],
    level: QUESTION_LEVEL_LABELS[request.level],
    text: request.text,
    choices: request.choices,
    answer: request.answer,
    explanation: request.explanation,
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
    throw new QuestionApiError(NETWORK_ERROR_MESSAGE, 0)
  }

  if (!response.ok) {
    const body: Partial<QuestionApiErrorBody> | null = await response.json().catch(() => null)
    throw new QuestionApiError(body?.message ?? DEFAULT_ERROR_MESSAGE, response.status, body?.code)
  }

  return (await response.json()) as T
}

export interface QuestionApi {
  listQuestions(
    accessToken: string,
    filters?: QuestionListFilters,
  ): Promise<QuestionPageResponse<QuestionListItem>>
  getQuestion(accessToken: string, id: number): Promise<QuestionDetail>
  createQuestion(accessToken: string, payload: QuestionCreateRequest): Promise<QuestionDetail>
}

async function listQuestions(
  accessToken: string,
  filters: QuestionListFilters = {},
): Promise<QuestionPageResponse<QuestionListItem>> {
  const query = serializeQuestionListFilters(filters)
  const path = query ? `${QUESTIONS_PATH}?${query}` : QUESTIONS_PATH

  const raw = await request<RawPageResponse<RawQuestionListItem>>(path, accessToken)

  return {
    ...raw,
    content: raw.content.map(parseQuestionListItem),
  }
}

async function getQuestion(accessToken: string, id: number): Promise<QuestionDetail> {
  const raw = await request<RawQuestionDetail>(`${QUESTIONS_PATH}/${id}`, accessToken)
  return parseQuestionDetail(raw)
}

async function createQuestion(accessToken: string, payload: QuestionCreateRequest): Promise<QuestionDetail> {
  const raw = await request<RawQuestionDetail>(QUESTIONS_PATH, accessToken, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(serializeQuestionCreateRequest(payload)),
  })

  return parseQuestionDetail(raw)
}

export const questionApi: QuestionApi = { listQuestions, getQuestion, createQuestion }

// Re-exported so callers only need to import from './questionApi'.
export type { QuestionApiErrorBody } from './questionTypes'
