import { afterEach, describe, expect, it, vi } from 'vitest'
import { AssignmentApiError, assignmentApi } from './assignmentApi'

afterEach(() => {
  vi.unstubAllGlobals()
})

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function emptyResponse(status: number): Response {
  return new Response(null, { status })
}

const ACCESS_TOKEN = 'access-token-abc'

describe('assignmentApi.listAssignments', () => {
  it('GETs the same-origin /api/assignments path with a Bearer authorization header', async () => {
    const fetchSpy = vi.fn().mockResolvedValue(
      jsonResponse(200, { content: [], page: 0, size: 20, totalElements: 0, totalPages: 0 }),
    )
    vi.stubGlobal('fetch', fetchSpy)

    await assignmentApi.listAssignments(ACCESS_TOKEN)

    expect(fetchSpy).toHaveBeenCalledTimes(1)
    const [url, init] = fetchSpy.mock.calls[0]
    expect(url).toBe('/api/assignments')
    expect(init.headers.Authorization).toBe('Bearer access-token-abc')
  })

  it('serializes filters into the query string, translating status to its Korean label', async () => {
    const fetchSpy = vi.fn().mockResolvedValue(
      jsonResponse(200, { content: [], page: 0, size: 20, totalElements: 0, totalPages: 0 }),
    )
    vi.stubGlobal('fetch', fetchSpy)

    await assignmentApi.listAssignments(ACCESS_TOKEN, { status: 'IN_PROGRESS', keyword: '연습', page: 0, size: 20 })

    const [url] = fetchSpy.mock.calls[0]
    expect(url).toBe(
      '/api/assignments?status=%EC%A7%84%ED%96%89+%EC%A4%91&keyword=%EC%97%B0%EC%8A%B5&page=0&size=20',
    )
  })

  it('parses each page item, including CLASS and STUDENT target variants and the Korean status label', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        jsonResponse(200, {
          content: [
            {
              id: 1,
              title: '현재완료 시제 연습',
              targetType: 'CLASS',
              targetGroup: '중1 A반',
              target: '중1 A반',
              startDate: '2026-08-03',
              dueDate: '2026-08-05',
              progress: 84,
              status: '진행 중',
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
              status: '예정',
            },
          ],
          page: 0,
          size: 20,
          totalElements: 2,
          totalPages: 1,
        }),
      ),
    )

    const result = await assignmentApi.listAssignments(ACCESS_TOKEN)

    expect(result).toEqual({
      content: [
        {
          id: 1,
          title: '현재완료 시제 연습',
          targetType: 'CLASS',
          targetGroup: '중1 A반',
          target: '중1 A반',
          startDate: '2026-08-03',
          dueDate: '2026-08-05',
          progress: 84,
          status: 'IN_PROGRESS',
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
          status: 'UPCOMING',
        },
      ],
      page: 0,
      size: 20,
      totalElements: 2,
      totalPages: 1,
    })
    // CLASS items must never carry a stray targetStudentId, and vice versa.
    expect(result.content[0]).not.toHaveProperty('targetStudentId')
    expect(result.content[1]).not.toHaveProperty('targetGroup')
  })
})

describe('assignmentApi.getAssignment', () => {
  it('GETs /api/assignments/{id} and maps ordered question summaries', async () => {
    const fetchSpy = vi.fn().mockResolvedValue(
      jsonResponse(200, {
        id: 1,
        title: '현재완료 시제 연습',
        targetType: 'CLASS',
        targetGroup: '중1 A반',
        target: '중1 A반',
        startDate: '2026-08-03',
        dueDate: '2026-08-05',
        status: '진행 중',
        progress: 84,
        questions: [
          { id: 1024, order: 1, text: 'He has lived here _____ 2010.', category: '현재완료' },
          { id: 1023, order: 2, text: 'She _____ here since last year.', category: '현재완료' },
        ],
      }),
    )
    vi.stubGlobal('fetch', fetchSpy)

    const result = await assignmentApi.getAssignment(ACCESS_TOKEN, 1)

    const [url, init] = fetchSpy.mock.calls[0]
    expect(url).toBe('/api/assignments/1')
    expect(init.headers.Authorization).toBe('Bearer access-token-abc')
    expect(result.status).toBe('IN_PROGRESS')
    expect(result.questions).toEqual([
      { id: 1024, order: 1, text: 'He has lived here _____ 2010.', category: '현재완료' },
      { id: 1023, order: 2, text: 'She _____ here since last year.', category: '현재완료' },
    ])
  })

  it('parses a STUDENT-targeted assignment with targetStudentId instead of targetGroup', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        jsonResponse(200, {
          id: 2,
          title: '가정법 복습',
          targetType: 'STUDENT',
          targetStudentId: 7,
          target: '김민수',
          startDate: '2026-08-14',
          dueDate: '2026-08-20',
          status: '예정',
          progress: 0,
          questions: [],
        }),
      ),
    )

    const result = await assignmentApi.getAssignment(ACCESS_TOKEN, 2)

    expect(result.targetType).toBe('STUDENT')
    expect(result).toMatchObject({ targetStudentId: 7, target: '김민수' })
    expect(result).not.toHaveProperty('targetGroup')
  })

  it('throws an AssignmentApiError with the backend code/message on 404', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(jsonResponse(404, { code: 'ASSIGNMENT_NOT_FOUND', message: '과제를 찾을 수 없습니다.' })),
    )

    await expect(assignmentApi.getAssignment(ACCESS_TOKEN, 999)).rejects.toMatchObject({
      message: '과제를 찾을 수 없습니다.',
      code: 'ASSIGNMENT_NOT_FOUND',
      status: 404,
    })
    await expect(assignmentApi.getAssignment(ACCESS_TOKEN, 999)).rejects.toBeInstanceOf(AssignmentApiError)
  })
})

describe('assignmentApi.createAssignment', () => {
  const classRequest = {
    title: '현재완료 시제 연습',
    targetType: 'CLASS' as const,
    targetGroup: '중1 A반',
    startDate: '2026-08-08',
    dueDate: '2026-08-10',
    questionIds: [1024, 1023, 1021],
  }

  it('POSTs to /api/assignments with a CLASS target body and no targetStudentId field', async () => {
    const fetchSpy = vi.fn().mockResolvedValue(
      jsonResponse(201, {
        id: 4,
        title: '현재완료 시제 연습',
        targetType: 'CLASS',
        targetGroup: '중1 A반',
        target: '중1 A반',
        startDate: '2026-08-08',
        dueDate: '2026-08-10',
        status: '예정',
        progress: 0,
      }),
    )
    vi.stubGlobal('fetch', fetchSpy)

    const result = await assignmentApi.createAssignment(ACCESS_TOKEN, classRequest)

    const [url, init] = fetchSpy.mock.calls[0]
    expect(url).toBe('/api/assignments')
    expect(init.method).toBe('POST')
    expect(init.headers.Authorization).toBe('Bearer access-token-abc')
    expect(init.headers['Content-Type']).toBe('application/json')
    const body = JSON.parse(init.body)
    expect(body).toEqual({
      title: '현재완료 시제 연습',
      targetType: 'CLASS',
      targetGroup: '중1 A반',
      startDate: '2026-08-08',
      dueDate: '2026-08-10',
      questionIds: [1024, 1023, 1021],
    })
    expect(body).not.toHaveProperty('targetStudentId')
    // 201 response has no `questions` field; result must not invent one.
    expect(result).not.toHaveProperty('questions')
    expect(result.status).toBe('UPCOMING')
  })

  it('POSTs a STUDENT target body with targetStudentId and no targetGroup field', async () => {
    const fetchSpy = vi.fn().mockResolvedValue(
      jsonResponse(201, {
        id: 5,
        title: '가정법 복습',
        targetType: 'STUDENT',
        targetStudentId: 7,
        target: '김민수',
        startDate: '2026-08-08',
        dueDate: '2026-08-10',
        status: '예정',
        progress: 0,
      }),
    )
    vi.stubGlobal('fetch', fetchSpy)

    await assignmentApi.createAssignment(ACCESS_TOKEN, {
      title: '가정법 복습',
      targetType: 'STUDENT',
      targetStudentId: 7,
      startDate: '2026-08-08',
      dueDate: '2026-08-10',
      questionIds: [1021],
    })

    const [, init] = fetchSpy.mock.calls[0]
    const body = JSON.parse(init.body)
    expect(body).toEqual({
      title: '가정법 복습',
      targetType: 'STUDENT',
      targetStudentId: 7,
      startDate: '2026-08-08',
      dueDate: '2026-08-10',
      questionIds: [1021],
    })
    expect(body).not.toHaveProperty('targetGroup')
  })

  it('throws an AssignmentApiError with the backend code/message on a 400 validation error', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        jsonResponse(400, { code: 'INVALID_ASSIGNMENT', message: '문제를 1개 이상 선택해야 합니다.' }),
      ),
    )

    await expect(assignmentApi.createAssignment(ACCESS_TOKEN, classRequest)).rejects.toMatchObject({
      message: '문제를 1개 이상 선택해야 합니다.',
      code: 'INVALID_ASSIGNMENT',
      status: 400,
    })
  })

  it('throws an AssignmentApiError when fetch itself rejects (network error)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))

    await expect(assignmentApi.createAssignment(ACCESS_TOKEN, classRequest)).rejects.toBeInstanceOf(
      AssignmentApiError,
    )
  })
})

describe('assignmentApi.updateAssignment', () => {
  it('PATCHes /api/assignments/{id} with only the provided field, inventing nothing else', async () => {
    const fetchSpy = vi.fn().mockResolvedValue(
      jsonResponse(200, {
        id: 1,
        title: '현재완료 시제 연습',
        targetType: 'CLASS',
        targetGroup: '중1 A반',
        target: '중1 A반',
        startDate: '2026-08-03',
        dueDate: '2026-08-12',
        status: '진행 중',
        progress: 84,
        questions: [],
      }),
    )
    vi.stubGlobal('fetch', fetchSpy)

    await assignmentApi.updateAssignment(ACCESS_TOKEN, 1, { dueDate: '2026-08-12' })

    const [url, init] = fetchSpy.mock.calls[0]
    expect(url).toBe('/api/assignments/1')
    expect(init.method).toBe('PATCH')
    expect(JSON.parse(init.body)).toEqual({ dueDate: '2026-08-12' })
  })

  it('omits the body entirely (empty object) when no fields are given', async () => {
    const fetchSpy = vi.fn().mockResolvedValue(
      jsonResponse(200, {
        id: 1,
        title: '현재완료 시제 연습',
        targetType: 'CLASS',
        targetGroup: '중1 A반',
        target: '중1 A반',
        startDate: '2026-08-03',
        dueDate: '2026-08-05',
        status: '진행 중',
        progress: 84,
        questions: [],
      }),
    )
    vi.stubGlobal('fetch', fetchSpy)

    await assignmentApi.updateAssignment(ACCESS_TOKEN, 1, {})

    const [, init] = fetchSpy.mock.calls[0]
    expect(JSON.parse(init.body)).toEqual({})
  })

  it('sends targetType together with its matching target field when changing target', async () => {
    const fetchSpy = vi.fn().mockResolvedValue(
      jsonResponse(200, {
        id: 1,
        title: '현재완료 시제 연습',
        targetType: 'STUDENT',
        targetStudentId: 9,
        target: '이서연',
        startDate: '2026-08-03',
        dueDate: '2026-08-05',
        status: '진행 중',
        progress: 0,
        questions: [],
      }),
    )
    vi.stubGlobal('fetch', fetchSpy)

    await assignmentApi.updateAssignment(ACCESS_TOKEN, 1, { targetType: 'STUDENT', targetStudentId: 9 })

    const [, init] = fetchSpy.mock.calls[0]
    expect(JSON.parse(init.body)).toEqual({ targetType: 'STUDENT', targetStudentId: 9 })
  })

  it('sends questionIds in full when reordering/replacing the question list', async () => {
    const fetchSpy = vi.fn().mockResolvedValue(
      jsonResponse(200, {
        id: 1,
        title: '현재완료 시제 연습',
        targetType: 'CLASS',
        targetGroup: '중1 A반',
        target: '중1 A반',
        startDate: '2026-08-03',
        dueDate: '2026-08-05',
        status: '진행 중',
        progress: 84,
        questions: [
          { id: 1021, order: 1, text: 'If I _____ you, I would study harder.', category: '가정법' },
          { id: 1024, order: 2, text: 'He has lived here _____ 2010.', category: '현재완료' },
        ],
      }),
    )
    vi.stubGlobal('fetch', fetchSpy)

    const result = await assignmentApi.updateAssignment(ACCESS_TOKEN, 1, { questionIds: [1021, 1024] })

    const [, init] = fetchSpy.mock.calls[0]
    expect(JSON.parse(init.body)).toEqual({ questionIds: [1021, 1024] })
    expect(result.questions.map((q) => q.id)).toEqual([1021, 1024])
    expect(result.questions.map((q) => q.order)).toEqual([1, 2])
  })

  it('throws an AssignmentApiError with ASSIGNMENT_ALREADY_CLOSED on a 409 conflict', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        jsonResponse(409, { code: 'ASSIGNMENT_ALREADY_CLOSED', message: '마감된 과제는 수정할 수 없습니다.' }),
      ),
    )

    await expect(assignmentApi.updateAssignment(ACCESS_TOKEN, 1, { dueDate: '2026-09-01' })).rejects.toMatchObject({
      message: '마감된 과제는 수정할 수 없습니다.',
      code: 'ASSIGNMENT_ALREADY_CLOSED',
      status: 409,
    })
  })
})

describe('assignmentApi.deleteAssignment', () => {
  it('DELETEs /api/assignments/{id} with the Bearer authorization header and resolves on 204', async () => {
    const fetchSpy = vi.fn().mockResolvedValue(emptyResponse(204))
    vi.stubGlobal('fetch', fetchSpy)

    await expect(assignmentApi.deleteAssignment(ACCESS_TOKEN, 1)).resolves.toBeUndefined()

    const [url, init] = fetchSpy.mock.calls[0]
    expect(url).toBe('/api/assignments/1')
    expect(init.method).toBe('DELETE')
    expect(init.headers.Authorization).toBe('Bearer access-token-abc')
  })

  it('throws an AssignmentApiError with the backend code/message on 404', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(jsonResponse(404, { code: 'ASSIGNMENT_NOT_FOUND', message: '과제를 찾을 수 없습니다.' })),
    )

    await expect(assignmentApi.deleteAssignment(ACCESS_TOKEN, 999)).rejects.toMatchObject({
      message: '과제를 찾을 수 없습니다.',
      code: 'ASSIGNMENT_NOT_FOUND',
      status: 404,
    })
  })

  it('throws an AssignmentApiError when fetch itself rejects (network error)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))

    await expect(assignmentApi.deleteAssignment(ACCESS_TOKEN, 1)).rejects.toBeInstanceOf(AssignmentApiError)
  })
})
