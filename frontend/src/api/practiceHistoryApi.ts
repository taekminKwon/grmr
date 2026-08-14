import { questionLevelFromLabel, type QuestionApiErrorBody, type QuestionPageResponse } from './questionTypes'
import {
  serializeStudyRecordListFilters,
  type StudyRecordDetail,
  type StudyRecordListFilters,
  type StudyRecordQuestionSnapshot,
  type StudyRecordSummary,
  type StudyRecordType,
} from './practiceHistoryTypes'

export class StudyRecordApiError extends Error {
  code?: string
  status: number

  constructor(message: string, status: number, code?: string) {
    super(message)
    this.name = 'StudyRecordApiError'
    this.status = status
    this.code = code
  }
}

const RECORDS_PATH = '/api/me/practice/records'

const DEFAULT_ERROR_MESSAGE = '요청을 처리하지 못했습니다. 잠시 후 다시 시도해주세요.'
const NETWORK_ERROR_MESSAGE = '네트워크 오류가 발생했습니다. 연결 상태를 확인해주세요.'

// Shape of `level` as it actually appears on the wire: a Korean label.
// `type` is already the raw wire value ("PRACTICE"), not a translated label.
type RawStudyRecordSummary = {
  id: number
  questionId: number
  type: string
  category: string
  level: string
  correct: boolean
  submittedAt: string
}

type RawStudyRecordQuestionSnapshot = {
  category: string
  level: string
  text: string
  choices: string[]
  correctAnswer: string
  explanation: string
}

type RawStudyRecordDetail = {
  id: number
  questionId: number
  type: string
  question: RawStudyRecordQuestionSnapshot
  submittedAnswer: string
  correct: boolean
  submittedAt: string
}

type RawPageResponse<T> = {
  content: T[]
  page: number
  size: number
  totalElements: number
  totalPages: number
}

function parseStudyRecordSummary(raw: RawStudyRecordSummary): StudyRecordSummary {
  return {
    id: raw.id,
    questionId: raw.questionId,
    type: raw.type as StudyRecordType,
    category: raw.category,
    level: questionLevelFromLabel(raw.level),
    correct: raw.correct,
    submittedAt: raw.submittedAt,
  }
}

function parseStudyRecordQuestionSnapshot(raw: RawStudyRecordQuestionSnapshot): StudyRecordQuestionSnapshot {
  return {
    category: raw.category,
    level: questionLevelFromLabel(raw.level),
    text: raw.text,
    choices: raw.choices,
    correctAnswer: raw.correctAnswer,
    explanation: raw.explanation,
  }
}

function parseStudyRecordDetail(raw: RawStudyRecordDetail): StudyRecordDetail {
  return {
    id: raw.id,
    questionId: raw.questionId,
    type: raw.type as StudyRecordType,
    question: parseStudyRecordQuestionSnapshot(raw.question),
    submittedAnswer: raw.submittedAnswer,
    correct: raw.correct,
    submittedAt: raw.submittedAt,
  }
}

async function request<T>(path: string, accessToken: string): Promise<T> {
  let response: Response

  try {
    response = await fetch(path, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
  } catch {
    throw new StudyRecordApiError(NETWORK_ERROR_MESSAGE, 0)
  }

  if (!response.ok) {
    const body: Partial<QuestionApiErrorBody> | null = await response.json().catch(() => null)
    throw new StudyRecordApiError(body?.message ?? DEFAULT_ERROR_MESSAGE, response.status, body?.code)
  }

  return (await response.json()) as T
}

export interface HistoryApi {
  listRecords(
    accessToken: string,
    filters?: StudyRecordListFilters,
  ): Promise<QuestionPageResponse<StudyRecordSummary>>
  getRecord(accessToken: string, id: number): Promise<StudyRecordDetail>
}

async function listRecords(
  accessToken: string,
  filters: StudyRecordListFilters = {},
): Promise<QuestionPageResponse<StudyRecordSummary>> {
  const query = serializeStudyRecordListFilters(filters)
  const path = query ? `${RECORDS_PATH}?${query}` : RECORDS_PATH

  const raw = await request<RawPageResponse<RawStudyRecordSummary>>(path, accessToken)

  return {
    ...raw,
    content: raw.content.map(parseStudyRecordSummary),
  }
}

async function getRecord(accessToken: string, id: number): Promise<StudyRecordDetail> {
  // A missing id and an id owned by another student are indistinguishable on
  // the wire: both surface as 404 STUDY_RECORD_NOT_FOUND (see docs/api-spec-detail.md).
  const raw = await request<RawStudyRecordDetail>(`${RECORDS_PATH}/${id}`, accessToken)
  return parseStudyRecordDetail(raw)
}

export const historyApi: HistoryApi = { listRecords, getRecord }

// Re-exported so callers only need to import from './practiceHistoryApi'.
export type {
  StudyRecordDetail,
  StudyRecordListFilters,
  StudyRecordQuestionSnapshot,
  StudyRecordSummary,
  StudyRecordType,
} from './practiceHistoryTypes'
