import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AuthProvider } from '../auth/AuthContext'
import StudentHistoryListPage from './StudentHistoryListPage'

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

function renderHistoryListPage(initialEntries: string[] = ['/student/history']) {
  render(
    <AuthProvider>
      <MemoryRouter initialEntries={initialEntries}>
        <Routes>
          <Route path="/student/history" element={<StudentHistoryListPage />} />
          <Route path="/student/history/:id" element={<div>History detail landing</div>} />
          <Route path="/login" element={<div>Login landing</div>} />
        </Routes>
      </MemoryRouter>
    </AuthProvider>,
  )
}

const rawRecord = {
  id: 501,
  questionId: 1021,
  type: 'PRACTICE',
  category: '가정법',
  level: '심화',
  correct: true,
  submittedAt: '2026-08-13T10:15:00',
  text: 'If I _____ you, I would study harder.',
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

describe('StudentHistoryListPage', () => {
  it('fetches history records on mount using the session access token and renders the list', async () => {
    const fetchSpy = vi.fn().mockResolvedValue(jsonResponse(200, pageResponse([rawRecord])))
    vi.stubGlobal('fetch', fetchSpy)
    seedStudentSession()

    renderHistoryListPage()

    await waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(1))
    const [url, init] = fetchSpy.mock.calls[0]
    expect(url).toBe('/api/me/practice/records?page=0&size=20')
    expect(init.headers.Authorization).toBe('Bearer access-token-abc')

    await waitFor(() => expect(screen.getByRole('table')).toBeDefined())
    const row = within(screen.getByRole('table'))
    expect(row.getByText('가정법')).toBeDefined()
    expect(row.getByText('심화')).toBeDefined()
    expect(row.getByText('정답')).toBeDefined()
    expect(row.getByText('2026년 8월 13일 10:15')).toBeDefined()
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

    renderHistoryListPage()

    expect(screen.getByRole('status').textContent).toBe('불러오는 중...')

    resolveFetch(jsonResponse(200, pageResponse([])))
    await waitFor(() => expect(screen.queryByRole('status')).toBeNull())
  })

  it('shows an empty state when there are no history records', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(200, pageResponse([]))))
    seedStudentSession()

    renderHistoryListPage()

    await waitFor(() => expect(screen.getByText('학습 기록이 없습니다.')).toBeDefined())
  })

  it('applies the category filter, sending it through untranslated and resetting to page 0', async () => {
    const fetchSpy = vi.fn().mockResolvedValue(jsonResponse(200, pageResponse([rawRecord])))
    vi.stubGlobal('fetch', fetchSpy)
    seedStudentSession()

    renderHistoryListPage()
    await waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(1))

    fireEvent.change(screen.getByLabelText('카테고리'), { target: { value: '가정법' } })
    fireEvent.click(screen.getByRole('button', { name: '검색' }))

    await waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(2))
    const [url] = fetchSpy.mock.calls[1]
    expect(url).toBe(`/api/me/practice/records?category=${encodeURIComponent('가정법')}&page=0&size=20`)
  })

  it('clears the filter and refetches from page 0 on reset', async () => {
    const fetchSpy = vi.fn().mockResolvedValue(jsonResponse(200, pageResponse([rawRecord])))
    vi.stubGlobal('fetch', fetchSpy)
    seedStudentSession()

    renderHistoryListPage()
    await waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(1))

    fireEvent.change(screen.getByLabelText('카테고리'), { target: { value: '가정법' } })
    fireEvent.click(screen.getByRole('button', { name: '검색' }))
    await waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(2))

    fireEvent.click(screen.getByRole('button', { name: '초기화' }))
    await waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(3))

    const [url] = fetchSpy.mock.calls[2]
    expect(url).toBe('/api/me/practice/records?page=0&size=20')
    expect((screen.getByLabelText('카테고리') as HTMLInputElement).value).toBe('')
  })

  it('paginates using backend page metadata, disabling controls at the bounds', async () => {
    const fetchSpy = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(200, pageResponse([rawRecord], { page: 0, totalPages: 2, totalElements: 21 })))
      .mockResolvedValueOnce(
        jsonResponse(200, pageResponse([{ ...rawRecord, id: 502, category: '현재완료' }], {
          page: 1,
          totalPages: 2,
          totalElements: 21,
        })),
      )
    vi.stubGlobal('fetch', fetchSpy)
    seedStudentSession()

    renderHistoryListPage()
    await waitFor(() => expect(screen.getByText('가정법')).toBeDefined())

    const prevButton = screen.getByRole('button', { name: '이전' })
    const nextButton = screen.getByRole('button', { name: '다음' })
    expect((prevButton as HTMLButtonElement).disabled).toBe(true)
    expect((nextButton as HTMLButtonElement).disabled).toBe(false)
    expect(screen.getByText('1 / 2 페이지 · 총 21건')).toBeDefined()

    fireEvent.click(nextButton)

    await waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(2))
    const [url] = fetchSpy.mock.calls[1]
    expect(url).toBe('/api/me/practice/records?page=1&size=20')

    await waitFor(() => expect(screen.getByText('현재완료')).toBeDefined())
    expect((screen.getByRole('button', { name: '이전' }) as HTMLButtonElement).disabled).toBe(false)
    expect((screen.getByRole('button', { name: '다음' }) as HTMLButtonElement).disabled).toBe(true)
  })

  it('shows a recoverable error and retries the same request on click', async () => {
    const fetchSpy = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(500, { code: 'INTERNAL_ERROR', message: '서버 오류가 발생했습니다.' }))
      .mockResolvedValueOnce(jsonResponse(200, pageResponse([rawRecord])))
    vi.stubGlobal('fetch', fetchSpy)
    seedStudentSession()

    renderHistoryListPage()

    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('서버 오류가 발생했습니다.'))
    expect(screen.getByRole('button', { name: '다시 시도' })).toBeDefined()

    fireEvent.click(screen.getByRole('button', { name: '다시 시도' }))

    await waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(2))
    await waitFor(() => expect(screen.getByText('가정법')).toBeDefined())
  })

  it('shows a session-expired state on 401 and returns to /login after re-sign-in', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(jsonResponse(401, { code: 'TOKEN_EXPIRED', message: '세션이 만료되었습니다.' })),
    )
    seedStudentSession()

    renderHistoryListPage()

    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('세션이 만료되었습니다.'))
    fireEvent.click(screen.getByRole('button', { name: '다시 로그인' }))

    expect(screen.getByText('Login landing')).toBeDefined()
    expect(sessionStorage.getItem('grmr.auth.session')).toBeNull()
  })

  it('shows a distinct forbidden message on 403 without offering retry or re-sign-in', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(403, { code: 'FORBIDDEN', message: '권한이 없습니다.' })))
    seedStudentSession()

    renderHistoryListPage()

    await waitFor(() =>
      expect(screen.getByRole('alert').textContent).toContain('학습 기록을 조회할 권한이 없습니다.'),
    )
    expect(screen.queryByRole('button', { name: '다시 시도' })).toBeNull()
    expect(screen.queryByRole('button', { name: '다시 로그인' })).toBeNull()
  })

  it('links each row to its detail page via the problem-text link, with no separate 상세 column', async () => {
    const fetchSpy = vi.fn().mockResolvedValue(jsonResponse(200, pageResponse([rawRecord])))
    vi.stubGlobal('fetch', fetchSpy)
    seedStudentSession()

    renderHistoryListPage()
    await waitFor(() => expect(screen.getByText('가정법')).toBeDefined())

    expect(screen.queryByText('상세보기')).toBeNull()
    expect(screen.queryByRole('columnheader', { name: '상세' })).toBeNull()

    const detailLink = screen.getByRole('link', { name: 'If I _____ you, I would study harder.' })
    expect(detailLink.getAttribute('href')).toBe('/student/history/501')

    fireEvent.click(detailLink)
    expect(screen.getByText('History detail landing')).toBeDefined()
  })
})
