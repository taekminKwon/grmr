import { describe, expect, it } from 'vitest'
import { MyAssignmentApiError } from './myAssignmentApi'
import { ASSIGNMENT_FIXTURES, createFakeMyAssignmentApi } from './myAssignmentApi.fake'

const TOKEN = 'any-token'

describe('createFakeMyAssignmentApi.listAssignments', () => {
  it('hides scheduled (UPCOMING) assignments from the list', async () => {
    const api = createFakeMyAssignmentApi()

    const { content } = await api.listAssignments(TOKEN)

    expect(content.map((item) => item.id)).not.toContain(2)
    expect(content.every((item) => item.status !== 'UPCOMING')).toBe(true)
  })

  it('reports NOT_STARTED submissionStatus and 0 progress before any interaction', async () => {
    const api = createFakeMyAssignmentApi()

    const { content } = await api.listAssignments(TOKEN)
    const item = content.find((candidate) => candidate.id === 1)

    expect(item).toMatchObject({ submissionStatus: 'NOT_STARTED', progress: 0 })
  })

  it('sorts by dueDate ascending', async () => {
    const api = createFakeMyAssignmentApi()

    const { content } = await api.listAssignments(TOKEN)

    const dueDates = content.map((item) => item.dueDate)
    expect(dueDates).toEqual([...dueDates].sort())
  })
})

describe('createFakeMyAssignmentApi scheduled-assignment hiding', () => {
  it('returns 404 ASSIGNMENT_NOT_FOUND from every endpoint for a scheduled assignment', async () => {
    const api = createFakeMyAssignmentApi()

    await expect(api.getAssignmentQuestions(TOKEN, 2)).rejects.toMatchObject({
      code: 'ASSIGNMENT_NOT_FOUND',
      status: 404,
    })
    await expect(api.saveAnswer(TOKEN, 2, 1024, { answer: 'since' })).rejects.toMatchObject({
      code: 'ASSIGNMENT_NOT_FOUND',
      status: 404,
    })
    await expect(api.submitAssignment(TOKEN, 2)).rejects.toMatchObject({ code: 'ASSIGNMENT_NOT_FOUND', status: 404 })
    await expect(api.getAssignmentResult(TOKEN, 2)).rejects.toMatchObject({
      code: 'ASSIGNMENT_NOT_FOUND',
      status: 404,
    })
  })

  it('returns 404 ASSIGNMENT_NOT_FOUND for an assignment id that does not exist (not-a-target)', async () => {
    const api = createFakeMyAssignmentApi()

    await expect(api.getAssignmentQuestions(TOKEN, 999999)).rejects.toBeInstanceOf(MyAssignmentApiError)
    await expect(api.getAssignmentQuestions(TOKEN, 999999)).rejects.toMatchObject({ code: 'ASSIGNMENT_NOT_FOUND' })
  })
})

describe('createFakeMyAssignmentApi.getAssignmentQuestions (start/resume)', () => {
  it('creates submissionStatus IN_PROGRESS on first call, with every myAnswer null', async () => {
    const api = createFakeMyAssignmentApi()

    const response = await api.getAssignmentQuestions(TOKEN, 1)

    expect(response.submissionStatus).toBe('IN_PROGRESS')
    expect(response.questions.every((question) => question.myAnswer === null)).toBe(true)
    expect(response.questions.map((question) => question.order)).toEqual([1, 2, 3])
  })

  it('never exposes answer/explanation/correct even after resuming', async () => {
    const api = createFakeMyAssignmentApi()
    await api.getAssignmentQuestions(TOKEN, 1)

    const response = await api.getAssignmentQuestions(TOKEN, 1)

    for (const question of response.questions) {
      expect(question).not.toHaveProperty('answer')
      expect(question).not.toHaveProperty('explanation')
      expect(question).not.toHaveProperty('correct')
    }
  })

  it('resuming returns the same IN_PROGRESS state with saved drafts, not a fresh start', async () => {
    const api = createFakeMyAssignmentApi()
    await api.getAssignmentQuestions(TOKEN, 1)
    await api.saveAnswer(TOKEN, 1, 1024, { answer: 'since' })

    const response = await api.getAssignmentQuestions(TOKEN, 1)

    expect(response.submissionStatus).toBe('IN_PROGRESS')
    expect(response.questions.find((question) => question.id === 1024)?.myAnswer).toBe('since')
  })
})

describe('createFakeMyAssignmentApi.saveAnswer (draft, overwrite, progress)', () => {
  it('saves a draft without exposing correctness', async () => {
    const api = createFakeMyAssignmentApi()
    await api.getAssignmentQuestions(TOKEN, 1)

    const result = await api.saveAnswer(TOKEN, 1, 1024, { answer: 'since' })

    expect(result).toMatchObject({ questionId: 1024, answer: 'since' })
    expect(result).not.toHaveProperty('correct')
  })

  it('overwrites the previous draft for the same question rather than accumulating', async () => {
    const api = createFakeMyAssignmentApi()
    await api.getAssignmentQuestions(TOKEN, 1)
    await api.saveAnswer(TOKEN, 1, 1024, { answer: 'since' })
    await api.saveAnswer(TOKEN, 1, 1024, { answer: 'for' })

    const response = await api.getAssignmentQuestions(TOKEN, 1)

    expect(response.questions.find((question) => question.id === 1024)?.myAnswer).toBe('for')
  })

  it('increases the list progress as distinct questions get draft-saved', async () => {
    const api = createFakeMyAssignmentApi()
    await api.getAssignmentQuestions(TOKEN, 1)
    await api.saveAnswer(TOKEN, 1, 1024, { answer: 'since' })

    const { content } = await api.listAssignments(TOKEN)
    const item = content.find((candidate) => candidate.id === 1)

    // 1 of 3 questions answered.
    expect(item?.progress).toBe(33)
  })

  it('implicitly starts (creates IN_PROGRESS) if called before GET .../questions', async () => {
    const api = createFakeMyAssignmentApi()

    await api.saveAnswer(TOKEN, 1, 1024, { answer: 'since' })
    const { content } = await api.listAssignments(TOKEN)

    expect(content.find((item) => item.id === 1)?.submissionStatus).toBe('IN_PROGRESS')
  })

  it('throws 404 QUESTION_NOT_IN_ASSIGNMENT for a question outside the assignment', async () => {
    const api = createFakeMyAssignmentApi()
    await api.getAssignmentQuestions(TOKEN, 1)

    await expect(api.saveAnswer(TOKEN, 1, 999999, { answer: 'x' })).rejects.toMatchObject({
      code: 'QUESTION_NOT_IN_ASSIGNMENT',
      status: 404,
    })
  })
})

describe('createFakeMyAssignmentApi result-before-submit guard', () => {
  it('throws 409 ASSIGNMENT_NOT_SUBMITTED with no grading fields before final submit', async () => {
    const api = createFakeMyAssignmentApi()
    await api.getAssignmentQuestions(TOKEN, 1)

    await expect(api.getAssignmentResult(TOKEN, 1)).rejects.toMatchObject({
      code: 'ASSIGNMENT_NOT_SUBMITTED',
      status: 409,
    })
  })
})

describe('createFakeMyAssignmentApi.submitAssignment (grading, replicating docs/api-spec-detail.md scenario 11)', () => {
  async function submitDocScenario() {
    const api = createFakeMyAssignmentApi()
    await api.getAssignmentQuestions(TOKEN, 1)
    await api.saveAnswer(TOKEN, 1, 1024, { answer: 'since' }) // correct
    await api.saveAnswer(TOKEN, 1, 1023, { answer: 'for' }) // incorrect
    // 1021 left unanswered
    const result = await api.submitAssignment(TOKEN, 1)
    return { api, result }
  }

  it('grades exactly like the spec example: score 33, 2 answered, 1 correct, unanswered question null/false', async () => {
    const { result } = await submitDocScenario()

    expect(result).toMatchObject({
      assignmentId: 1,
      submissionStatus: 'SUBMITTED',
      totalQuestions: 3,
      answeredQuestions: 2,
      correctCount: 1,
      score: 33,
    })
    expect(result.results).toEqual(
      expect.arrayContaining([
        { questionId: 1024, submittedAnswer: 'since', correct: true, correctAnswer: 'since', explanation: expect.any(String) },
        { questionId: 1023, submittedAnswer: 'for', correct: false, correctAnswer: 'since', explanation: expect.any(String) },
        { questionId: 1021, submittedAnswer: null, correct: false, correctAnswer: 'were', explanation: expect.any(String) },
      ]),
    )
  })

  it('locks submissionStatus to SUBMITTED and blocks further draft saves (409 ASSIGNMENT_ALREADY_SUBMITTED)', async () => {
    const { api } = await submitDocScenario()

    await expect(api.saveAnswer(TOKEN, 1, 1024, { answer: 'for' })).rejects.toMatchObject({
      code: 'ASSIGNMENT_ALREADY_SUBMITTED',
      status: 409,
    })
  })

  it('rejects a second submit without regrading (409 ASSIGNMENT_ALREADY_SUBMITTED)', async () => {
    const { api } = await submitDocScenario()

    await expect(api.submitAssignment(TOKEN, 1)).rejects.toMatchObject({
      code: 'ASSIGNMENT_ALREADY_SUBMITTED',
      status: 409,
    })
  })

  it('keeps myAnswer values from submit time visible in the questions view, still without grading fields', async () => {
    const { api } = await submitDocScenario()

    const response = await api.getAssignmentQuestions(TOKEN, 1)

    expect(response.submissionStatus).toBe('SUBMITTED')
    expect(response.questions.find((q) => q.id === 1024)?.myAnswer).toBe('since')
    expect(response.questions.find((q) => q.id === 1021)?.myAnswer).toBeNull()
    for (const question of response.questions) {
      expect(question).not.toHaveProperty('correct')
    }
  })

  it('produces a result snapshot that is stable across repeated reads (same submittedAt and values)', async () => {
    const { api, result: submitResult } = await submitDocScenario()

    const first = await api.getAssignmentResult(TOKEN, 1)
    const second = await api.getAssignmentResult(TOKEN, 1)

    expect(first).toEqual(submitResult)
    expect(second).toEqual(submitResult)
    expect(first.submittedAt).toBe(second.submittedAt)
  })
})

describe('createFakeMyAssignmentApi closed-assignment conflicts', () => {
  it('blocks draft save and submit with 409 ASSIGNMENT_CLOSED on a never-started closed assignment', async () => {
    const api = createFakeMyAssignmentApi()

    await expect(api.saveAnswer(TOKEN, 4, 1024, { answer: 'since' })).rejects.toMatchObject({
      code: 'ASSIGNMENT_CLOSED',
      status: 409,
    })
    await expect(api.submitAssignment(TOKEN, 4)).rejects.toMatchObject({ code: 'ASSIGNMENT_CLOSED', status: 409 })
  })

  it('still allows viewing questions of a closed assignment', async () => {
    const api = createFakeMyAssignmentApi()

    const response = await api.getAssignmentQuestions(TOKEN, 4)

    expect(response.assignmentId).toBe(4)
  })

  it('reports 409 ASSIGNMENT_NOT_SUBMITTED for result on a closed-but-never-submitted assignment', async () => {
    const api = createFakeMyAssignmentApi()

    await expect(api.getAssignmentResult(TOKEN, 4)).rejects.toMatchObject({
      code: 'ASSIGNMENT_NOT_SUBMITTED',
      status: 409,
    })
  })

  it('prioritizes ASSIGNMENT_CLOSED over ASSIGNMENT_ALREADY_SUBMITTED when a closed assignment was already submitted', async () => {
    const api = createFakeMyAssignmentApi()

    await expect(api.saveAnswer(TOKEN, 3, 1021, { answer: 'were' })).rejects.toMatchObject({
      code: 'ASSIGNMENT_CLOSED',
      status: 409,
    })
    await expect(api.submitAssignment(TOKEN, 3)).rejects.toMatchObject({ code: 'ASSIGNMENT_CLOSED', status: 409 })
  })

  it('still serves the stable pre-existing result for a closed-and-submitted assignment', async () => {
    const api = createFakeMyAssignmentApi()

    const first = await api.getAssignmentResult(TOKEN, 3)
    const second = await api.getAssignmentResult(TOKEN, 3)

    expect(first).toEqual(second)
    expect(first).toMatchObject({ assignmentId: 3, submissionStatus: 'SUBMITTED', correctCount: 1, score: 100 })
  })
})

describe('createFakeMyAssignmentApi isolation', () => {
  it('gives each instance independent submission state', async () => {
    const apiA = createFakeMyAssignmentApi()
    const apiB = createFakeMyAssignmentApi()

    await apiA.getAssignmentQuestions(TOKEN, 1)
    await apiA.saveAnswer(TOKEN, 1, 1024, { answer: 'since' })

    const { content } = await apiB.listAssignments(TOKEN)
    const item = content.find((candidate) => candidate.id === 1)

    expect(item?.submissionStatus).toBe('NOT_STARTED')
    expect(item?.progress).toBe(0)
  })

  it('does not mutate the shared fixture list across instances', async () => {
    const api = createFakeMyAssignmentApi()
    await api.getAssignmentQuestions(TOKEN, 1)
    await api.saveAnswer(TOKEN, 1, 1024, { answer: 'since' })
    await api.submitAssignment(TOKEN, 1)

    expect(ASSIGNMENT_FIXTURES.find((assignment) => assignment.id === 1)?.status).toBe('IN_PROGRESS')
  })
})
