import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AuthProvider } from '../auth/AuthContext'
import StudentDetailPage from './StudentDetailPage'

afterEach(() => {
  cleanup()
  sessionStorage.clear()
  vi.unstubAllGlobals()
})

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function seedAdminSession() {
  sessionStorage.setItem(
    'grmr.auth.session',
    JSON.stringify({ accessToken: 'access-token-abc', user: { name: '권태민', role: 'ADMIN' } }),
  )
}

function renderStudentDetailPage(initialEntry = '/admin/students/501') {
  render(
    <AuthProvider>
      <MemoryRouter initialEntries={[initialEntry]}>
        <Routes>
          <Route path="/admin/students/:id" element={<StudentDetailPage />} />
          <Route path="/admin/students" element={<div>Student list landing</div>} />
          <Route path="/login" element={<div>Login landing</div>} />
        </Routes>
      </MemoryRouter>
    </AuthProvider>,
  )
}

const rawStudent = {
  id: 501,
  name: '김민수',
  studentGroup: '중1 A반',
  lastStudiedAt: '2026-08-01',
  totalQuestionCount: 128,
  accuracy: 74,
  pendingAssignmentCount: 1,
}

const rawNeverStudiedStudent = {
  id: 502,
  name: '이지은',
  studentGroup: null,
  lastStudiedAt: null,
  totalQuestionCount: 0,
  accuracy: 0,
  pendingAssignmentCount: 0,
}

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

function historyPageResponse(content: unknown[], overrides: Partial<Record<string, unknown>> = {}) {
  return {
    content,
    page: 0,
    size: 20,
    totalElements: content.length,
    totalPages: content.length > 0 ? 1 : 0,
    ...overrides,
  }
}

// Routes requests by URL: student-detail path vs. study-records path.
function stubFetchRouting(handlers: { student?: () => Response; history?: () => Response }) {
  const fetchSpy = vi.fn((url: string) => {
    if (url.startsWith('/api/study-records')) {
      return Promise.resolve(handlers.history ? handlers.history() : historyResponseFallback())
    }
    return Promise.resolve(handlers.student ? handlers.student() : jsonResponse(200, rawStudent))
  })
  vi.stubGlobal('fetch', fetchSpy)
  return fetchSpy

  function historyResponseFallback() {
    return jsonResponse(200, historyPageResponse([]))
  }
}

describe('StudentDetailPage', () => {
  it('fetches the student on mount, then fetches study records, and renders both', async () => {
    const fetchSpy = stubFetchRouting({
      student: () => jsonResponse(200, rawStudent),
      history: () => jsonResponse(200, historyPageResponse([rawRollup])),
    })
    seedAdminSession()

    renderStudentDetailPage()

    await waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(1))
    const [studentUrl, studentInit] = fetchSpy.mock.calls[0] as unknown as [
      string,
      RequestInit & { headers: Record<string, string> },
    ]
    expect(studentUrl).toBe('/api/students/501')
    expect(studentInit.headers.Authorization).toBe('Bearer access-token-abc')

    await waitFor(() => expect(screen.getByText('김민수')).toBeDefined())
    expect(screen.getByText('중1 A반')).toBeDefined()
    expect(screen.getByText('2026-08-01')).toBeDefined()
    expect(screen.getByText('128')).toBeDefined()
    expect(screen.getByText('74%')).toBeDefined()

    await waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(2))
    const [historyUrl] = fetchSpy.mock.calls[1]
    const params = new URLSearchParams(historyUrl.split('?')[1])
    expect(params.get('studentId')).toBe('501')
    expect(params.get('period')).toBe('30d')
    expect(params.get('page')).toBe('0')
    expect(params.get('size')).toBe('20')

    const table = screen.getByRole('table')
    expect(within(table).getByText('과제')).toBeDefined()
    expect(within(table).getByText('20')).toBeDefined()
    expect(within(table).getByText('16')).toBeDefined()
    expect(within(table).getByText('80%')).toBeDefined()
  })

  it('shows a loading indicator while the student request is in flight', async () => {
    let resolveFetch: (value: Response) => void = () => {}
    const fetchSpy = vi.fn(
      () =>
        new Promise<Response>((resolve) => {
          resolveFetch = resolve
        }),
    )
    vi.stubGlobal('fetch', fetchSpy)
    seedAdminSession()

    renderStudentDetailPage()

    expect(screen.getByRole('status').textContent).toBe('불러오는 중...')

    resolveFetch(jsonResponse(200, rawStudent))
    await waitFor(() => expect(screen.getByText('김민수')).toBeDefined())
  })

  it('shows a clear fallback for a null studentGroup and never-studied lastStudiedAt, with zero counters', async () => {
    stubFetchRouting({ student: () => jsonResponse(200, rawNeverStudiedStudent) })
    seedAdminSession()

    renderStudentDetailPage('/admin/students/502')
    await waitFor(() => expect(screen.getByText('이지은')).toBeDefined())

    expect(screen.getByText('미배정')).toBeDefined()
    expect(screen.getByText('학습 기록 없음')).toBeDefined()
    expect(screen.getByText('0%')).toBeDefined()
    expect(screen.getAllByText('0').length).toBeGreaterThanOrEqual(2)
  })

  it('shows an empty state when there is no study history', async () => {
    stubFetchRouting({
      student: () => jsonResponse(200, rawStudent),
      history: () => jsonResponse(200, historyPageResponse([])),
    })
    seedAdminSession()

    renderStudentDetailPage()

    await waitFor(() => expect(screen.getByText('조건에 맞는 학습 이력이 없습니다.')).toBeDefined())
  })

  it('shows a not-found state on student 404 with a link back to the list, and does not fetch study records', async () => {
    const fetchSpy = stubFetchRouting({
      student: () => jsonResponse(404, { code: 'STUDENT_NOT_FOUND', message: '학생을 찾을 수 없습니다.' }),
    })
    seedAdminSession()

    renderStudentDetailPage()

    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('학생을 찾을 수 없습니다.'))
    expect(fetchSpy).toHaveBeenCalledTimes(1)

    fireEvent.click(screen.getByRole('link', { name: '목록으로 돌아가기' }))
    expect(screen.getByText('Student list landing')).toBeDefined()
  })

  it('shows an invalid-ID state without calling the API when the route ID is not a positive integer', async () => {
    const fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)
    seedAdminSession()

    renderStudentDetailPage('/admin/students/abc')

    expect(screen.getByRole('alert').textContent).toContain('잘못된 학생 번호입니다.')
    expect(fetchSpy).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('link', { name: '목록으로 돌아가기' }))
    expect(screen.getByText('Student list landing')).toBeDefined()
  })

  it('shows a session-expired state on student 401 and returns to /login after re-sign-in', async () => {
    stubFetchRouting({
      student: () => jsonResponse(401, { code: 'TOKEN_EXPIRED', message: '세션이 만료되었습니다.' }),
    })
    seedAdminSession()

    renderStudentDetailPage()

    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('세션이 만료되었습니다.'))
    fireEvent.click(screen.getByRole('button', { name: '다시 로그인' }))

    expect(screen.getByText('Login landing')).toBeDefined()
    expect(sessionStorage.getItem('grmr.auth.session')).toBeNull()
  })

  it('shows a distinct forbidden message on student 403 without offering retry or re-sign-in', async () => {
    stubFetchRouting({
      student: () => jsonResponse(403, { code: 'FORBIDDEN', message: '권한이 없습니다.' }),
    })
    seedAdminSession()

    renderStudentDetailPage()

    await waitFor(() =>
      expect(screen.getByRole('alert').textContent).toContain('학생 정보를 조회할 권한이 없습니다.'),
    )
    expect(screen.queryByRole('button', { name: '다시 시도' })).toBeNull()
    expect(screen.queryByRole('button', { name: '다시 로그인' })).toBeNull()
  })

  it('shows a recoverable error and retries the same student request on click', async () => {
    let studentCallCount = 0
    const fetchSpy = vi.fn((url: string) => {
      if (url.startsWith('/api/study-records')) {
        return Promise.resolve(jsonResponse(200, historyPageResponse([])))
      }
      studentCallCount += 1
      if (studentCallCount === 1) {
        return Promise.resolve(jsonResponse(500, { code: 'INTERNAL_ERROR', message: '서버 오류가 발생했습니다.' }))
      }
      return Promise.resolve(jsonResponse(200, rawStudent))
    })
    vi.stubGlobal('fetch', fetchSpy)
    seedAdminSession()

    renderStudentDetailPage()

    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('서버 오류가 발생했습니다.'))
    fireEvent.click(screen.getByRole('button', { name: '다시 시도' }))

    await waitFor(() => expect(screen.getByText('김민수')).toBeDefined())
  })

  it('shows a recoverable error for the history section and retries only the history request', async () => {
    let historyCallCount = 0
    const fetchSpy = vi.fn((url: string) => {
      if (url.startsWith('/api/study-records')) {
        historyCallCount += 1
        if (historyCallCount === 1) {
          return Promise.resolve(
            jsonResponse(500, { code: 'INTERNAL_ERROR', message: '학습 이력 서버 오류가 발생했습니다.' }),
          )
        }
        return Promise.resolve(jsonResponse(200, historyPageResponse([rawRollup])))
      }
      return Promise.resolve(jsonResponse(200, rawStudent))
    })
    vi.stubGlobal('fetch', fetchSpy)
    seedAdminSession()

    renderStudentDetailPage()

    await waitFor(() => expect(screen.getByText('김민수')).toBeDefined())
    await waitFor(() =>
      expect(screen.getByRole('alert').textContent).toContain('학습 이력 서버 오류가 발생했습니다.'),
    )

    fireEvent.click(screen.getByRole('button', { name: '다시 시도' }))

    await waitFor(() => expect(screen.getByRole('table')).toBeDefined())
    expect(screen.getByText('김민수')).toBeDefined()
  })

  it('applies period/type filters through the shared contract and resets the page to 0', async () => {
    const fetchSpy = stubFetchRouting({
      student: () => jsonResponse(200, rawStudent),
      history: () => jsonResponse(200, historyPageResponse([rawRollup])),
    })
    seedAdminSession()

    renderStudentDetailPage()
    await waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(2))

    fireEvent.change(screen.getByLabelText('기간'), { target: { value: '7d' } })
    fireEvent.change(screen.getByLabelText('유형'), { target: { value: 'PRACTICE' } })
    fireEvent.click(screen.getByRole('button', { name: '검색' }))

    await waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(3))
    const [url] = fetchSpy.mock.calls[2]
    const params = new URLSearchParams(url.split('?')[1])
    expect(params.get('period')).toBe('7d')
    expect(params.get('type')).toBe('PRACTICE')
    expect(params.get('page')).toBe('0')
  })

  it('clears filters and refetches from page 0 on reset', async () => {
    const fetchSpy = stubFetchRouting({
      student: () => jsonResponse(200, rawStudent),
      history: () => jsonResponse(200, historyPageResponse([rawRollup])),
    })
    seedAdminSession()

    renderStudentDetailPage()
    await waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(2))

    fireEvent.change(screen.getByLabelText('기간'), { target: { value: '7d' } })
    fireEvent.click(screen.getByRole('button', { name: '검색' }))
    await waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(3))

    fireEvent.click(screen.getByRole('button', { name: '초기화' }))
    await waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(4))

    const [url] = fetchSpy.mock.calls[3]
    const params = new URLSearchParams(url.split('?')[1])
    expect(params.get('period')).toBe('30d')
    expect(params.get('type')).toBeNull()
    expect(params.get('page')).toBe('0')
    expect((screen.getByLabelText('기간') as HTMLSelectElement).value).toBe('30d')
    expect((screen.getByLabelText('유형') as HTMLSelectElement).value).toBe('')
  })

  it('paginates study history using backend page metadata, disabling controls at the bounds', async () => {
    let historyCallCount = 0
    const fetchSpy = vi.fn((url: string) => {
      if (url.startsWith('/api/study-records')) {
        historyCallCount += 1
        if (historyCallCount === 1) {
          return Promise.resolve(
            jsonResponse(200, historyPageResponse([rawRollup], { page: 0, totalPages: 2, totalElements: 21 })),
          )
        }
        return Promise.resolve(
          jsonResponse(
            200,
            historyPageResponse([{ ...rawRollup, date: '2026-07-31' }], { page: 1, totalPages: 2, totalElements: 21 }),
          ),
        )
      }
      return Promise.resolve(jsonResponse(200, rawStudent))
    })
    vi.stubGlobal('fetch', fetchSpy)
    seedAdminSession()

    renderStudentDetailPage()
    await waitFor(() => expect(screen.getByRole('table')).toBeDefined())

    const prevButton = screen.getByRole('button', { name: '이전' })
    const nextButton = screen.getByRole('button', { name: '다음' })
    expect((prevButton as HTMLButtonElement).disabled).toBe(true)
    expect((nextButton as HTMLButtonElement).disabled).toBe(false)
    expect(screen.getByText('1 / 2 페이지 · 총 21건')).toBeDefined()

    fireEvent.click(nextButton)

    await waitFor(() => expect(screen.getByText('2026-07-31')).toBeDefined())
    expect((screen.getByRole('button', { name: '이전' }) as HTMLButtonElement).disabled).toBe(false)
    expect((screen.getByRole('button', { name: '다음' }) as HTMLButtonElement).disabled).toBe(true)
  })
})
