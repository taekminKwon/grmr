// Fake adapter for the upcoming STUDENT history list/detail screens' UI
// tests. It implements the same HistoryApi interface as the real client so
// tests can swap one for the other, but it is a standalone module: the real
// client never imports or falls back to this, and there is no environment
// switch selecting between them.
//
// Every fixture here represents a record already owned by the current
// student — the fake has no concept of "other students' records" since it
// models a single account's view, matching what `/api/me/**` always returns.
import type { HistoryApi } from './practiceHistoryApi'
import { StudyRecordApiError } from './practiceHistoryApi'
import type { StudyRecordDetail, StudyRecordListFilters, StudyRecordSummary } from './practiceHistoryTypes'
import type { QuestionPageResponse } from './questionTypes'

export const STUDY_RECORD_FIXTURES: readonly StudyRecordDetail[] = [
  {
    id: 501,
    questionId: 1021,
    type: 'PRACTICE',
    question: {
      category: '가정법',
      level: 'ADVANCED',
      text: 'If I _____ you, I would study harder.',
      choices: ['am', 'was', 'were', 'be'],
      correctAnswer: 'were',
      explanation: '가정법 과거에서는 주어의 인칭에 관계없이 be동사로 were를 씁니다.',
    },
    submittedAnswer: 'were',
    correct: true,
    submittedAt: '2026-08-13T10:15:00',
  },
  // Re-attempt of the same question: a new, distinct record rather than an
  // overwrite of #501 (StudyRecord submissions are never idempotent).
  {
    id: 502,
    questionId: 1021,
    type: 'PRACTICE',
    question: {
      category: '가정법',
      level: 'ADVANCED',
      text: 'If I _____ you, I would study harder.',
      choices: ['am', 'was', 'were', 'be'],
      correctAnswer: 'were',
      explanation: '가정법 과거에서는 주어의 인칭에 관계없이 be동사로 were를 씁니다.',
    },
    submittedAnswer: 'am',
    correct: false,
    submittedAt: '2026-08-13T10:16:00',
  },
  {
    id: 503,
    questionId: 2001,
    type: 'PRACTICE',
    question: {
      category: '현재완료',
      level: 'INTERMEDIATE',
      text: 'He has lived here _____ 2010.',
      choices: ['for', 'since', 'during', 'from'],
      correctAnswer: 'since',
      explanation: '특정 시작 시점과 현재완료가 함께 쓰일 때 since를 사용합니다.',
    },
    submittedAnswer: 'since',
    correct: true,
    submittedAt: '2026-08-12T09:00:00',
  },
  {
    id: 504,
    questionId: 2001,
    type: 'PRACTICE',
    question: {
      category: '현재완료',
      level: 'INTERMEDIATE',
      text: 'He has lived here _____ 2010.',
      choices: ['for', 'since', 'during', 'from'],
      correctAnswer: 'since',
      explanation: '특정 시작 시점과 현재완료가 함께 쓰일 때 since를 사용합니다.',
    },
    submittedAnswer: 'for',
    correct: false,
    submittedAt: '2026-08-11T08:00:00',
  },
  {
    id: 505,
    questionId: 1025,
    type: 'PRACTICE',
    question: {
      category: '수동태',
      level: 'BASIC',
      text: 'The window _____ by the wind last night.',
      choices: ['broke', 'was broken', 'has broken', 'is breaking'],
      correctAnswer: 'was broken',
      explanation: '주어(window)가 동작을 당하는 대상이므로 수동태(be + p.p.)를 사용합니다.',
    },
    submittedAnswer: 'was broken',
    correct: true,
    submittedAt: '2026-08-10T07:30:00',
  },
]

function matchesFilters(record: StudyRecordDetail, filters: StudyRecordListFilters): boolean {
  if (filters.category && record.question.category !== filters.category) {
    return false
  }
  return true
}

function toSummary(record: StudyRecordDetail): StudyRecordSummary {
  return {
    id: record.id,
    questionId: record.questionId,
    type: record.type,
    category: record.question.category,
    level: record.question.level,
    correct: record.correct,
    submittedAt: record.submittedAt,
  }
}

function cloneRecord(record: StudyRecordDetail): StudyRecordDetail {
  return { ...record, question: { ...record.question } }
}

// Each call gets its own isolated, mutable fixture set so tests don't leak state into each other.
export function createFakeHistoryApi(
  initialFixtures: readonly StudyRecordDetail[] = STUDY_RECORD_FIXTURES,
): HistoryApi {
  const records: StudyRecordDetail[] = initialFixtures.map(cloneRecord)

  async function listRecords(
    _accessToken: string,
    filters: StudyRecordListFilters = {},
  ): Promise<QuestionPageResponse<StudyRecordSummary>> {
    const page = filters.page ?? 0
    const size = filters.size ?? 20

    // Newest submission first, matching the backend's submittedAt-descending order.
    const matched = records
      .filter((record) => matchesFilters(record, filters))
      .slice()
      .sort((a, b) => b.submittedAt.localeCompare(a.submittedAt))

    const start = page * size
    const content = matched.slice(start, start + size).map(toSummary)

    return {
      content,
      page,
      size,
      totalElements: matched.length,
      totalPages: Math.ceil(matched.length / size) || 0,
    }
  }

  async function getRecord(_accessToken: string, id: number): Promise<StudyRecordDetail> {
    const record = records.find((candidate) => candidate.id === id)
    if (!record) {
      throw new StudyRecordApiError('학습 기록을 찾을 수 없습니다.', 404, 'STUDY_RECORD_NOT_FOUND')
    }
    return cloneRecord(record)
  }

  return { listRecords, getRecord }
}
