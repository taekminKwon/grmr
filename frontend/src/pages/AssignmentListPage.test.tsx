import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AuthProvider } from '../auth/AuthContext'
import AssignmentListPage from './AssignmentListPage'

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

function renderAssignmentListPage() {
  render(
    <AuthProvider>
      <MemoryRouter initialEntries={['/admin/assignments']}>
        <Routes>
          <Route path="/admin/assignments" element={<AssignmentListPage />} />
          <Route path="/admin/assignments/new" element={<div>Assignment create landing</div>} />
          <Route path="/admin/assignments/:id" element={<div>Assignment detail landing</div>} />
          <Route path="/login" element={<div>Login landing</div>} />
        </Routes>
      </MemoryRouter>
    </AuthProvider>,
  )
}

const rawAssignment = {
  id: 1,
  title: '현재완료 시제 연습',
  targetType: 'CLASS',
  targetGroup: '중1 A반',
  target: '중1 A반',
  startDate: '2026-08-03',
  dueDate: '2026-08-05',
  progress: 84,
  status: '마감',
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

describe('AssignmentListPage', () => {
  it('fetches assignments on mount using the session access token and renders the list', async () => {
    const fetchSpy = vi.fn().mockResolvedValue(jsonResponse(200, pageResponse([rawAssignment])))
    vi.stubGlobal('fetch', fetchSpy)
    seedAdminSession()

    renderAssignmentListPage()

    await waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(1))
    const [url, init] = fetchSpy.mock.calls[0]
    expect(url).toBe('/api/assignments?page=0&size=20')
    expect(init.headers.Authorization).toBe('Bearer access-token-abc')

    await waitFor(() => expect(screen.getByText('현재완료 시제 연습')).toBeDefined())
    const row = within(screen.getByRole('table'))
    expect(row.getByText('중1 A반')).toBeDefined()
    expect(row.getByText('2026-08-03')).toBeDefined()
    expect(row.getByText('2026-08-05')).toBeDefined()
    expect(row.getByText('84%')).toBeDefined()
    expect(row.getByText('마감')).toBeDefined()
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

    renderAssignmentListPage()

    expect(screen.getByRole('status').textContent).toBe('불러오는 중...')

    resolveFetch(jsonResponse(200, pageResponse([])))
    await waitFor(() => expect(screen.queryByRole('status')).toBeNull())
  })

  it('serializes applied status/keyword filters and resets to page 0', async () => {
    const fetchSpy = vi.fn().mockResolvedValue(jsonResponse(200, pageResponse([rawAssignment])))
    vi.stubGlobal('fetch', fetchSpy)
    seedAdminSession()

    renderAssignmentListPage()
    await waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(1))

    fireEvent.change(screen.getByLabelText('상태'), { target: { value: 'CLOSED' } })
    fireEvent.change(screen.getByLabelText('키워드'), { target: { value: '현재완료' } })
    fireEvent.click(screen.getByRole('button', { name: '검색' }))

    await waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(2))
    const [url] = fetchSpy.mock.calls[1]
    expect(url).toBe(
      '/api/assignments?status=%EB%A7%88%EA%B0%90&keyword=%ED%98%84%EC%9E%AC%EC%99%84%EB%A3%8C&page=0&size=20',
    )
  })

  it('clears filters and refetches from page 0 on reset', async () => {
    const fetchSpy = vi.fn().mockResolvedValue(jsonResponse(200, pageResponse([rawAssignment])))
    vi.stubGlobal('fetch', fetchSpy)
    seedAdminSession()

    renderAssignmentListPage()
    await waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(1))

    fireEvent.change(screen.getByLabelText('키워드'), { target: { value: '현재완료' } })
    fireEvent.click(screen.getByRole('button', { name: '검색' }))
    await waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(2))

    fireEvent.click(screen.getByRole('button', { name: '초기화' }))
    await waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(3))

    const [url] = fetchSpy.mock.calls[2]
    expect(url).toBe('/api/assignments?page=0&size=20')
    expect((screen.getByLabelText('키워드') as HTMLInputElement).value).toBe('')
  })

  it('shows an empty state when no assignments match', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(200, pageResponse([]))))
    seedAdminSession()

    renderAssignmentListPage()

    await waitFor(() => expect(screen.getByText('조건에 맞는 과제가 없습니다.')).toBeDefined())
  })

  it('shows a recoverable error and retries the same request on click', async () => {
    const fetchSpy = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(500, { code: 'INTERNAL_ERROR', message: '서버 오류가 발생했습니다.' }))
      .mockResolvedValueOnce(jsonResponse(200, pageResponse([rawAssignment])))
    vi.stubGlobal('fetch', fetchSpy)
    seedAdminSession()

    renderAssignmentListPage()

    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('서버 오류가 발생했습니다.'))
    expect(screen.getByRole('button', { name: '다시 시도' })).toBeDefined()

    fireEvent.click(screen.getByRole('button', { name: '다시 시도' }))

    await waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(2))
    await waitFor(() => expect(screen.getByText('현재완료 시제 연습')).toBeDefined())
  })

  it('shows a session-expired state on 401 and returns to /login after re-sign-in', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(jsonResponse(401, { code: 'TOKEN_EXPIRED', message: '세션이 만료되었습니다.' })),
    )
    seedAdminSession()

    renderAssignmentListPage()

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

    renderAssignmentListPage()

    await waitFor(() =>
      expect(screen.getByRole('alert').textContent).toContain(
        '과제를 조회할 권한이 없습니다. 관리자 계정으로 로그인했는지 확인해주세요.',
      ),
    )
    expect(screen.queryByRole('button', { name: '다시 시도' })).toBeNull()
    expect(screen.queryByRole('button', { name: '다시 로그인' })).toBeNull()
  })

  it('paginates using backend page metadata, disabling controls at the bounds', async () => {
    const fetchSpy = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse(200, pageResponse([rawAssignment], { page: 0, totalPages: 2, totalElements: 21 })),
      )
      .mockResolvedValueOnce(
        jsonResponse(
          200,
          pageResponse([{ ...rawAssignment, id: 2, title: '가정법 복습' }], {
            page: 1,
            totalPages: 2,
            totalElements: 21,
          }),
        ),
      )
    vi.stubGlobal('fetch', fetchSpy)
    seedAdminSession()

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
    expect(url).toBe('/api/assignments?page=1&size=20')

    await waitFor(() => expect(screen.getByText('가정법 복습')).toBeDefined())
    expect((screen.getByRole('button', { name: '이전' }) as HTMLButtonElement).disabled).toBe(false)
    expect((screen.getByRole('button', { name: '다음' }) as HTMLButtonElement).disabled).toBe(true)
  })

  it('links the assignment title to the assignment detail route', async () => {
    const fetchSpy = vi.fn().mockResolvedValue(jsonResponse(200, pageResponse([rawAssignment])))
    vi.stubGlobal('fetch', fetchSpy)
    seedAdminSession()

    renderAssignmentListPage()
    await waitFor(() => expect(screen.getByText('현재완료 시제 연습')).toBeDefined())

    const titleLink = screen.getByRole('link', { name: '현재완료 시제 연습' })
    expect(titleLink.getAttribute('href')).toBe('/admin/assignments/1')

    fireEvent.click(titleLink)

    expect(screen.getByText('Assignment detail landing')).toBeDefined()
  })

  it('shows a 과제 추가 button for an admin that navigates to the create route', async () => {
    const fetchSpy = vi.fn().mockResolvedValue(jsonResponse(200, pageResponse([])))
    vi.stubGlobal('fetch', fetchSpy)
    seedAdminSession()

    renderAssignmentListPage()
    await waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(1))

    const createButton = screen.getByRole('button', { name: '과제 추가' })
    fireEvent.click(createButton)

    expect(screen.getByText('Assignment create landing')).toBeDefined()
  })
})
