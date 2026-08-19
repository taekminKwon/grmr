import { afterEach, describe, expect, it, vi } from 'vitest'
import { StudentApiError, studentApi } from './studentApi'

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

const rawStudent = {
  id: 501,
  name: '김민수',
  studentGroup: '중1 A반',
  lastStudiedAt: '2026-08-01',
  totalQuestionCount: 128,
  accuracy: 74,
  pendingAssignmentCount: 1,
}

describe('studentApi.listStudents', () => {
  it('GETs the same-origin /api/students path with a Bearer authorization header', async () => {
    const fetchSpy = vi.fn().mockResolvedValue(
      jsonResponse(200, { content: [], page: 0, size: 20, totalElements: 0, totalPages: 0 }),
    )
    vi.stubGlobal('fetch', fetchSpy)

    await studentApi.listStudents(ACCESS_TOKEN)

    expect(fetchSpy).toHaveBeenCalledTimes(1)
    const [url, init] = fetchSpy.mock.calls[0]
    expect(url).toBe('/api/students')
    expect(init.headers.Authorization).toBe('Bearer access-token-abc')
  })

  it('serializes keyword/group/page/size filters into the query string', async () => {
    const fetchSpy = vi.fn().mockResolvedValue(
      jsonResponse(200, { content: [], page: 0, size: 20, totalElements: 0, totalPages: 0 }),
    )
    vi.stubGlobal('fetch', fetchSpy)

    await studentApi.listStudents(ACCESS_TOKEN, { keyword: '민수', group: '중1 A반', page: 0, size: 20 })

    const [url] = fetchSpy.mock.calls[0]
    const params = new URLSearchParams(url.split('?')[1])
    expect(params.get('keyword')).toBe('민수')
    expect(params.get('group')).toBe('중1 A반')
    expect(params.get('page')).toBe('0')
    expect(params.get('size')).toBe('20')
  })

  it('returns the page response with student fields passed through as-is', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        jsonResponse(200, { content: [rawStudent], page: 0, size: 20, totalElements: 1, totalPages: 1 }),
      ),
    )

    const result = await studentApi.listStudents(ACCESS_TOKEN)

    expect(result).toEqual({
      content: [rawStudent],
      page: 0,
      size: 20,
      totalElements: 1,
      totalPages: 1,
    })
  })

  it('passes through null studentGroup/lastStudiedAt and zero-valued counters unchanged', async () => {
    const neverStudied = {
      id: 502,
      name: '이지은',
      studentGroup: null,
      lastStudiedAt: null,
      totalQuestionCount: 0,
      accuracy: 0,
      pendingAssignmentCount: 0,
    }
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        jsonResponse(200, { content: [neverStudied], page: 0, size: 20, totalElements: 1, totalPages: 1 }),
      ),
    )

    const result = await studentApi.listStudents(ACCESS_TOKEN)

    expect(result.content[0]).toEqual(neverStudied)
  })

  it('throws a StudentApiError with the backend code/message on a non-2xx response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(jsonResponse(401, { code: 'TOKEN_EXPIRED', message: '세션이 만료되었습니다.' })),
    )

    await expect(studentApi.listStudents(ACCESS_TOKEN)).rejects.toMatchObject({
      message: '세션이 만료되었습니다.',
      code: 'TOKEN_EXPIRED',
      status: 401,
    })
    await expect(studentApi.listStudents(ACCESS_TOKEN)).rejects.toBeInstanceOf(StudentApiError)
  })

  it('throws a StudentApiError when fetch itself rejects (network error)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))

    await expect(studentApi.listStudents(ACCESS_TOKEN)).rejects.toBeInstanceOf(StudentApiError)
  })
})
