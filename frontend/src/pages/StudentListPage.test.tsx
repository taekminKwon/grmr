import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AuthProvider } from '../auth/AuthContext'
import StudentListPage from './StudentListPage'

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

function renderStudentListPage() {
  render(
    <AuthProvider>
      <MemoryRouter initialEntries={['/admin/students']}>
        <Routes>
          <Route path="/admin/students" element={<StudentListPage />} />
          <Route path="/admin/students/:id" element={<div>Student detail landing</div>} />
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

describe('StudentListPage', () => {
  it('fetches students on mount using the session access token and renders the list', async () => {
    const fetchSpy = vi.fn().mockResolvedValue(jsonResponse(200, pageResponse([rawStudent])))
    vi.stubGlobal('fetch', fetchSpy)
    seedAdminSession()

    renderStudentListPage()

    await waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(1))
    const [url, init] = fetchSpy.mock.calls[0]
    expect(url).toBe('/api/students?page=0&size=20')
    expect(init.headers.Authorization).toBe('Bearer access-token-abc')

    await waitFor(() => expect(screen.getByText('김민수')).toBeDefined())
    const row = within(screen.getByRole('table'))
    expect(row.getByText('중1 A반')).toBeDefined()
    expect(row.getByText('2026-08-01')).toBeDefined()
    expect(row.getByText('128')).toBeDefined()
    expect(row.getByText('74%')).toBeDefined()
    expect(row.getByText('1')).toBeDefined()
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
    seedAdminSession()

    renderStudentListPage()

    expect(screen.getByRole('status').textContent).toBe('불러오는 중...')

    resolveFetch(jsonResponse(200, pageResponse([])))
    await waitFor(() => expect(screen.queryByRole('status')).toBeNull())
  })

  it('shows a clear fallback for a null studentGroup and a never-studied lastStudiedAt, with zero counters', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(200, pageResponse([rawNeverStudiedStudent]))))
    seedAdminSession()

    renderStudentListPage()
    await waitFor(() => expect(screen.getByText('이지은')).toBeDefined())

    const row = within(screen.getByRole('table'))
    expect(row.getByText('미배정')).toBeDefined()
    expect(row.getByText('학습 기록 없음')).toBeDefined()
    expect(row.getByText('0%')).toBeDefined()
    // totalQuestionCount and pendingAssignmentCount both render as literal "0", not blank.
    expect(row.getAllByText('0').length).toBeGreaterThanOrEqual(2)
  })

  it('serializes applied keyword/group filters through the shared contract and resets to page 0', async () => {
    const fetchSpy = vi.fn().mockResolvedValue(jsonResponse(200, pageResponse([rawStudent])))
    vi.stubGlobal('fetch', fetchSpy)
    seedAdminSession()

    renderStudentListPage()
    await waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(1))

    fireEvent.change(screen.getByLabelText('이름'), { target: { value: '민수' } })
    fireEvent.change(screen.getByLabelText('그룹'), { target: { value: '중1 A반' } })
    fireEvent.click(screen.getByRole('button', { name: '검색' }))

    await waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(2))
    const [url] = fetchSpy.mock.calls[1]
    const params = new URLSearchParams(url.split('?')[1])
    expect(params.get('keyword')).toBe('민수')
    expect(params.get('group')).toBe('중1 A반')
    expect(params.get('page')).toBe('0')
  })

  it('clears filters and refetches from page 0 on reset', async () => {
    const fetchSpy = vi.fn().mockResolvedValue(jsonResponse(200, pageResponse([rawStudent])))
    vi.stubGlobal('fetch', fetchSpy)
    seedAdminSession()

    renderStudentListPage()
    await waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(1))

    fireEvent.change(screen.getByLabelText('이름'), { target: { value: '민수' } })
    fireEvent.click(screen.getByRole('button', { name: '검색' }))
    await waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(2))

    fireEvent.click(screen.getByRole('button', { name: '초기화' }))
    await waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(3))

    const [url] = fetchSpy.mock.calls[2]
    expect(url).toBe('/api/students?page=0&size=20')
    expect((screen.getByLabelText('이름') as HTMLInputElement).value).toBe('')
    expect((screen.getByLabelText('그룹') as HTMLInputElement).value).toBe('')
  })

  it('shows an empty state when no students match', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(200, pageResponse([]))))
    seedAdminSession()

    renderStudentListPage()

    await waitFor(() => expect(screen.getByText('조건에 맞는 학생이 없습니다.')).toBeDefined())
  })

  it('shows a recoverable error and retries the same request on click', async () => {
    const fetchSpy = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(500, { code: 'INTERNAL_ERROR', message: '서버 오류가 발생했습니다.' }))
      .mockResolvedValueOnce(jsonResponse(200, pageResponse([rawStudent])))
    vi.stubGlobal('fetch', fetchSpy)
    seedAdminSession()

    renderStudentListPage()

    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('서버 오류가 발생했습니다.'))
    expect(screen.getByRole('button', { name: '다시 시도' })).toBeDefined()

    fireEvent.click(screen.getByRole('button', { name: '다시 시도' }))

    await waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(2))
    await waitFor(() => expect(screen.getByText('김민수')).toBeDefined())
  })

  it('shows a session-expired state on 401 and returns to /login after re-sign-in', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(jsonResponse(401, { code: 'TOKEN_EXPIRED', message: '세션이 만료되었습니다.' })),
    )
    seedAdminSession()

    renderStudentListPage()

    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('세션이 만료되었습니다.'))
    const reSignInButton = screen.getByRole('button', { name: '다시 로그인' })

    fireEvent.click(reSignInButton)

    expect(screen.getByText('Login landing')).toBeDefined()
    expect(sessionStorage.getItem('grmr.auth.session')).toBeNull()
  })

  it('shows a forbidden state on 403 with no retry/re-sign-in action', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(jsonResponse(403, { code: 'FORBIDDEN', message: '권한이 없습니다.' })),
    )
    seedAdminSession()

    renderStudentListPage()

    await waitFor(() =>
      expect(screen.getByRole('alert').textContent).toContain(
        '학생 목록을 조회할 권한이 없습니다. 관리자 계정으로 로그인했는지 확인해주세요.',
      ),
    )
    expect(screen.queryByRole('button', { name: '다시 시도' })).toBeNull()
    expect(screen.queryByRole('button', { name: '다시 로그인' })).toBeNull()
  })

  it('paginates using backend page metadata, disabling controls at the bounds', async () => {
    const fetchSpy = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(200, pageResponse([rawStudent], { page: 0, totalPages: 2, totalElements: 21 })))
      .mockResolvedValueOnce(
        jsonResponse(
          200,
          pageResponse([{ ...rawStudent, id: 503, name: '박서준' }], { page: 1, totalPages: 2, totalElements: 21 }),
        ),
      )
    vi.stubGlobal('fetch', fetchSpy)
    seedAdminSession()

    renderStudentListPage()
    await waitFor(() => expect(screen.getByText('김민수')).toBeDefined())

    const prevButton = screen.getByRole('button', { name: '이전' })
    const nextButton = screen.getByRole('button', { name: '다음' })
    expect((prevButton as HTMLButtonElement).disabled).toBe(true)
    expect((nextButton as HTMLButtonElement).disabled).toBe(false)
    expect(screen.getByText('1 / 2 페이지 · 총 21건')).toBeDefined()

    fireEvent.click(nextButton)

    await waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(2))
    const [url] = fetchSpy.mock.calls[1]
    expect(url).toBe('/api/students?page=1&size=20')

    await waitFor(() => expect(screen.getByText('박서준')).toBeDefined())
    expect((screen.getByRole('button', { name: '이전' }) as HTMLButtonElement).disabled).toBe(false)
    expect((screen.getByRole('button', { name: '다음' }) as HTMLButtonElement).disabled).toBe(true)
  })

  it('navigates to the student detail route when the student name link is clicked', async () => {
    const fetchSpy = vi.fn().mockResolvedValue(jsonResponse(200, pageResponse([rawStudent])))
    vi.stubGlobal('fetch', fetchSpy)
    seedAdminSession()

    renderStudentListPage()
    await waitFor(() => expect(screen.getByText('김민수')).toBeDefined())

    const nameLink = screen.getByRole('link', { name: '김민수' })
    expect(nameLink.getAttribute('href')).toBe('/admin/students/501')

    fireEvent.click(nameLink)

    expect(screen.getByText('Student detail landing')).toBeDefined()
  })
})
