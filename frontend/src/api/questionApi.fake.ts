// Fake adapter for the upcoming list/filter screen's UI tests. It implements
// the same QuestionApi interface as the real client so tests can swap one for
// the other, but it is a standalone module: the real client never imports or
// falls back to this, and there is no environment switch selecting between them.
import type { QuestionApi } from './questionApi'
import { QuestionApiError } from './questionApi'
import type { QuestionCreateRequest, QuestionDetail, QuestionListFilters, QuestionListItem, QuestionPageResponse } from './questionTypes'

export const QUESTION_FIXTURES: readonly QuestionDetail[] = [
  {
    id: 1024,
    category: '현재완료',
    type: 'MULTIPLE_CHOICE',
    level: 'INTERMEDIATE',
    status: 'ACTIVE',
    text: 'He has lived here _____ 2010.',
    choices: ['for', 'since', 'during', 'from'],
    answer: 'since',
    explanation: '특정 시작 시점과 현재완료가 함께 쓰일 때 since를 사용합니다.',
    createdAt: '2026-07-20T10:15:00',
  },
  {
    id: 1025,
    category: '수동태',
    type: 'MULTIPLE_CHOICE',
    level: 'BASIC',
    status: 'ACTIVE',
    text: 'The window _____ by the wind last night.',
    choices: ['broke', 'was broken', 'has broken', 'is breaking'],
    answer: 'was broken',
    explanation: '주어(window)가 동작을 당하는 대상이므로 수동태(be + p.p.)를 사용합니다.',
    createdAt: '2026-07-21T09:30:00',
  },
  {
    id: 1030,
    category: '가정법',
    type: 'MULTIPLE_CHOICE',
    level: 'ADVANCED',
    status: 'DRAFT',
    text: 'If I _____ known, I would have called you.',
    choices: ['have', 'had', 'has', 'having'],
    answer: 'had',
    explanation: '과거 사실의 반대를 가정하는 가정법 과거완료는 If + had p.p.를 사용합니다.',
    createdAt: '2026-08-07T09:00:00',
  },
]

function matchesFilters(question: QuestionDetail, filters: QuestionListFilters): boolean {
  if (filters.category && question.category !== filters.category) {
    return false
  }
  if (filters.type && question.type !== filters.type) {
    return false
  }
  if (filters.level && question.level !== filters.level) {
    return false
  }
  if (filters.status && question.status !== filters.status) {
    return false
  }
  if (filters.keyword && !question.text.includes(filters.keyword)) {
    return false
  }
  return true
}

function toListItem(question: QuestionDetail): QuestionListItem {
  const { id, category, type, level, status, text } = question
  return { id, category, type, level, status, text }
}

// Each call gets its own isolated, mutable fixture set so tests don't leak state into each other.
export function createFakeQuestionApi(initialFixtures: readonly QuestionDetail[] = QUESTION_FIXTURES): QuestionApi {
  const questions: QuestionDetail[] = initialFixtures.map((question) => ({ ...question }))
  let nextId = Math.max(0, ...questions.map((question) => question.id)) + 1

  async function listQuestions(
    _accessToken: string,
    filters: QuestionListFilters = {},
  ): Promise<QuestionPageResponse<QuestionListItem>> {
    const page = filters.page ?? 0
    const size = filters.size ?? 20

    const matched = questions.filter((question) => matchesFilters(question, filters))
    const start = page * size
    const content = matched.slice(start, start + size).map(toListItem)

    return {
      content,
      page,
      size,
      totalElements: matched.length,
      totalPages: Math.ceil(matched.length / size) || 0,
    }
  }

  async function getQuestion(_accessToken: string, id: number): Promise<QuestionDetail> {
    const question = questions.find((candidate) => candidate.id === id)
    if (!question) {
      throw new QuestionApiError('문제를 찾을 수 없습니다.', 404, 'QUESTION_NOT_FOUND')
    }
    return { ...question }
  }

  async function createQuestion(_accessToken: string, payload: QuestionCreateRequest): Promise<QuestionDetail> {
    const created: QuestionDetail = {
      id: nextId++,
      category: payload.category,
      type: payload.type,
      level: payload.level,
      status: 'DRAFT',
      text: payload.text,
      choices: payload.choices,
      answer: payload.answer,
      explanation: payload.explanation,
      createdAt: new Date().toISOString(),
    }
    questions.push(created)
    return { ...created }
  }

  return { listQuestions, getQuestion, createQuestion }
}
