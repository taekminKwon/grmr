import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AuthProvider } from '../auth/AuthContext'
import StudentAssignmentListPage from './StudentAssignmentListPage'

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

function seedStudentSession() {
  sessionStorage.setItem(
    'grmr.auth.session',
    JSON.stringify({ accessToken: 'access-token-abc', user: { name: '김학생', role: 'STUDENT' } }),
  )
}

function renderAssignmentListPage(initialEntries: string[] = ['/student/assignments']) {
  render(
    <AuthProvider>
      <MemoryRouter initialEntries={initialEntries}>
        <Routes>
          <Route path="/student/assignments" element={<StudentAssignmentListPage />} />
          <Route path="/student/assignments/:id" element={<div>Assignment solving landing</div>} />
          <Route path="/student/assignments/:id/result" element={<div>Assignment result landing</div>} />
          <Route path="/login" element={<div>Login landing</div>} />
        </Routes>
      </MemoryRouter>
    </AuthProvider>,
  )
}

const notStartedItem = {
  id: 1,
  title: '현재완료 시제 연습',
  startDate: '2026-08-03',
  dueDate: '2026-08-20',
  status: '진행 중',
  submissionStatus: 'NOT_STARTED',
  progress: 0,
}

const inProgressItem = {
  id: 2,
  title: '가정법 심화 연습',
  startDate: '2026-08-01',
  dueDate: '2026-08-25',
  status: '진행 중',
  submissionStatus: 'IN_PROGRESS',
  progress: 40,
}

const submittedItem = {
  id: 3,
  title: '수동태 마감 과제',
  startDate: '2026-07-01',
  dueDate: '2026-07-10',
  status: '마감',
  submissionStatus: 'SUBMITTED',
  progress: 100,
}

const closedUnsubmittedItem = {
  id: 4,
  title: '관계대명사 마감 미제출 과제',
  startDate: '2026-07-01',
  dueDate: '2026-07-10',
  status: '마감',
  submissionStatus: 'NOT_STARTED',
  progress: 0,
}

function pageResponse(content: unknown[], overrides: Partial<Record<string, unknown>> = {}) {
  return {
    content,
    page: 0,
    size: 20,
    totalElements: content.length,
    totalPages: content.length > 0 ? 1 : 0,
    ...overrides,
  }
}

describe('StudentAssignmentListPage', () => {
  it('fetches assignments on mount using the session access token and renders due-date-ascending order as returned', async () => {
    const fetchSpy = vi.fn().mockResolvedValue(jsonResponse(200, pageResponse([notStartedItem, inProgressItem])))
    vi.stubGlobal('fetch', fetchSpy)
    seedStudentSession()

    renderAssignmentListPage()

    await waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(1))
    const [url, init] = fetchSpy.mock.calls[0]
    expect(url).toBe('/api/me/assignments?page=0&size=20')
    expect(init.headers.Authorization).toBe('Bearer access-token-abc')

    await waitFor(() => expect(screen.getByRole('table')).toBeDefined())
    const rows = within(screen.getByRole('table')).getAllByRole('row')
    // Header row + two data rows, in the order the API returned them.
    expect(within(rows[1]).getByText('현재완료 시제 연습')).toBeDefined()
    expect(within(rows[2]).getByText('가정법 심화 연습')).toBeDefined()
  })

  it('shows a loading indicator while the request is in flight', async () => {
    let resolveFetch: (value: Response) => void = () => {}
    const fetchSpy = vi.fn(
      () =>
        new Promise<Response>((resolve) => {
          resolveFetch = resolve
        }),
    )
    vi.stubGlobal('fetch', fetchSpy)
    seedStudentSession()

    renderAssignmentListPage()

    expect(screen.getByRole('status').textContent).toBe('불러오는 중...')

    resolveFetch(jsonResponse(200, pageResponse([])))
    await waitFor(() => expect(screen.queryByRole('status')).toBeNull())
  })

  it('shows an empty state when there are no assignments', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(200, pageResponse([]))))
    seedStudentSession()

    renderAssignmentListPage()

    await waitFor(() => expect(screen.getByText('받은 과제가 없습니다.')).toBeDefined())
  })

  it('shows a recoverable error and retries the same request on click', async () => {
    const fetchSpy = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(500, { code: 'INTERNAL_ERROR', message: '서버 오류가 발생했습니다.' }))
      .mockResolvedValueOnce(jsonResponse(200, pageResponse([notStartedItem])))
    vi.stubGlobal('fetch', fetchSpy)
    seedStudentSession()

    renderAssignmentListPage()

    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('서버 오류가 발생했습니다.'))
    expect(screen.getByRole('button', { name: '다시 시도' })).toBeDefined()

    fireEvent.click(screen.getByRole('button', { name: '다시 시도' }))

    await waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(2))
    await waitFor(() => expect(screen.getByText('현재완료 시제 연습')).toBeDefined())
  })

  it('shows a network-error retry state distinctly from a server error, using the same recoverable path', async () => {
    const fetchSpy = vi.fn().mockRejectedValueOnce(new TypeError('Failed to fetch'))
    vi.stubGlobal('fetch', fetchSpy)
    seedStudentSession()

    renderAssignmentListPage()

    await waitFor(() =>
      expect(screen.getByRole('alert').textContent).toContain('네트워크 오류가 발생했습니다.'),
    )
    expect(screen.getByRole('button', { name: '다시 시도' })).toBeDefined()
  })

  it('shows a session-expired state on 401 and returns to /login after re-sign-in', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(jsonResponse(401, { code: 'TOKEN_EXPIRED', message: '세션이 만료되었습니다.' })),
    )
    seedStudentSession()

    renderAssignmentListPage()

    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('세션이 만료되었습니다.'))
    fireEvent.click(screen.getByRole('button', { name: '다시 로그인' }))

    expect(screen.getByText('Login landing')).toBeDefined()
    expect(sessionStorage.getItem('grmr.auth.session')).toBeNull()
  })

  it('shows a distinct forbidden message on 403 without offering retry or re-sign-in', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(403, { code: 'FORBIDDEN', message: '권한이 없습니다.' })))
    seedStudentSession()

    renderAssignmentListPage()

    await waitFor(() =>
      expect(screen.getByRole('alert').textContent).toContain('과제를 조회할 권한이 없습니다.'),
    )
    expect(screen.queryByRole('button', { name: '다시 시도' })).toBeNull()
    expect(screen.queryByRole('button', { name: '다시 로그인' })).toBeNull()
  })

  it('paginates using backend page metadata, disabling controls at the bounds', async () => {
    const fetchSpy = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(200, pageResponse([notStartedItem], { page: 0, totalPages: 2, totalElements: 21 })))
      .mockResolvedValueOnce(
        jsonResponse(200, pageResponse([inProgressItem], { page: 1, totalPages: 2, totalElements: 21 })),
      )
    vi.stubGlobal('fetch', fetchSpy)
    seedStudentSession()

    renderAssignmentListPage()
    await waitFor(() => expect(screen.getByText('현재완료 시제 연습')).toBeDefined())

    const prevButton = screen.getByRole('button', { name: '이전' })
    const nextButton = screen.getByRole('button', { name: '다음' })
    expect((prevButton as HTMLButtonElement).disabled).toBe(true)
    expect((nextButton as HTMLButtonElement).disabled).toBe(false)
    expect(screen.getByText('1 / 2 페이지 · 총 21건')).toBeDefined()

    fireEvent.click(nextButton)

    await waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(2))
    const [url] = fetchSpy.mock.calls[1]
    expect(url).toBe('/api/me/assignments?page=1&size=20')

    await waitFor(() => expect(screen.getByText('가정법 심화 연습')).toBeDefined())
    expect((screen.getByRole('button', { name: '이전' }) as HTMLButtonElement).disabled).toBe(false)
    expect((screen.getByRole('button', { name: '다음' }) as HTMLButtonElement).disabled).toBe(true)
  })

  it('renders distinct badges for assignment lifecycle status and this student\'s submission status', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(200, pageResponse([inProgressItem]))))
    seedStudentSession()

    renderAssignmentListPage()

    await waitFor(() => expect(screen.getByText('가정법 심화 연습')).toBeDefined())
    const row = within(screen.getAllByRole('row')[1])
    expect(row.getByText('진행 중')).toBeDefined()
    expect(row.getByText('풀이 중')).toBeDefined()
    expect(row.getByText('40%')).toBeDefined()
  })

  it('shows "시작하기" for NOT_STARTED and navigates to the solving route', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(200, pageResponse([notStartedItem]))))
    seedStudentSession()

    renderAssignmentListPage()
    await waitFor(() => expect(screen.getByText('현재완료 시제 연습')).toBeDefined())

    fireEvent.click(screen.getByRole('button', { name: '시작하기' }))

    expect(screen.getByText('Assignment solving landing')).toBeDefined()
  })

  it('shows "이어서 풀기" for IN_PROGRESS and navigates to the same solving route', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(200, pageResponse([inProgressItem]))))
    seedStudentSession()

    renderAssignmentListPage()
    await waitFor(() => expect(screen.getByText('가정법 심화 연습')).toBeDefined())

    fireEvent.click(screen.getByRole('button', { name: '이어서 풀기' }))

    expect(screen.getByText('Assignment solving landing')).toBeDefined()
  })

  it('shows "결과 보기" for SUBMITTED and navigates to the result route', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(200, pageResponse([submittedItem]))))
    seedStudentSession()

    renderAssignmentListPage()
    await waitFor(() => expect(screen.getByText('수동태 마감 과제')).toBeDefined())

    fireEvent.click(screen.getByRole('button', { name: '결과 보기' }))

    expect(screen.getByText('Assignment result landing')).toBeDefined()
  })

  it('disables the CTA for a closed, unsubmitted assignment instead of implying it can still be solved or submitted', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(200, pageResponse([closedUnsubmittedItem]))))
    seedStudentSession()

    renderAssignmentListPage()
    await waitFor(() => expect(screen.getByText('관계대명사 마감 미제출 과제')).toBeDefined())

    const ctaButton = screen.getByRole('button', { name: '마감됨' }) as HTMLButtonElement
    expect(ctaButton.disabled).toBe(true)
    expect(screen.queryByRole('button', { name: '시작하기' })).toBeNull()

    fireEvent.click(ctaButton)
    expect(screen.queryByText('Assignment solving landing')).toBeNull()
  })
})
