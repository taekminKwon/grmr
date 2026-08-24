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

describe('studentApi.getStudent', () => {
  it('GETs /api/students/{id} with a Bearer authorization header and returns the student as-is', async () => {
    const fetchSpy = vi.fn().mockResolvedValue(jsonResponse(200, rawStudent))
    vi.stubGlobal('fetch', fetchSpy)

    const result = await studentApi.getStudent(ACCESS_TOKEN, 501)

    expect(fetchSpy).toHaveBeenCalledTimes(1)
    const [url, init] = fetchSpy.mock.calls[0]
    expect(url).toBe('/api/students/501')
    expect(init.headers.Authorization).toBe('Bearer access-token-abc')
    expect(result).toEqual(rawStudent)
  })

  it('throws a StudentApiError with STUDENT_NOT_FOUND on a 404 response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(jsonResponse(404, { code: 'STUDENT_NOT_FOUND', message: '학생을 찾을 수 없습니다.' })),
    )

    await expect(studentApi.getStudent(ACCESS_TOKEN, 999)).rejects.toMatchObject({
      message: '학생을 찾을 수 없습니다.',
      code: 'STUDENT_NOT_FOUND',
      status: 404,
    })
  })
})

describe('studentApi.listStudyRecords', () => {
  const rawRollup = {
    studentId: 501,
    studentName: '김민수',
    date: '2026-08-01',
    type: 'ASSIGNMENT',
    questionCount: 20,
    correctCount: 16,
    accuracy: 80,
    durationMinutes: 0,
  }

  it('GETs the same-origin /api/study-records path with a Bearer authorization header', async () => {
    const fetchSpy = vi.fn().mockResolvedValue(
      jsonResponse(200, { content: [], page: 0, size: 20, totalElements: 0, totalPages: 0 }),
    )
    vi.stubGlobal('fetch', fetchSpy)

    await studentApi.listStudyRecords(ACCESS_TOKEN)

    expect(fetchSpy).toHaveBeenCalledTimes(1)
    const [url, init] = fetchSpy.mock.calls[0]
    expect(url).toBe('/api/study-records')
    expect(init.headers.Authorization).toBe('Bearer access-token-abc')
  })

  it('serializes studentId/period/type/page/size filters into the query string', async () => {
    const fetchSpy = vi.fn().mockResolvedValue(
      jsonResponse(200, { content: [], page: 0, size: 20, totalElements: 0, totalPages: 0 }),
    )
    vi.stubGlobal('fetch', fetchSpy)

    await studentApi.listStudyRecords(ACCESS_TOKEN, { studentId: 501, period: '7d', type: 'PRACTICE', page: 0, size: 20 })

    const [url] = fetchSpy.mock.calls[0]
    const params = new URLSearchParams(url.split('?')[1])
    expect(params.get('studentId')).toBe('501')
    expect(params.get('period')).toBe('7d')
    expect(params.get('type')).toBe('PRACTICE')
    expect(params.get('page')).toBe('0')
    expect(params.get('size')).toBe('20')
  })

  it('returns the page response with rollup fields passed through as-is', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        jsonResponse(200, { content: [rawRollup], page: 0, size: 20, totalElements: 1, totalPages: 1 }),
      ),
    )

    const result = await studentApi.listStudyRecords(ACCESS_TOKEN, { studentId: 501 })

    expect(result).toEqual({
      content: [rawRollup],
      page: 0,
      size: 20,
      totalElements: 1,
      totalPages: 1,
    })
  })

  it('throws a StudentApiError with STUDENT_NOT_FOUND on a 404 response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(jsonResponse(404, { code: 'STUDENT_NOT_FOUND', message: '학생을 찾을 수 없습니다.' })),
    )

    await expect(studentApi.listStudyRecords(ACCESS_TOKEN, { studentId: 999 })).rejects.toMatchObject({
      message: '학생을 찾을 수 없습니다.',
      code: 'STUDENT_NOT_FOUND',
      status: 404,
    })
  })

  it('throws a StudentApiError when fetch itself rejects (network error)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))

    await expect(studentApi.listStudyRecords(ACCESS_TOKEN)).rejects.toBeInstanceOf(StudentApiError)
  })
})
