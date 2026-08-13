import { questionLevelFromLabel, questionTypeFromLabel, type QuestionApiErrorBody } from './questionTypes'
import {
  serializePracticeQuestionFilters,
  type PracticeAnswerRequest,
  type PracticeAnswerResult,
  type PracticeQuestion,
  type PracticeQuestionFilters,
} from './practiceTypes'

export class PracticeApiError extends Error {
  code?: string
  status: number

  constructor(message: string, status: number, code?: string) {
    super(message)
    this.name = 'PracticeApiError'
    this.status = status
    this.code = code
  }
}

const NEXT_QUESTION_PATH = '/api/me/practice/questions/next'
const ANSWERS_PATH = '/api/me/practice/answers'

const DEFAULT_ERROR_MESSAGE = '요청을 처리하지 못했습니다. 잠시 후 다시 시도해주세요.'
const NETWORK_ERROR_MESSAGE = '네트워크 오류가 발생했습니다. 연결 상태를 확인해주세요.'

// Shape of `type`/`level` as they actually appear on the wire: Korean labels.
type RawPracticeQuestion = {
  id: number
  category: string
  type: string
  level: string
  text: string
  choices: string[]
}

function parsePracticeQuestion(raw: RawPracticeQuestion): PracticeQuestion {
  return {
    id: raw.id,
    category: raw.category,
    type: questionTypeFromLabel(raw.type),
    level: questionLevelFromLabel(raw.level),
    text: raw.text,
    choices: raw.choices,
  }
}

async function fetchWithAuth(path: string, accessToken: string, init?: RequestInit): Promise<Response> {
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
    throw new PracticeApiError(NETWORK_ERROR_MESSAGE, 0)
  }

  if (!response.ok) {
    const body: Partial<QuestionApiErrorBody> | null = await response.json().catch(() => null)
    throw new PracticeApiError(body?.message ?? DEFAULT_ERROR_MESSAGE, response.status, body?.code)
  }

  return response
}

export interface PracticeApi {
  getNextQuestion(accessToken: string, filters?: PracticeQuestionFilters): Promise<PracticeQuestion>
  submitAnswer(accessToken: string, payload: PracticeAnswerRequest): Promise<PracticeAnswerResult>
}

async function getNextQuestion(
  accessToken: string,
  filters: PracticeQuestionFilters = {},
): Promise<PracticeQuestion> {
  const query = serializePracticeQuestionFilters(filters)
  const path = query ? `${NEXT_QUESTION_PATH}?${query}` : NEXT_QUESTION_PATH

  // An empty pool (no question matches the filters) is surfaced by the
  // backend as 404 NO_QUESTION_AVAILABLE, handled like any other error by
  // fetchWithAuth — not as a 204/null success case.
  const response = await fetchWithAuth(path, accessToken)

  const raw = (await response.json()) as RawPracticeQuestion
  return parsePracticeQuestion(raw)
}

async function submitAnswer(accessToken: string, payload: PracticeAnswerRequest): Promise<PracticeAnswerResult> {
  const response = await fetchWithAuth(ANSWERS_PATH, accessToken, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })

  return (await response.json()) as PracticeAnswerResult
}

export const practiceApi: PracticeApi = { getNextQuestion, submitAnswer }

// Re-exported so callers only need to import from './practiceApi'.
export type {
  PracticeAnswerRequest,
  PracticeAnswerResult,
  PracticeQuestion,
  PracticeQuestionFilters,
} from './practiceTypes'
