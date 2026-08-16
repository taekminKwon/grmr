import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AuthProvider } from '../auth/AuthContext'
import AssignmentDetailPage from './AssignmentDetailPage'

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

function renderAssignmentDetailPage(initialEntry = '/admin/assignments/7') {
  render(
    <AuthProvider>
      <MemoryRouter initialEntries={[initialEntry]}>
        <Routes>
          <Route path="/admin/assignments/:id" element={<AssignmentDetailPage />} />
          <Route path="/admin/assignments/:id/edit" element={<div>Assignment edit landing</div>} />
          <Route path="/admin/assignments" element={<div>Assignment list landing</div>} />
          <Route path="/login" element={<div>Login landing</div>} />
        </Routes>
      </MemoryRouter>
    </AuthProvider>,
  )
}

const rawAssignment = {
  id: 7,
  title: '현재완료 시제 연습',
  targetType: 'CLASS',
  targetGroup: '중1 A반',
  target: '중1 A반',
  startDate: '2026-08-03',
  dueDate: '2026-08-10',
  progress: 40,
  status: '진행 중',
  questions: [
    { id: 202, order: 2, text: 'She _____ here since 2020.', category: '현재완료' },
    { id: 101, order: 1, text: 'He has lived here _____ 2010.', category: '현재완료' },
  ],
}

describe('AssignmentDetailPage', () => {
  it('fetches the assignment on mount using the session access token and renders full detail', async () => {
    const fetchSpy = vi.fn().mockResolvedValue(jsonResponse(200, rawAssignment))
    vi.stubGlobal('fetch', fetchSpy)
    seedAdminSession()

    renderAssignmentDetailPage()

    await waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(1))
    const [url, init] = fetchSpy.mock.calls[0]
    expect(url).toBe('/api/assignments/7')
    expect(init.headers.Authorization).toBe('Bearer access-token-abc')

    await waitFor(() => expect(screen.getByText('현재완료 시제 연습')).toBeDefined())
    expect(screen.getByText('중1 A반')).toBeDefined()
    expect(screen.getByText('2026-08-03')).toBeDefined()
    expect(screen.getByText('2026-08-10')).toBeDefined()
    expect(screen.getByText('40%')).toBeDefined()
    expect(screen.getByText('진행 중')).toBeDefined()
  })

  it('renders questions ordered by their order field, not response order', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(200, rawAssignment)))
    seedAdminSession()

    renderAssignmentDetailPage()

    await waitFor(() => expect(screen.getByRole('table')).toBeDefined())
    const rows = within(screen.getByRole('table')).getAllByRole('row').slice(1)
    expect(rows).toHaveLength(2)
    expect(within(rows[0]).getByText('He has lived here _____ 2010.')).toBeDefined()
    expect(within(rows[0]).getByText('1')).toBeDefined()
    expect(within(rows[1]).getByText('She _____ here since 2020.')).toBeDefined()
    expect(within(rows[1]).getByText('2')).toBeDefined()
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

    renderAssignmentDetailPage()

    expect(screen.getByRole('status').textContent).toBe('불러오는 중...')

    resolveFetch(jsonResponse(200, rawAssignment))
    await waitFor(() => expect(screen.queryByRole('status')).toBeNull())
  })

  it('shows a not-found state on 404 with a link back to the list', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(jsonResponse(404, { code: 'ASSIGNMENT_NOT_FOUND', message: '과제를 찾을 수 없습니다.' })),
    )
    seedAdminSession()

    renderAssignmentDetailPage()

    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('과제를 찾을 수 없습니다.'))
    expect(screen.queryByRole('button', { name: '다시 시도' })).toBeNull()
    expect(screen.queryByRole('button', { name: '다시 로그인' })).toBeNull()

    fireEvent.click(screen.getByRole('link', { name: '목록으로 돌아가기' }))
    expect(screen.getByText('Assignment list landing')).toBeDefined()
  })

  it('shows a recoverable error and retries the same request on click', async () => {
    const fetchSpy = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(500, { code: 'INTERNAL_ERROR', message: '서버 오류가 발생했습니다.' }))
      .mockResolvedValueOnce(jsonResponse(200, rawAssignment))
    vi.stubGlobal('fetch', fetchSpy)
    seedAdminSession()

    renderAssignmentDetailPage()

    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('서버 오류가 발생했습니다.'))
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

    renderAssignmentDetailPage()

    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('세션이 만료되었습니다.'))
    fireEvent.click(screen.getByRole('button', { name: '다시 로그인' }))

    expect(screen.getByText('Login landing')).toBeDefined()
    expect(sessionStorage.getItem('grmr.auth.session')).toBeNull()
  })

  it('shows a distinct forbidden message on 403 without offering retry or re-sign-in', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(403, { code: 'FORBIDDEN', message: '권한이 없습니다.' })))
    seedAdminSession()

    renderAssignmentDetailPage()

    await waitFor(() =>
      expect(screen.getByRole('alert').textContent).toContain('과제를 조회할 권한이 없습니다.'),
    )
    expect(screen.queryByRole('button', { name: '다시 시도' })).toBeNull()
    expect(screen.queryByRole('button', { name: '다시 로그인' })).toBeNull()
  })

  it('shows an invalid-ID state without calling the API when the route ID is not a positive integer', async () => {
    const fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)
    seedAdminSession()

    renderAssignmentDetailPage('/admin/assignments/abc')

    expect(screen.getByRole('alert').textContent).toContain('잘못된 과제 번호입니다.')
    expect(fetchSpy).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('link', { name: '목록으로 돌아가기' }))
    expect(screen.getByText('Assignment list landing')).toBeDefined()
  })

  it('has an edit action that navigates to the edit route for this assignment', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(200, rawAssignment)))
    seedAdminSession()

    renderAssignmentDetailPage()
    await waitFor(() => expect(screen.getByText('현재완료 시제 연습')).toBeDefined())

    fireEvent.click(screen.getByRole('button', { name: '과제 수정' }))
    expect(screen.getByText('Assignment edit landing')).toBeDefined()
  })

  describe('delete', () => {
    it('requires explicit confirmation before calling the delete API, and cancel does nothing', async () => {
      const fetchSpy = vi.fn().mockResolvedValue(jsonResponse(200, rawAssignment))
      vi.stubGlobal('fetch', fetchSpy)
      seedAdminSession()

      renderAssignmentDetailPage()
      await waitFor(() => expect(screen.getByText('현재완료 시제 연습')).toBeDefined())

      fireEvent.click(screen.getByRole('button', { name: '과제 삭제' }))
      expect(screen.getByText('정말 이 과제를 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.')).toBeDefined()
      expect(fetchSpy).toHaveBeenCalledTimes(1)

      fireEvent.click(screen.getByRole('button', { name: '취소' }))

      expect(screen.queryByText('정말 이 과제를 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.')).toBeNull()
      expect(screen.getByRole('button', { name: '과제 삭제' })).toBeDefined()
      expect(fetchSpy).toHaveBeenCalledTimes(1)
      expect(screen.getByText('현재완료 시제 연습')).toBeDefined()
    })

    it('DELETEs the assignment on confirm and navigates to the list on success', async () => {
      const fetchSpy = vi
        .fn()
        .mockResolvedValueOnce(jsonResponse(200, rawAssignment))
        .mockResolvedValueOnce(new Response(null, { status: 204 }))
      vi.stubGlobal('fetch', fetchSpy)
      seedAdminSession()

      renderAssignmentDetailPage()
      await waitFor(() => expect(screen.getByText('현재완료 시제 연습')).toBeDefined())

      fireEvent.click(screen.getByRole('button', { name: '과제 삭제' }))
      fireEvent.click(screen.getByRole('button', { name: '삭제 확인' }))

      await waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(2))
      const [url, init] = fetchSpy.mock.calls[1]
      expect(url).toBe('/api/assignments/7')
      expect(init.method).toBe('DELETE')
      expect(init.headers.Authorization).toBe('Bearer access-token-abc')

      await waitFor(() => expect(screen.getByText('Assignment list landing')).toBeDefined())
    })

    it('shows a session-expired state on delete 401 without navigating, and returns to /login after re-sign-in', async () => {
      const fetchSpy = vi
        .fn()
        .mockResolvedValueOnce(jsonResponse(200, rawAssignment))
        .mockResolvedValueOnce(jsonResponse(401, { code: 'TOKEN_EXPIRED', message: '세션이 만료되었습니다.' }))
      vi.stubGlobal('fetch', fetchSpy)
      seedAdminSession()

      renderAssignmentDetailPage()
      await waitFor(() => expect(screen.getByText('현재완료 시제 연습')).toBeDefined())

      fireEvent.click(screen.getByRole('button', { name: '과제 삭제' }))
      fireEvent.click(screen.getByRole('button', { name: '삭제 확인' }))

      await waitFor(() =>
        expect(screen.getAllByRole('alert').some((el) => el.textContent?.includes('세션이 만료되었습니다.'))).toBe(
          true,
        ),
      )
      expect(screen.queryByText('Assignment list landing')).toBeNull()

      fireEvent.click(screen.getByRole('button', { name: '다시 로그인' }))
      expect(screen.getByText('Login landing')).toBeDefined()
      expect(sessionStorage.getItem('grmr.auth.session')).toBeNull()
    })

    it('shows a forbidden message on delete 403 without navigating', async () => {
      const fetchSpy = vi
        .fn()
        .mockResolvedValueOnce(jsonResponse(200, rawAssignment))
        .mockResolvedValueOnce(jsonResponse(403, { code: 'FORBIDDEN', message: '권한이 없습니다.' }))
      vi.stubGlobal('fetch', fetchSpy)
      seedAdminSession()

      renderAssignmentDetailPage()
      await waitFor(() => expect(screen.getByText('현재완료 시제 연습')).toBeDefined())

      fireEvent.click(screen.getByRole('button', { name: '과제 삭제' }))
      fireEvent.click(screen.getByRole('button', { name: '삭제 확인' }))

      await waitFor(() =>
        expect(
          screen.getAllByRole('alert').some((el) => el.textContent?.includes('과제를 삭제할 권한이 없습니다.')),
        ).toBe(true),
      )
      expect(screen.queryByText('Assignment list landing')).toBeNull()
    })

    it('shows the backend message on a 409 conflict and does not treat it as a successful delete', async () => {
      const fetchSpy = vi
        .fn()
        .mockResolvedValueOnce(jsonResponse(200, rawAssignment))
        .mockResolvedValueOnce(
          jsonResponse(409, { code: 'ASSIGNMENT_ALREADY_CLOSED', message: '마감된 과제는 삭제할 수 없습니다.' }),
        )
      vi.stubGlobal('fetch', fetchSpy)
      seedAdminSession()

      renderAssignmentDetailPage()
      await waitFor(() => expect(screen.getByText('현재완료 시제 연습')).toBeDefined())

      fireEvent.click(screen.getByRole('button', { name: '과제 삭제' }))
      fireEvent.click(screen.getByRole('button', { name: '삭제 확인' }))

      await waitFor(() =>
        expect(
          screen.getAllByRole('alert').some((el) => el.textContent?.includes('마감된 과제는 삭제할 수 없습니다.')),
        ).toBe(true),
      )
      expect(screen.queryByText('Assignment list landing')).toBeNull()
      expect(screen.getByText('현재완료 시제 연습')).toBeDefined()
    })

    it('shows a generic error and stays on the page on a network failure, allowing retry', async () => {
      const fetchSpy = vi
        .fn()
        .mockResolvedValueOnce(jsonResponse(200, rawAssignment))
        .mockRejectedValueOnce(new TypeError('Failed to fetch'))
        .mockResolvedValueOnce(new Response(null, { status: 204 }))
      vi.stubGlobal('fetch', fetchSpy)
      seedAdminSession()

      renderAssignmentDetailPage()
      await waitFor(() => expect(screen.getByText('현재완료 시제 연습')).toBeDefined())

      fireEvent.click(screen.getByRole('button', { name: '과제 삭제' }))
      fireEvent.click(screen.getByRole('button', { name: '삭제 확인' }))

      await waitFor(() =>
        expect(
          screen
            .getAllByRole('alert')
            .some((el) => el.textContent?.includes('네트워크 오류가 발생했습니다. 연결 상태를 확인해주세요.')),
        ).toBe(true),
      )
      expect(screen.queryByText('Assignment list landing')).toBeNull()

      fireEvent.click(screen.getByRole('button', { name: '삭제 확인' }))
      await waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(3))
      await waitFor(() => expect(screen.getByText('Assignment list landing')).toBeDefined())
    })
  })
})
