import { afterEach, describe, expect, it, vi } from 'vitest'
import { PracticeApiError, practiceApi } from './practiceApi'

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

function deliveredQuestionResponse(): Response {
  return jsonResponse(200, {
    id: 2001,
    category: '현재완료',
    type: '객관식',
    level: '보통',
    text: 'He has lived here _____ 2010.',
    choices: ['for', 'since', 'during', 'from'],
  })
}

describe('practiceApi.getNextQuestion', () => {
  it('GETs the same-origin next-question path with a Bearer authorization header', async () => {
    const fetchSpy = vi.fn().mockResolvedValue(deliveredQuestionResponse())
    vi.stubGlobal('fetch', fetchSpy)

    await practiceApi.getNextQuestion(ACCESS_TOKEN)

    expect(fetchSpy).toHaveBeenCalledTimes(1)
    const [url, init] = fetchSpy.mock.calls[0]
    expect(url).toBe('/api/me/practice/questions/next')
    expect(init.headers.Authorization).toBe('Bearer access-token-abc')
  })

  it('serializes category/level filters into the query string, translating level to its Korean label', async () => {
    const fetchSpy = vi.fn().mockResolvedValue(deliveredQuestionResponse())
    vi.stubGlobal('fetch', fetchSpy)

    await practiceApi.getNextQuestion(ACCESS_TOKEN, { category: '현재완료', level: 'BASIC' })

    const [url] = fetchSpy.mock.calls[0]
    expect(url).toBe('/api/me/practice/questions/next?category=%ED%98%84%EC%9E%AC%EC%99%84%EB%A3%8C&level=%EA%B8%B0%EC%B4%88')
  })

  it('parses a delivered question, converting Korean labels back into canonical enum keys, without answer/explanation', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(deliveredQuestionResponse()))

    const result = await practiceApi.getNextQuestion(ACCESS_TOKEN)

    expect(result).toEqual({
      id: 2001,
      category: '현재완료',
      type: 'MULTIPLE_CHOICE',
      level: 'INTERMEDIATE',
      text: 'He has lived here _____ 2010.',
      choices: ['for', 'since', 'during', 'from'],
    })
    expect(result).not.toHaveProperty('answer')
    expect(result).not.toHaveProperty('explanation')
  })

  it.each([
    [400, 'INVALID_QUESTION'],
    [401, 'UNAUTHORIZED'],
    [403, 'FORBIDDEN'],
    [404, 'NO_QUESTION_AVAILABLE'],
  ])('throws a PracticeApiError with the backend code/message on %i', async (status, code) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(status, { code, message: `error ${status}` })))

    await expect(practiceApi.getNextQuestion(ACCESS_TOKEN)).rejects.toMatchObject({ message: `error ${status}`, code, status })
    await expect(practiceApi.getNextQuestion(ACCESS_TOKEN)).rejects.toBeInstanceOf(PracticeApiError)
  })

  it('throws a PracticeApiError when fetch itself rejects (network error)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))

    await expect(practiceApi.getNextQuestion(ACCESS_TOKEN)).rejects.toBeInstanceOf(PracticeApiError)
    await expect(practiceApi.getNextQuestion(ACCESS_TOKEN)).rejects.toMatchObject({ status: 0 })
  })
})

describe('practiceApi.submitAnswer', () => {
  const payload = { questionId: 2001, answer: 'since' }

  it('POSTs to the answers path with the Bearer header and a JSON body', async () => {
    const fetchSpy = vi.fn().mockResolvedValue(
      jsonResponse(201, {
        id: 501,
        questionId: 2001,
        correct: true,
        submittedAnswer: 'since',
        correctAnswer: 'since',
        explanation: '특정 시작 시점과 현재완료가 함께 쓰일 때 since를 사용합니다.',
        submittedAt: '2026-08-13T10:15:00',
      }),
    )
    vi.stubGlobal('fetch', fetchSpy)

    const result = await practiceApi.submitAnswer(ACCESS_TOKEN, payload)

    const [url, init] = fetchSpy.mock.calls[0]
    expect(url).toBe('/api/me/practice/answers')
    expect(init.method).toBe('POST')
    expect(init.headers.Authorization).toBe('Bearer access-token-abc')
    expect(init.headers['Content-Type']).toBe('application/json')
    expect(JSON.parse(init.body)).toEqual(payload)
    expect(result).toEqual({
      id: 501,
      questionId: 2001,
      correct: true,
      submittedAnswer: 'since',
      correctAnswer: 'since',
      explanation: '특정 시작 시점과 현재완료가 함께 쓰일 때 since를 사용합니다.',
      submittedAt: '2026-08-13T10:15:00',
    })
  })

  it('surfaces an incorrect submission as correct: false, still including the correct answer', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        jsonResponse(201, {
          id: 502,
          questionId: 2001,
          correct: false,
          submittedAnswer: 'for',
          correctAnswer: 'since',
          explanation: '특정 시작 시점과 현재완료가 함께 쓰일 때 since를 사용합니다.',
          submittedAt: '2026-08-13T10:16:00',
        }),
      ),
    )

    const result = await practiceApi.submitAnswer(ACCESS_TOKEN, { questionId: 2001, answer: 'for' })

    expect(result.correct).toBe(false)
    expect(result.correctAnswer).toBe('since')
  })

  it.each([
    [400, 'INVALID_REQUEST'],
    [401, 'UNAUTHORIZED'],
    [403, 'FORBIDDEN'],
    [404, 'QUESTION_NOT_FOUND'],
    [409, 'QUESTION_NOT_IN_USE'],
    [409, 'QUESTION_TYPE_NOT_SUPPORTED'],
  ])('throws a PracticeApiError with the backend code/message on %i', async (status, code) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(status, { code, message: `error ${status}` })))

    await expect(practiceApi.submitAnswer(ACCESS_TOKEN, payload)).rejects.toMatchObject({
      message: `error ${status}`,
      code,
      status,
    })
    await expect(practiceApi.submitAnswer(ACCESS_TOKEN, payload)).rejects.toBeInstanceOf(PracticeApiError)
  })

  it('throws a PracticeApiError when fetch itself rejects (network error)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))

    await expect(practiceApi.submitAnswer(ACCESS_TOKEN, payload)).rejects.toBeInstanceOf(PracticeApiError)
  })
})
