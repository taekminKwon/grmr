// Fake adapter for the upcoming admin Assignment screens' UI tests. It
// implements the same AssignmentApi interface as the real client so tests can
// swap one for the other, but it is a standalone module: the real client
// never imports or falls back to this, and there is no environment switch
// selecting between them.
import type { AssignmentApi } from './assignmentApi'
import { AssignmentApiError } from './assignmentApi'
import type {
  AssignmentCreateRequest,
  AssignmentDetail,
  AssignmentListFilters,
  AssignmentListItem,
  AssignmentQuestionSummary,
  AssignmentTarget,
  AssignmentUpdateRequest,
} from './assignmentTypes'
import { computeAssignmentStatus } from './assignmentTypes'
import type { QuestionPageResponse } from './questionTypes'

// Fixed question pool the fixtures below reference by id/order, standing in
// for /api/questions in a way that keeps this module self-contained.
const QUESTION_POOL: Readonly<Record<number, { text: string; category: string }>> = {
  1024: { text: 'He has lived here _____ 2010.', category: '현재완료' },
  1023: { text: 'She _____ here since last year.', category: '현재완료' },
  1021: { text: 'If I _____ you, I would study harder.', category: '가정법' },
  1025: { text: 'The window _____ by the wind last night.', category: '수동태' },
}

// status is baked into every fixture rather than derived from startDate/dueDate
// against the real clock, so list/detail fixtures stay stable regardless of
// when tests run. Only createAssignment (which mirrors a fresh server
// computation) derives status from the current date, via computeAssignmentStatus.
export const ASSIGNMENT_FIXTURES: readonly AssignmentDetail[] = [
  {
    id: 1,
    title: '현재완료 시제 연습',
    targetType: 'CLASS',
    targetGroup: '중1 A반',
    target: '중1 A반',
    startDate: '2026-08-03',
    dueDate: '2026-08-05',
    progress: 84,
    status: 'CLOSED',
    questions: [
      { id: 1024, order: 1, ...QUESTION_POOL[1024] },
      { id: 1023, order: 2, ...QUESTION_POOL[1023] },
    ],
  },
  {
    id: 2,
    title: '가정법 복습',
    targetType: 'STUDENT',
    targetStudentId: 7,
    target: '김민수',
    startDate: '2026-08-14',
    dueDate: '2026-08-20',
    progress: 0,
    status: 'IN_PROGRESS',
    questions: [{ id: 1021, order: 1, ...QUESTION_POOL[1021] }],
  },
  {
    id: 3,
    title: '수동태 예정 과제',
    targetType: 'CLASS',
    targetGroup: '중2 B반',
    target: '중2 B반',
    startDate: '2026-09-01',
    dueDate: '2026-09-07',
    progress: 0,
    status: 'UPCOMING',
    questions: [
      { id: 1025, order: 1, ...QUESTION_POOL[1025] },
      { id: 1024, order: 2, ...QUESTION_POOL[1024] },
      { id: 1021, order: 3, ...QUESTION_POOL[1021] },
    ],
  },
]

function matchesFilters(assignment: AssignmentDetail, filters: AssignmentListFilters): boolean {
  if (filters.status && assignment.status !== filters.status) {
    return false
  }
  if (filters.keyword && !assignment.title.includes(filters.keyword)) {
    return false
  }
  return true
}

function toListItem(assignment: AssignmentDetail): AssignmentListItem {
  const { id, title, target, startDate, dueDate, progress, status } = assignment
  const common = { id, title, target, startDate, dueDate, progress, status }
  return assignment.targetType === 'CLASS'
    ? { ...common, targetType: 'CLASS', targetGroup: assignment.targetGroup }
    : { ...common, targetType: 'STUDENT', targetStudentId: assignment.targetStudentId }
}

function toQuestionSummaries(questionIds: readonly number[]): AssignmentQuestionSummary[] {
  return questionIds.map((id, index) => {
    const question = QUESTION_POOL[id]
    if (!question) {
      throw new AssignmentApiError('문제를 찾을 수 없습니다.', 404, 'QUESTION_NOT_FOUND')
    }
    return { id, order: index + 1, text: question.text, category: question.category }
  })
}

function cloneAssignment(assignment: AssignmentDetail): AssignmentDetail {
  return { ...assignment, questions: assignment.questions.map((question) => ({ ...question })) }
}

// Each call gets its own isolated, mutable fixture set so tests don't leak state into each other.
export function createFakeAssignmentApi(
  initialFixtures: readonly AssignmentDetail[] = ASSIGNMENT_FIXTURES,
): AssignmentApi {
  const assignments: AssignmentDetail[] = initialFixtures.map(cloneAssignment)
  let nextId = Math.max(0, ...assignments.map((assignment) => assignment.id)) + 1

  async function listAssignments(
    _accessToken: string,
    filters: AssignmentListFilters = {},
  ): Promise<QuestionPageResponse<AssignmentListItem>> {
    const page = filters.page ?? 0
    const size = filters.size ?? 20

    const matched = assignments.filter((assignment) => matchesFilters(assignment, filters))
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

  async function getAssignment(_accessToken: string, id: number): Promise<AssignmentDetail> {
    const assignment = assignments.find((candidate) => candidate.id === id)
    if (!assignment) {
      throw new AssignmentApiError('과제를 찾을 수 없습니다.', 404, 'ASSIGNMENT_NOT_FOUND')
    }
    return cloneAssignment(assignment)
  }

  async function createAssignment(
    _accessToken: string,
    payload: AssignmentCreateRequest,
  ): Promise<AssignmentListItem> {
    if (payload.questionIds.length === 0) {
      throw new AssignmentApiError('문제를 1개 이상 선택해야 합니다.', 400, 'INVALID_ASSIGNMENT')
    }
    if (payload.startDate > payload.dueDate) {
      throw new AssignmentApiError('시작일은 마감일보다 늦을 수 없습니다.', 400, 'INVALID_ASSIGNMENT')
    }

    const target: AssignmentTarget =
      payload.targetType === 'CLASS'
        ? { targetType: 'CLASS', targetGroup: payload.targetGroup }
        : { targetType: 'STUDENT', targetStudentId: payload.targetStudentId }

    const created: AssignmentDetail = {
      id: nextId++,
      title: payload.title,
      ...target,
      target: target.targetType === 'CLASS' ? target.targetGroup : `학생#${target.targetStudentId}`,
      startDate: payload.startDate,
      dueDate: payload.dueDate,
      progress: 0,
      status: computeAssignmentStatus(payload.startDate, payload.dueDate),
      questions: toQuestionSummaries(payload.questionIds),
    }
    assignments.push(created)
    return toListItem(created)
  }

  async function updateAssignment(
    _accessToken: string,
    id: number,
    payload: AssignmentUpdateRequest,
  ): Promise<AssignmentDetail> {
    const index = assignments.findIndex((candidate) => candidate.id === id)
    if (index === -1) {
      throw new AssignmentApiError('과제를 찾을 수 없습니다.', 404, 'ASSIGNMENT_NOT_FOUND')
    }
    const current = assignments[index]
    if (current.status === 'CLOSED') {
      throw new AssignmentApiError('마감된 과제는 수정할 수 없습니다.', 409, 'ASSIGNMENT_ALREADY_CLOSED')
    }

    const nextStartDate = payload.startDate ?? current.startDate
    const nextDueDate = payload.dueDate ?? current.dueDate
    if (nextStartDate > nextDueDate) {
      throw new AssignmentApiError('시작일은 마감일보다 늦을 수 없습니다.', 400, 'INVALID_ASSIGNMENT')
    }

    // Rebuilt immutably rather than mutated in place: targetType/targetGroup/
    // targetStudentId form a discriminated union, so a partial in-place patch
    // could otherwise leave a stale field from the previous target variant.
    const target: AssignmentTarget =
      payload.targetType !== undefined
        ? payload.targetType === 'CLASS'
          ? { targetType: 'CLASS', targetGroup: payload.targetGroup }
          : { targetType: 'STUDENT', targetStudentId: payload.targetStudentId }
        : current.targetType === 'CLASS'
          ? { targetType: 'CLASS', targetGroup: current.targetGroup }
          : { targetType: 'STUDENT', targetStudentId: current.targetStudentId }

    const nextQuestions =
      payload.questionIds !== undefined
        ? toQuestionSummaries(payload.questionIds)
        : current.questions.map((question) => ({ ...question }))

    const updated: AssignmentDetail = {
      id: current.id,
      title: current.title,
      ...target,
      target: target.targetType === 'CLASS' ? target.targetGroup : `학생#${target.targetStudentId}`,
      startDate: nextStartDate,
      dueDate: nextDueDate,
      progress: current.progress,
      status: computeAssignmentStatus(nextStartDate, nextDueDate),
      questions: nextQuestions,
    }

    assignments[index] = updated
    return cloneAssignment(updated)
  }

  async function deleteAssignment(_accessToken: string, id: number): Promise<void> {
    const index = assignments.findIndex((candidate) => candidate.id === id)
    if (index === -1) {
      throw new AssignmentApiError('과제를 찾을 수 없습니다.', 404, 'ASSIGNMENT_NOT_FOUND')
    }
    assignments.splice(index, 1)
  }

  return { listAssignments, getAssignment, createAssignment, updateAssignment, deleteAssignment }
}
