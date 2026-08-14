import { afterEach, describe, expect, it, vi } from 'vitest'
import { StudyRecordApiError, historyApi } from './practiceHistoryApi'

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

function listResponse(): Response {
  return jsonResponse(200, {
    content: [
      { id: 501, questionId: 1021, type: 'PRACTICE', category: '가정법', level: '심화', correct: true, submittedAt: '2026-08-13T10:15:00' },
    ],
    page: 0,
    size: 20,
    totalElements: 1,
    totalPages: 1,
  })
}

function detailResponse(): Response {
  return jsonResponse(200, {
    id: 501,
    questionId: 1021,
    type: 'PRACTICE',
    question: {
      category: '가정법',
      level: '심화',
      text: 'If I _____ you, I would study harder.',
      choices: ['am', 'was', 'were', 'be'],
      correctAnswer: 'were',
      explanation: '가정법 과거에서는 주어의 인칭에 관계없이 be동사로 were를 씁니다.',
    },
    submittedAnswer: 'were',
    correct: true,
    submittedAt: '2026-08-13T10:15:00',
  })
}

describe('historyApi.listRecords', () => {
  it('GETs the same-origin records path with a Bearer authorization header', async () => {
    const fetchSpy = vi.fn().mockResolvedValue(listResponse())
    vi.stubGlobal('fetch', fetchSpy)

    await historyApi.listRecords(ACCESS_TOKEN)

    expect(fetchSpy).toHaveBeenCalledTimes(1)
    const [url, init] = fetchSpy.mock.calls[0]
    expect(url).toBe('/api/me/practice/records')
    expect(init.headers.Authorization).toBe('Bearer access-token-abc')
  })

  it('serializes category/page/size into the query string, passing category through untranslated', async () => {
    const fetchSpy = vi.fn().mockResolvedValue(listResponse())
    vi.stubGlobal('fetch', fetchSpy)

    await historyApi.listRecords(ACCESS_TOKEN, { category: '가정법', page: 2, size: 10 })

    const [url] = fetchSpy.mock.calls[0]
    expect(url).toBe(`/api/me/practice/records?category=${encodeURIComponent('가정법')}&page=2&size=10`)
  })

  it('preserves page 0 in the query string instead of omitting it', async () => {
    const fetchSpy = vi.fn().mockResolvedValue(listResponse())
    vi.stubGlobal('fetch', fetchSpy)

    await historyApi.listRecords(ACCESS_TOKEN, { page: 0 })

    const [url] = fetchSpy.mock.calls[0]
    expect(url).toBe('/api/me/practice/records?page=0')
  })

  it('omits absent optional params, requesting the bare path', async () => {
    const fetchSpy = vi.fn().mockResolvedValue(listResponse())
    vi.stubGlobal('fetch', fetchSpy)

    await historyApi.listRecords(ACCESS_TOKEN, {})

    const [url] = fetchSpy.mock.calls[0]
    expect(url).toBe('/api/me/practice/records')
  })

  it('parses the page response, converting the level label back into a canonical enum key', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(listResponse()))

    const result = await historyApi.listRecords(ACCESS_TOKEN)

    expect(result).toEqual({
      content: [
        {
          id: 501,
          questionId: 1021,
          type: 'PRACTICE',
          category: '가정법',
          level: 'ADVANCED',
          correct: true,
          submittedAt: '2026-08-13T10:15:00',
        },
      ],
      page: 0,
      size: 20,
      totalElements: 1,
      totalPages: 1,
    })
  })

  it.each([
    [401, 'UNAUTHORIZED'],
    [403, 'FORBIDDEN'],
  ])('throws a StudyRecordApiError with the backend code/message on %i', async (status, code) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(status, { code, message: `error ${status}` })))

    await expect(historyApi.listRecords(ACCESS_TOKEN)).rejects.toMatchObject({ message: `error ${status}`, code, status })
    await expect(historyApi.listRecords(ACCESS_TOKEN)).rejects.toBeInstanceOf(StudyRecordApiError)
  })

  it('throws a StudyRecordApiError when fetch itself rejects (network error)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))

    await expect(historyApi.listRecords(ACCESS_TOKEN)).rejects.toBeInstanceOf(StudyRecordApiError)
    await expect(historyApi.listRecords(ACCESS_TOKEN)).rejects.toMatchObject({ status: 0 })
  })
})

describe('historyApi.getRecord', () => {
  it('GETs /api/me/practice/records/{id} with the Bearer authorization header', async () => {
    const fetchSpy = vi.fn().mockResolvedValue(detailResponse())
    vi.stubGlobal('fetch', fetchSpy)

    await historyApi.getRecord(ACCESS_TOKEN, 501)

    const [url, init] = fetchSpy.mock.calls[0]
    expect(url).toBe('/api/me/practice/records/501')
    expect(init.headers.Authorization).toBe('Bearer access-token-abc')
  })

  it('parses the full snapshot, converting the level label back into a canonical enum key', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(detailResponse()))

    const result = await historyApi.getRecord(ACCESS_TOKEN, 501)

    expect(result).toEqual({
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
    })
  })

  it('throws a StudyRecordApiError with STUDY_RECORD_NOT_FOUND on 404 (missing id or another student\'s record)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(jsonResponse(404, { code: 'STUDY_RECORD_NOT_FOUND', message: '학습 기록을 찾을 수 없습니다.' })),
    )

    await expect(historyApi.getRecord(ACCESS_TOKEN, 9999)).rejects.toMatchObject({
      message: '학습 기록을 찾을 수 없습니다.',
      code: 'STUDY_RECORD_NOT_FOUND',
      status: 404,
    })
    await expect(historyApi.getRecord(ACCESS_TOKEN, 9999)).rejects.toBeInstanceOf(StudyRecordApiError)
  })

  it('throws a StudyRecordApiError when fetch itself rejects (network error)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))

    await expect(historyApi.getRecord(ACCESS_TOKEN, 501)).rejects.toBeInstanceOf(StudyRecordApiError)
  })
})
