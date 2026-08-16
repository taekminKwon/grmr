// Fake adapter for the upcoming STUDENT assignment CBT screens' UI tests. It
// implements the same MyAssignmentApi interface as the real client so tests
// can swap one for the other, but it is a standalone module: the real client
// never imports or falls back to this, and there is no environment switch
// selecting between them.
import type { MyAssignmentApi } from './myAssignmentApi'
import { MyAssignmentApiError } from './myAssignmentApi'
import type {
  AssignmentResult,
  AssignmentResultItem,
  MyAssignmentListFilters,
  MyAssignmentListItem,
  MyAssignmentQuestionsResponse,
  SaveAnswerRequest,
  SaveAnswerResult,
  SubmissionStatus,
} from './myAssignmentTypes'
import type { AssignmentStatus } from './assignmentTypes'
import type { QuestionLevel } from './questionTypes'
import type { QuestionPageResponse } from './questionTypes'

// Fixed question pool the fixtures below reference by id, standing in for
// /api/questions in a way that keeps this module self-contained. Unlike the
// admin assignment fake's pool, this one also carries answer/explanation
// since grading needs them once a student submits.
const QUESTION_POOL: Readonly<
  Record<number, { category: string; level: QuestionLevel; text: string; choices: string[]; answer: string; explanation: string }>
> = {
  1024: {
    category: '현재완료',
    level: 'INTERMEDIATE',
    text: 'He has lived here _____ 2010.',
    choices: ['for', 'since', 'during', 'from'],
    answer: 'since',
    explanation: '특정 시작 시점과 현재완료가 함께 쓰일 때 since를 사용합니다.',
  },
  1023: {
    category: '현재완료',
    level: 'INTERMEDIATE',
    text: 'She _____ here since last year.',
    choices: ['for', 'since', 'during', 'from'],
    answer: 'since',
    explanation: '특정 시작 시점과 현재완료가 함께 쓰일 때 since를 사용합니다.',
  },
  1021: {
    category: '가정법',
    level: 'ADVANCED',
    text: 'If I _____ you, I would study harder.',
    choices: ['am', 'was', 'were', 'be'],
    answer: 'were',
    explanation: '가정법 과거에서는 주어의 인칭에 관계없이 be동사로 were를 씁니다.',
  },
}

type FakeAssignment = {
  id: number
  title: string
  startDate: string
  dueDate: string
  // Baked directly (like the admin fake's fixtures) rather than derived from
  // startDate/dueDate against the real clock, so fixtures stay stable
  // regardless of when tests run. UPCOMING fixtures are hidden from every
  // endpoint exactly like a scheduled assignment on the real backend.
  status: AssignmentStatus
  questionIds: readonly number[]
  // Optional pre-existing submission, for fixtures that need to already be
  // SUBMITTED at test start (e.g. a CLOSED assignment submitted before it closed).
  seed?: { answers: Readonly<Record<number, string>>; submittedAt: string }
}

export const ASSIGNMENT_FIXTURES: readonly FakeAssignment[] = [
  {
    id: 1,
    title: '현재완료 시제 연습',
    startDate: '2026-08-03',
    dueDate: '2026-08-20',
    status: 'IN_PROGRESS',
    questionIds: [1024, 1023, 1021],
  },
  {
    id: 2,
    title: '수동태 예정 과제',
    startDate: '2026-09-01',
    dueDate: '2026-09-07',
    status: 'UPCOMING',
    questionIds: [1024],
  },
  {
    id: 3,
    title: '가정법 마감 후 재제출 시도',
    startDate: '2026-07-01',
    dueDate: '2026-07-10',
    status: 'CLOSED',
    questionIds: [1021],
    seed: { answers: { 1021: 'were' }, submittedAt: '2026-07-05T09:00:00' },
  },
  {
    id: 4,
    title: '수동태 마감 미제출 과제',
    startDate: '2026-07-01',
    dueDate: '2026-07-10',
    status: 'CLOSED',
    questionIds: [1024],
  },
]

type SubmissionRecord = {
  status: SubmissionStatus
  answers: Map<number, string>
  result: AssignmentResult | null
}

function isHidden(assignment: FakeAssignment): boolean {
  return assignment.status === 'UPCOMING'
}

function computeProgress(answeredCount: number, totalQuestions: number): number {
  if (totalQuestions === 0) {
    return 0
  }
  return Math.round((answeredCount / totalQuestions) * 100)
}

function grade(assignment: FakeAssignment, answers: Map<number, string>, submittedAt: string): AssignmentResult {
  const results: AssignmentResultItem[] = assignment.questionIds.map((questionId) => {
    const question = QUESTION_POOL[questionId]
    const submittedAnswer = answers.get(questionId) ?? null
    return {
      questionId,
      submittedAnswer,
      correct: submittedAnswer !== null && submittedAnswer === question.answer,
      correctAnswer: question.answer,
      explanation: question.explanation,
    }
  })

  const totalQuestions = assignment.questionIds.length
  const answeredQuestions = results.filter((result) => result.submittedAnswer !== null).length
  const correctCount = results.filter((result) => result.correct).length

  return {
    assignmentId: assignment.id,
    submissionStatus: 'SUBMITTED',
    submittedAt,
    totalQuestions,
    answeredQuestions,
    correctCount,
    score: totalQuestions === 0 ? 0 : Math.round((correctCount / totalQuestions) * 100),
    results,
  }
}

// Each call gets its own isolated, mutable fixture set and submission-state
// map so tests don't leak state into each other.
export function createFakeMyAssignmentApi(
  initialFixtures: readonly FakeAssignment[] = ASSIGNMENT_FIXTURES,
): MyAssignmentApi {
  const assignments: FakeAssignment[] = initialFixtures.map((assignment) => ({
    ...assignment,
    questionIds: [...assignment.questionIds],
  }))
  const submissions = new Map<number, SubmissionRecord>()

  // Seed fixtures that must already be SUBMITTED at test start.
  for (const assignment of assignments) {
    if (!assignment.seed) {
      continue
    }
    const answers = new Map(Object.entries(assignment.seed.answers).map(([questionId, answer]) => [Number(questionId), answer]))
    submissions.set(assignment.id, {
      status: 'SUBMITTED',
      answers,
      result: grade(assignment, answers, assignment.seed.submittedAt),
    })
  }

  function findAssignment(assignmentId: number): FakeAssignment | undefined {
    return assignments.find((candidate) => candidate.id === assignmentId)
  }

  // Not-found and not-a-target are indistinguishable on the wire (both
  // ASSIGNMENT_NOT_FOUND); a fixture simply absent from `assignments` stands
  // in for "not this student's assignment". Hidden (UPCOMING) fixtures get
  // the identical 404 across every endpoint, matching the scheduled-hidden rule.
  function requireVisibleAssignment(assignmentId: number): FakeAssignment {
    const assignment = findAssignment(assignmentId)
    if (!assignment || isHidden(assignment)) {
      throw new MyAssignmentApiError('과제를 찾을 수 없습니다.', 404, 'ASSIGNMENT_NOT_FOUND')
    }
    return assignment
  }

  function getOrCreateSubmission(assignmentId: number): SubmissionRecord {
    let submission = submissions.get(assignmentId)
    if (!submission) {
      submission = { status: 'NOT_STARTED', answers: new Map(), result: null }
      submissions.set(assignmentId, submission)
    }
    return submission
  }

  async function listAssignments(
    _accessToken: string,
    filters: MyAssignmentListFilters = {},
  ): Promise<QuestionPageResponse<MyAssignmentListItem>> {
    const page = filters.page ?? 0
    const size = filters.size ?? 20

    const visible = assignments
      .filter((assignment) => !isHidden(assignment))
      .slice()
      .sort((a, b) => (a.dueDate < b.dueDate ? -1 : a.dueDate > b.dueDate ? 1 : 0))

    const items: MyAssignmentListItem[] = visible.map((assignment) => {
      const submission = submissions.get(assignment.id)
      return {
        id: assignment.id,
        title: assignment.title,
        startDate: assignment.startDate,
        dueDate: assignment.dueDate,
        status: assignment.status,
        submissionStatus: submission?.status ?? 'NOT_STARTED',
        progress: computeProgress(submission?.answers.size ?? 0, assignment.questionIds.length),
      }
    })

    const start = page * size
    const content = items.slice(start, start + size)

    return {
      content,
      page,
      size,
      totalElements: items.length,
      totalPages: Math.ceil(items.length / size) || 0,
    }
  }

  async function getAssignmentQuestions(
    _accessToken: string,
    assignmentId: number,
  ): Promise<MyAssignmentQuestionsResponse> {
    const assignment = requireVisibleAssignment(assignmentId)
    const submission = getOrCreateSubmission(assignmentId)
    // First call ("시작하기") creates IN_PROGRESS; later calls ("이어서 풀기")
    // just return the existing state, including once SUBMITTED.
    if (submission.status === 'NOT_STARTED') {
      submission.status = 'IN_PROGRESS'
    }

    return {
      assignmentId,
      submissionStatus: submission.status as Extract<SubmissionStatus, 'IN_PROGRESS' | 'SUBMITTED'>,
      questions: assignment.questionIds.map((questionId, index) => {
        const question = QUESTION_POOL[questionId]
        return {
          id: questionId,
          order: index + 1,
          category: question.category,
          level: question.level,
          text: question.text,
          choices: [...question.choices],
          myAnswer: submission.answers.get(questionId) ?? null,
        }
      }),
    }
  }

  async function saveAnswer(
    _accessToken: string,
    assignmentId: number,
    questionId: number,
    payload: SaveAnswerRequest,
  ): Promise<SaveAnswerResult> {
    const assignment = requireVisibleAssignment(assignmentId)
    if (!assignment.questionIds.includes(questionId)) {
      throw new MyAssignmentApiError('과제에 포함되지 않은 문제입니다.', 404, 'QUESTION_NOT_IN_ASSIGNMENT')
    }
    // Closed blocks writes regardless of submission status, checked before
    // the already-submitted check (see docs/api-spec-detail.md).
    if (assignment.status === 'CLOSED') {
      throw new MyAssignmentApiError('마감된 과제에는 답안을 저장할 수 없습니다.', 409, 'ASSIGNMENT_CLOSED')
    }

    const submission = getOrCreateSubmission(assignmentId)
    if (submission.status === 'SUBMITTED') {
      throw new MyAssignmentApiError('이미 제출된 과제는 답안을 수정할 수 없습니다.', 409, 'ASSIGNMENT_ALREADY_SUBMITTED')
    }
    if (submission.status === 'NOT_STARTED') {
      submission.status = 'IN_PROGRESS'
    }

    // Upsert: overwrites any previous draft for this questionId rather than
    // accumulating entries, matching the backend's PUT-is-overwrite contract.
    submission.answers.set(questionId, payload.answer)

    return { questionId, answer: payload.answer, savedAt: new Date().toISOString() }
  }

  async function submitAssignment(_accessToken: string, assignmentId: number): Promise<AssignmentResult> {
    const assignment = requireVisibleAssignment(assignmentId)
    if (assignment.status === 'CLOSED') {
      throw new MyAssignmentApiError('마감된 과제는 제출할 수 없습니다.', 409, 'ASSIGNMENT_CLOSED')
    }

    const submission = getOrCreateSubmission(assignmentId)
    if (submission.status === 'SUBMITTED') {
      throw new MyAssignmentApiError('이미 제출된 과제입니다.', 409, 'ASSIGNMENT_ALREADY_SUBMITTED')
    }

    const result = grade(assignment, submission.answers, new Date().toISOString())
    submission.status = 'SUBMITTED'
    submission.result = result
    return result
  }

  async function getAssignmentResult(_accessToken: string, assignmentId: number): Promise<AssignmentResult> {
    requireVisibleAssignment(assignmentId)
    const submission = submissions.get(assignmentId)
    if (!submission || submission.status !== 'SUBMITTED' || !submission.result) {
      throw new MyAssignmentApiError('아직 제출하지 않은 과제입니다.', 409, 'ASSIGNMENT_NOT_SUBMITTED')
    }
    // Re-serves the stored snapshot without regrading, so repeated reads are stable.
    return submission.result
  }

  return { listAssignments, getAssignmentQuestions, saveAnswer, submitAssignment, getAssignmentResult }
}
