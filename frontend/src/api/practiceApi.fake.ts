// Fake adapter for the upcoming STUDENT practice screen's UI tests. It
// implements the same PracticeApi interface as the real client so tests can
// swap one for the other, but it is a standalone module: the real client
// never imports or falls back to this, and there is no environment switch
// selecting between them.
import type { PracticeApi } from './practiceApi'
import { PracticeApiError } from './practiceApi'
import type {
  PracticeAnswerRequest,
  PracticeAnswerResult,
  PracticeQuestion,
  PracticeQuestionFilters,
} from './practiceTypes'
import { PHASE_1_QUESTION_TYPES, type QuestionLevel, type QuestionStatus, type QuestionType } from './questionTypes'

type PracticeFixtureQuestion = {
  id: number
  category: string
  type: QuestionType
  level: QuestionLevel
  status: QuestionStatus
  text: string
  choices: string[]
  answer: string
  explanation: string
}

export const PRACTICE_QUESTION_FIXTURES: readonly PracticeFixtureQuestion[] = [
  {
    id: 2001,
    category: '현재완료',
    type: 'MULTIPLE_CHOICE',
    level: 'INTERMEDIATE',
    status: 'ACTIVE',
    text: 'He has lived here _____ 2010.',
    choices: ['for', 'since', 'during', 'from'],
    answer: 'since',
    explanation: '특정 시작 시점과 현재완료가 함께 쓰일 때 since를 사용합니다.',
  },
  {
    id: 2002,
    category: '수동태',
    type: 'MULTIPLE_CHOICE',
    level: 'BASIC',
    status: 'ACTIVE',
    text: 'The window _____ by the wind last night.',
    choices: ['broke', 'was broken', 'has broken', 'is breaking'],
    answer: 'was broken',
    explanation: '주어(window)가 동작을 당하는 대상이므로 수동태(be + p.p.)를 사용합니다.',
  },
  // INACTIVE: exists but must never be delivered or accept submissions.
  {
    id: 2003,
    category: '가정법',
    type: 'MULTIPLE_CHOICE',
    level: 'ADVANCED',
    status: 'INACTIVE',
    text: 'If I _____ known, I would have called you.',
    choices: ['have', 'had', 'has', 'having'],
    answer: 'had',
    explanation: '과거 사실의 반대를 가정하는 가정법 과거완료는 If + had p.p.를 사용합니다.',
  },
  // ACTIVE but outside Phase 1 scope (FILL_IN_BLANK): must never be delivered.
  {
    id: 2004,
    category: '관계대명사',
    type: 'FILL_IN_BLANK',
    level: 'INTERMEDIATE',
    status: 'ACTIVE',
    text: 'This is the book _____ I borrowed.',
    choices: [],
    answer: 'which',
    explanation: '사물을 선행사로 받는 목적격 관계대명사는 which를 사용합니다.',
  },
  // DRAFT: exists but must never be delivered or accept submissions.
  {
    id: 2005,
    category: '비교급',
    type: 'MULTIPLE_CHOICE',
    level: 'BASIC',
    status: 'DRAFT',
    text: 'This book is _____ than that one.',
    choices: ['interesting', 'more interesting', 'most interesting', 'interestinger'],
    answer: 'more interesting',
    explanation: '2음절 이상의 형용사는 more를 붙여 비교급을 만듭니다.',
  },
]

function isDeliverable(question: PracticeFixtureQuestion): boolean {
  return question.status === 'ACTIVE' && PHASE_1_QUESTION_TYPES.includes(question.type)
}

function matchesFilters(question: PracticeFixtureQuestion, filters: PracticeQuestionFilters): boolean {
  if (filters.category && question.category !== filters.category) {
    return false
  }
  if (filters.level && question.level !== filters.level) {
    return false
  }
  return true
}

function toDeliveredQuestion(question: PracticeFixtureQuestion): PracticeQuestion {
  const { id, category, type, level, text, choices } = question
  return { id, category, type, level, text, choices }
}

// Each call gets its own isolated, mutable fixture set and record-id counter
// so tests don't leak state into each other.
export function createFakePracticeApi(
  initialFixtures: readonly PracticeFixtureQuestion[] = PRACTICE_QUESTION_FIXTURES,
): PracticeApi {
  const questions: PracticeFixtureQuestion[] = initialFixtures.map((question) => ({ ...question }))
  let nextRecordId = 1

  async function getNextQuestion(
    _accessToken: string,
    filters: PracticeQuestionFilters = {},
  ): Promise<PracticeQuestion> {
    const next = questions.find((question) => isDeliverable(question) && matchesFilters(question, filters))
    if (!next) {
      throw new PracticeApiError('조건에 맞는 문제가 없습니다.', 404, 'NO_QUESTION_AVAILABLE')
    }
    return toDeliveredQuestion(next)
  }

  async function submitAnswer(_accessToken: string, payload: PracticeAnswerRequest): Promise<PracticeAnswerResult> {
    const question = questions.find((candidate) => candidate.id === payload.questionId)
    if (!question) {
      throw new PracticeApiError('문제를 찾을 수 없습니다.', 404, 'QUESTION_NOT_FOUND')
    }
    if (question.status !== 'ACTIVE') {
      throw new PracticeApiError('사용 중인 문제만 풀 수 있습니다.', 409, 'QUESTION_NOT_IN_USE')
    }
    if (!PHASE_1_QUESTION_TYPES.includes(question.type)) {
      throw new PracticeApiError('객관식 문제만 풀 수 있습니다.', 409, 'QUESTION_TYPE_NOT_SUPPORTED')
    }

    return {
      id: nextRecordId++,
      questionId: question.id,
      correct: question.answer === payload.answer,
      submittedAnswer: payload.answer,
      correctAnswer: question.answer,
      explanation: question.explanation,
      submittedAt: new Date().toISOString(),
    }
  }

  return { getNextQuestion, submitAnswer }
}
