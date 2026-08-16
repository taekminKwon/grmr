import { afterEach, describe, expect, it, vi } from 'vitest'
import { MyAssignmentApiError, myAssignmentApi } from './myAssignmentApi'

afterEach(() => {
  vi.unstubAllGlobals()
})

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

const ACCESS_TOKEN = 'access-token-abc'

describe('myAssignmentApi.listAssignments', () => {
  function listResponse(): Response {
    return jsonResponse(200, {
      content: [
        {
          id: 1,
          title: '현재완료 시제 연습',
          startDate: '2026-08-03',
          dueDate: '2026-08-20',
          status: '진행 중',
          submissionStatus: 'IN_PROGRESS',
          progress: 40,
        },
      ],
      page: 0,
      size: 20,
      totalElements: 1,
      totalPages: 1,
    })
  }

  it('GETs the same-origin assignments path with a Bearer authorization header', async () => {
    const fetchSpy = vi.fn().mockResolvedValue(listResponse())
    vi.stubGlobal('fetch', fetchSpy)

    await myAssignmentApi.listAssignments(ACCESS_TOKEN)

    expect(fetchSpy).toHaveBeenCalledTimes(1)
    const [url, init] = fetchSpy.mock.calls[0]
    expect(url).toBe('/api/me/assignments')
    expect(init.headers.Authorization).toBe('Bearer access-token-abc')
  })

  it('serializes page/size filters into the query string, preserving page 0', async () => {
    const fetchSpy = vi.fn().mockResolvedValue(listResponse())
    vi.stubGlobal('fetch', fetchSpy)

    await myAssignmentApi.listAssignments(ACCESS_TOKEN, { page: 0, size: 10 })

    const [url] = fetchSpy.mock.calls[0]
    expect(url).toBe('/api/me/assignments?page=0&size=10')
  })

  it('parses status from its Korean label into the canonical enum, passing submissionStatus through as-is', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(listResponse()))

    const result = await myAssignmentApi.listAssignments(ACCESS_TOKEN)

    expect(result.content[0]).toEqual({
      id: 1,
      title: '현재완료 시제 연습',
      startDate: '2026-08-03',
      dueDate: '2026-08-20',
      status: 'IN_PROGRESS',
      submissionStatus: 'IN_PROGRESS',
      progress: 40,
    })
  })

  it.each([
    [401, 'UNAUTHORIZED'],
    [403, 'FORBIDDEN'],
  ])('throws a MyAssignmentApiError with the backend code/message on %i', async (status, code) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(status, { code, message: `error ${status}` })))

    await expect(myAssignmentApi.listAssignments(ACCESS_TOKEN)).rejects.toMatchObject({
      message: `error ${status}`,
      code,
      status,
    })
    await expect(myAssignmentApi.listAssignments(ACCESS_TOKEN)).rejects.toBeInstanceOf(MyAssignmentApiError)
  })

  it('throws a MyAssignmentApiError when fetch itself rejects (network error)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))

    await expect(myAssignmentApi.listAssignments(ACCESS_TOKEN)).rejects.toBeInstanceOf(MyAssignmentApiError)
    await expect(myAssignmentApi.listAssignments(ACCESS_TOKEN)).rejects.toMatchObject({ status: 0 })
  })
})

describe('myAssignmentApi.getAssignmentQuestions', () => {
  function questionsResponse(): Response {
    return jsonResponse(200, {
      assignmentId: 1,
      submissionStatus: 'IN_PROGRESS',
      questions: [
        {
          id: 1024,
          order: 1,
          category: '현재완료',
          level: '보통',
          text: 'He has lived here _____ 2010.',
          choices: ['for', 'since', 'during', 'from'],
          myAnswer: 'since',
        },
        {
          id: 1023,
          order: 2,
          category: '현재완료',
          level: '보통',
          text: '...',
          choices: ['for', 'since', 'during', 'from'],
          myAnswer: null,
        },
      ],
    })
  }

  it('GETs the questions path for the given assignmentId with a Bearer header', async () => {
    const fetchSpy = vi.fn().mockResolvedValue(questionsResponse())
    vi.stubGlobal('fetch', fetchSpy)

    await myAssignmentApi.getAssignmentQuestions(ACCESS_TOKEN, 1)

    const [url, init] = fetchSpy.mock.calls[0]
    expect(url).toBe('/api/me/assignments/1/questions')
    expect(init.headers.Authorization).toBe('Bearer access-token-abc')
  })

  it('parses level from its Korean label, preserving myAnswer (including null) and never exposing answer/explanation/correct', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(questionsResponse()))

    const result = await myAssignmentApi.getAssignmentQuestions(ACCESS_TOKEN, 1)

    expect(result).toEqual({
      assignmentId: 1,
      submissionStatus: 'IN_PROGRESS',
      questions: [
        {
          id: 1024,
          order: 1,
          category: '현재완료',
          level: 'INTERMEDIATE',
          text: 'He has lived here _____ 2010.',
          choices: ['for', 'since', 'during', 'from'],
          myAnswer: 'since',
        },
        {
          id: 1023,
          order: 2,
          category: '현재완료',
          level: 'INTERMEDIATE',
          text: '...',
          choices: ['for', 'since', 'during', 'from'],
          myAnswer: null,
        },
      ],
    })
    for (const question of result.questions) {
      expect(question).not.toHaveProperty('answer')
      expect(question).not.toHaveProperty('explanation')
      expect(question).not.toHaveProperty('correct')
    }
  })

  it.each([[401, 'UNAUTHORIZED'], [403, 'FORBIDDEN'], [404, 'ASSIGNMENT_NOT_FOUND']])(
    'throws a MyAssignmentApiError with the backend code/message on %i',
    async (status, code) => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(status, { code, message: `error ${status}` })))

      await expect(myAssignmentApi.getAssignmentQuestions(ACCESS_TOKEN, 1)).rejects.toMatchObject({
        message: `error ${status}`,
        code,
        status,
      })
    },
  )

  it('throws a MyAssignmentApiError when fetch itself rejects (network error)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))

    await expect(myAssignmentApi.getAssignmentQuestions(ACCESS_TOKEN, 1)).rejects.toBeInstanceOf(MyAssignmentApiError)
  })
})

describe('myAssignmentApi.saveAnswer', () => {
  it('PUTs to the answers path for assignmentId/questionId with a JSON body, returning no correctness info', async () => {
    const fetchSpy = vi.fn().mockResolvedValue(
      jsonResponse(200, { questionId: 1024, answer: 'since', savedAt: '2026-08-15T10:00:00' }),
    )
    vi.stubGlobal('fetch', fetchSpy)

    const result = await myAssignmentApi.saveAnswer(ACCESS_TOKEN, 1, 1024, { answer: 'since' })

    const [url, init] = fetchSpy.mock.calls[0]
    expect(url).toBe('/api/me/assignments/1/answers/1024')
    expect(init.method).toBe('PUT')
    expect(init.headers.Authorization).toBe('Bearer access-token-abc')
    expect(init.headers['Content-Type']).toBe('application/json')
    expect(JSON.parse(init.body)).toEqual({ answer: 'since' })
    expect(result).toEqual({ questionId: 1024, answer: 'since', savedAt: '2026-08-15T10:00:00' })
    expect(result).not.toHaveProperty('correct')
    expect(result).not.toHaveProperty('correctAnswer')
  })

  it.each([
    [400, 'INVALID_REQUEST'],
    [401, 'UNAUTHORIZED'],
    [403, 'FORBIDDEN'],
    [404, 'ASSIGNMENT_NOT_FOUND'],
    [404, 'QUESTION_NOT_IN_ASSIGNMENT'],
    [409, 'ASSIGNMENT_CLOSED'],
    [409, 'ASSIGNMENT_ALREADY_SUBMITTED'],
  ])('throws a MyAssignmentApiError with the backend code/message on %i', async (status, code) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(status, { code, message: `error ${status}` })))

    await expect(myAssignmentApi.saveAnswer(ACCESS_TOKEN, 1, 1024, { answer: 'since' })).rejects.toMatchObject({
      message: `error ${status}`,
      code,
      status,
    })
  })

  it('throws a MyAssignmentApiError when fetch itself rejects (network error)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))

    await expect(myAssignmentApi.saveAnswer(ACCESS_TOKEN, 1, 1024, { answer: 'since' })).rejects.toBeInstanceOf(
      MyAssignmentApiError,
    )
  })
})

describe('myAssignmentApi.submitAssignment', () => {
  function resultResponse(): Response {
    return jsonResponse(200, {
      assignmentId: 1,
      submissionStatus: 'SUBMITTED',
      submittedAt: '2026-08-15T10:00:00',
      totalQuestions: 3,
      answeredQuestions: 2,
      correctCount: 1,
      score: 33,
      results: [
        { questionId: 1024, submittedAnswer: 'since', correct: true, correctAnswer: 'since', explanation: '...' },
        { questionId: 1023, submittedAnswer: 'for', correct: false, correctAnswer: 'since', explanation: '...' },
        { questionId: 1021, submittedAnswer: null, correct: false, correctAnswer: 'were', explanation: '...' },
      ],
    })
  }

  it('POSTs to the submit path for the given assignmentId with no body', async () => {
    const fetchSpy = vi.fn().mockResolvedValue(resultResponse())
    vi.stubGlobal('fetch', fetchSpy)

    await myAssignmentApi.submitAssignment(ACCESS_TOKEN, 1)

    const [url, init] = fetchSpy.mock.calls[0]
    expect(url).toBe('/api/me/assignments/1/submit')
    expect(init.method).toBe('POST')
    expect(init.headers.Authorization).toBe('Bearer access-token-abc')
    expect(init.body).toBeUndefined()
  })

  it('parses the grading result, including a null submittedAnswer for an unanswered question', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(resultResponse()))

    const result = await myAssignmentApi.submitAssignment(ACCESS_TOKEN, 1)

    expect(result.score).toBe(33)
    expect(result.answeredQuestions).toBe(2)
    expect(result.correctCount).toBe(1)
    expect(result.results[2]).toEqual({
      questionId: 1021,
      submittedAnswer: null,
      correct: false,
      correctAnswer: 'were',
      explanation: '...',
    })
  })

  it.each([
    [401, 'UNAUTHORIZED'],
    [403, 'FORBIDDEN'],
    [404, 'ASSIGNMENT_NOT_FOUND'],
    [409, 'ASSIGNMENT_CLOSED'],
    [409, 'ASSIGNMENT_ALREADY_SUBMITTED'],
  ])('throws a MyAssignmentApiError with the backend code/message on %i', async (status, code) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(status, { code, message: `error ${status}` })))

    await expect(myAssignmentApi.submitAssignment(ACCESS_TOKEN, 1)).rejects.toMatchObject({
      message: `error ${status}`,
      code,
      status,
    })
  })

  it('throws a MyAssignmentApiError when fetch itself rejects (network error)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))

    await expect(myAssignmentApi.submitAssignment(ACCESS_TOKEN, 1)).rejects.toBeInstanceOf(MyAssignmentApiError)
  })
})

describe('myAssignmentApi.getAssignmentResult', () => {
  function resultResponse(): Response {
    return jsonResponse(200, {
      assignmentId: 1,
      submissionStatus: 'SUBMITTED',
      submittedAt: '2026-08-15T10:00:00',
      totalQuestions: 3,
      answeredQuestions: 2,
      correctCount: 1,
      score: 33,
      results: [
        { questionId: 1024, submittedAnswer: 'since', correct: true, correctAnswer: 'since', explanation: '...' },
        { questionId: 1023, submittedAnswer: 'for', correct: false, correctAnswer: 'since', explanation: '...' },
        { questionId: 1021, submittedAnswer: null, correct: false, correctAnswer: 'were', explanation: '...' },
      ],
    })
  }

  it('GETs the result path for the given assignmentId with a Bearer header', async () => {
    const fetchSpy = vi.fn().mockResolvedValue(resultResponse())
    vi.stubGlobal('fetch', fetchSpy)

    await myAssignmentApi.getAssignmentResult(ACCESS_TOKEN, 1)

    const [url, init] = fetchSpy.mock.calls[0]
    expect(url).toBe('/api/me/assignments/1/result')
    expect(init.headers.Authorization).toBe('Bearer access-token-abc')
  })

  it('returns the same structure as submitAssignment', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(resultResponse()))

    const result = await myAssignmentApi.getAssignmentResult(ACCESS_TOKEN, 1)

    expect(result.submissionStatus).toBe('SUBMITTED')
    expect(result.results).toHaveLength(3)
  })

  it.each([
    [401, 'UNAUTHORIZED'],
    [403, 'FORBIDDEN'],
    [404, 'ASSIGNMENT_NOT_FOUND'],
    [409, 'ASSIGNMENT_NOT_SUBMITTED'],
  ])('throws a MyAssignmentApiError with the backend code/message on %i', async (status, code) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(status, { code, message: `error ${status}` })))

    await expect(myAssignmentApi.getAssignmentResult(ACCESS_TOKEN, 1)).rejects.toMatchObject({
      message: `error ${status}`,
      code,
      status,
    })
  })

  it('throws a MyAssignmentApiError when fetch itself rejects (network error)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))

    await expect(myAssignmentApi.getAssignmentResult(ACCESS_TOKEN, 1)).rejects.toBeInstanceOf(MyAssignmentApiError)
  })
})
