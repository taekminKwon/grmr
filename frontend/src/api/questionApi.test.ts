import { afterEach, describe, expect, it, vi } from 'vitest'
import { QuestionApiError, questionApi } from './questionApi'
import { PHASE_1_QUESTION_TYPES } from './questionTypes'

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

describe('questionApi.listQuestions', () => {
  it('GETs the same-origin /api/questions path with a Bearer authorization header', async () => {
    const fetchSpy = vi.fn().mockResolvedValue(
      jsonResponse(200, { content: [], page: 0, size: 20, totalElements: 0, totalPages: 0 }),
    )
    vi.stubGlobal('fetch', fetchSpy)

    await questionApi.listQuestions(ACCESS_TOKEN)

    expect(fetchSpy).toHaveBeenCalledTimes(1)
    const [url, init] = fetchSpy.mock.calls[0]
    expect(url).toBe('/api/questions')
    expect(init.headers.Authorization).toBe('Bearer access-token-abc')
  })

  it('serializes filters into the query string, translating enums to Korean labels', async () => {
    const fetchSpy = vi.fn().mockResolvedValue(
      jsonResponse(200, { content: [], page: 0, size: 20, totalElements: 0, totalPages: 0 }),
    )
    vi.stubGlobal('fetch', fetchSpy)

    await questionApi.listQuestions(ACCESS_TOKEN, { category: '현재완료', type: 'MULTIPLE_CHOICE', page: 0, size: 20 })

    const [url] = fetchSpy.mock.calls[0]
    expect(url).toBe(
      '/api/questions?category=%ED%98%84%EC%9E%AC%EC%99%84%EB%A3%8C&type=%EA%B0%9D%EA%B4%80%EC%8B%9D&page=0&size=20',
    )
  })

  it('parses the page response, converting Korean labels back into canonical enum keys', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        jsonResponse(200, {
          content: [
            {
              id: 1024,
              category: '현재완료',
              type: '객관식',
              level: '보통',
              status: '사용 중',
              text: 'He has lived here _____ 2010.',
            },
          ],
          page: 0,
          size: 20,
          totalElements: 1,
          totalPages: 1,
        }),
      ),
    )

    const result = await questionApi.listQuestions(ACCESS_TOKEN)

    expect(result).toEqual({
      content: [
        {
          id: 1024,
          category: '현재완료',
          type: 'MULTIPLE_CHOICE',
          level: 'INTERMEDIATE',
          status: 'ACTIVE',
          text: 'He has lived here _____ 2010.',
        },
      ],
      page: 0,
      size: 20,
      totalElements: 1,
      totalPages: 1,
    })
  })
})

describe('questionApi.getQuestion', () => {
  it('GETs /api/questions/{id} with the Bearer authorization header', async () => {
    const fetchSpy = vi.fn().mockResolvedValue(
      jsonResponse(200, {
        id: 1024,
        category: '현재완료',
        type: '객관식',
        level: '보통',
        status: '사용 중',
        text: 'He has lived here _____ 2010.',
        choices: ['for', 'since', 'during', 'from'],
        answer: 'since',
        explanation: '특정 시작 시점과 현재완료가 함께 쓰일 때 since를 사용합니다.',
        createdAt: '2026-07-20T10:15:00',
      }),
    )
    vi.stubGlobal('fetch', fetchSpy)

    const result = await questionApi.getQuestion(ACCESS_TOKEN, 1024)

    const [url, init] = fetchSpy.mock.calls[0]
    expect(url).toBe('/api/questions/1024')
    expect(init.headers.Authorization).toBe('Bearer access-token-abc')
    expect(result).toEqual({
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
    })
  })

  it('throws a QuestionApiError with the backend code/message on 404', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        jsonResponse(404, { code: 'QUESTION_NOT_FOUND', message: '문제를 찾을 수 없습니다.' }),
      ),
    )

    await expect(questionApi.getQuestion(ACCESS_TOKEN, 9999)).rejects.toMatchObject({
      message: '문제를 찾을 수 없습니다.',
      code: 'QUESTION_NOT_FOUND',
      status: 404,
    })
    await expect(questionApi.getQuestion(ACCESS_TOKEN, 9999)).rejects.toBeInstanceOf(QuestionApiError)
  })
})

describe('questionApi.createQuestion', () => {
  const request = {
    category: '현재완료',
    type: 'MULTIPLE_CHOICE' as const,
    level: 'INTERMEDIATE' as const,
    text: 'He has lived here _____ 2010.',
    choices: ['for', 'since', 'during', 'from'],
    answer: 'since',
    explanation: '특정 시작 시점과 현재완료가 함께 쓰일 때 since를 사용합니다.',
  }

  it('POSTs to /api/questions with the Bearer header and a Korean-label JSON body', async () => {
    const fetchSpy = vi.fn().mockResolvedValue(
      jsonResponse(201, {
        id: 1030,
        category: '현재완료',
        type: '객관식',
        level: '보통',
        status: '초안',
        text: 'He has lived here _____ 2010.',
        choices: ['for', 'since', 'during', 'from'],
        answer: 'since',
        explanation: '특정 시작 시점과 현재완료가 함께 쓰일 때 since를 사용합니다.',
        createdAt: '2026-08-07T09:00:00',
      }),
    )
    vi.stubGlobal('fetch', fetchSpy)

    const result = await questionApi.createQuestion(ACCESS_TOKEN, request)

    const [url, init] = fetchSpy.mock.calls[0]
    expect(url).toBe('/api/questions')
    expect(init.method).toBe('POST')
    expect(init.headers.Authorization).toBe('Bearer access-token-abc')
    expect(init.headers['Content-Type']).toBe('application/json')
    expect(JSON.parse(init.body)).toEqual({
      category: '현재완료',
      type: '객관식',
      level: '보통',
      text: 'He has lived here _____ 2010.',
      choices: ['for', 'since', 'during', 'from'],
      answer: 'since',
      explanation: '특정 시작 시점과 현재완료가 함께 쓰일 때 since를 사용합니다.',
    })
    expect(result.status).toBe('DRAFT')
  })

  it('throws a QuestionApiError with the backend code/message on a 400 validation error', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        jsonResponse(400, { code: 'INVALID_QUESTION', message: '정답은 보기 목록에 포함되어야 합니다.' }),
      ),
    )

    await expect(questionApi.createQuestion(ACCESS_TOKEN, request)).rejects.toMatchObject({
      message: '정답은 보기 목록에 포함되어야 합니다.',
      code: 'INVALID_QUESTION',
      status: 400,
    })
  })

  it('throws a QuestionApiError when fetch itself rejects (network error)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))

    await expect(questionApi.createQuestion(ACCESS_TOKEN, request)).rejects.toBeInstanceOf(QuestionApiError)
  })
})

describe('Phase 1 type exposure', () => {
  it('exposes only MULTIPLE_CHOICE for Phase 1 UI use, even though the client can parse future types', () => {
    expect(PHASE_1_QUESTION_TYPES).toEqual(['MULTIPLE_CHOICE'])
  })
})
