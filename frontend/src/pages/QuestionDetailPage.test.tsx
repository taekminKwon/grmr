import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AuthProvider } from '../auth/AuthContext'
import QuestionDetailPage from './QuestionDetailPage'

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

function renderQuestionDetailPage(initialEntry = '/admin/questions/1024') {
  render(
    <AuthProvider>
      <MemoryRouter initialEntries={[initialEntry]}>
        <Routes>
          <Route path="/admin/questions/:id" element={<QuestionDetailPage />} />
          <Route path="/admin/questions" element={<div>Question list landing</div>} />
          <Route path="/login" element={<div>Login landing</div>} />
        </Routes>
      </MemoryRouter>
    </AuthProvider>,
  )
}

const rawQuestion = {
  id: 1024,
  category: '현재완료',
  type: '객관식',
  level: '보통',
  status: '사용 중',
  text: 'He has lived here _____ 2010.',
  choices: ['for', 'since', 'during', 'from'],
  answer: 'since',
  explanation: '특정 시작 시점과 현재완료가 함께 쓰일 때 since를 사용합니다.',
  createdAt: '2026-07-20T10:15:00',
}

describe('QuestionDetailPage', () => {
  it('fetches the question on mount using the session access token and renders full detail', async () => {
    const fetchSpy = vi.fn().mockResolvedValue(jsonResponse(200, rawQuestion))
    vi.stubGlobal('fetch', fetchSpy)
    seedAdminSession()

    renderQuestionDetailPage()

    await waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(1))
    const [url, init] = fetchSpy.mock.calls[0]
    expect(url).toBe('/api/questions/1024')
    expect(init.headers.Authorization).toBe('Bearer access-token-abc')

    await waitFor(() => expect(screen.getByText('He has lived here _____ 2010.')).toBeDefined())
    expect(screen.getByText('현재완료')).toBeDefined()
    expect(screen.getByText('객관식')).toBeDefined()
    expect(screen.getByText('보통')).toBeDefined()
    expect(screen.getByText('사용 중')).toBeDefined()
    expect(screen.getByText('1024')).toBeDefined()
    expect(screen.getByText('2026-07-20T10:15:00')).toBeDefined()
    expect(screen.getByText('특정 시작 시점과 현재완료가 함께 쓰일 때 since를 사용합니다.')).toBeDefined()

    for (const choice of rawQuestion.choices) {
      expect(screen.getByText(choice)).toBeDefined()
    }

    const answerChoice = screen.getByText('since').closest('li')
    expect(answerChoice?.textContent).toContain('정답')
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

    renderQuestionDetailPage()

    expect(screen.getByRole('status').textContent).toBe('불러오는 중...')

    resolveFetch(jsonResponse(200, rawQuestion))
    await waitFor(() => expect(screen.queryByRole('status')).toBeNull())
  })

  it('shows a not-found state on 404 with a link back to the list', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(jsonResponse(404, { code: 'QUESTION_NOT_FOUND', message: '문제를 찾을 수 없습니다.' })),
    )
    seedAdminSession()

    renderQuestionDetailPage()

    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('문제를 찾을 수 없습니다.'))
    expect(screen.queryByRole('button', { name: '다시 시도' })).toBeNull()
    expect(screen.queryByRole('button', { name: '다시 로그인' })).toBeNull()

    fireEvent.click(screen.getByRole('link', { name: '목록으로 돌아가기' }))
    expect(screen.getByText('Question list landing')).toBeDefined()
  })

  it('shows a recoverable error and retries the same request on click', async () => {
    const fetchSpy = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(500, { code: 'INTERNAL_ERROR', message: '서버 오류가 발생했습니다.' }))
      .mockResolvedValueOnce(jsonResponse(200, rawQuestion))
    vi.stubGlobal('fetch', fetchSpy)
    seedAdminSession()

    renderQuestionDetailPage()

    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('서버 오류가 발생했습니다.'))
    fireEvent.click(screen.getByRole('button', { name: '다시 시도' }))

    await waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(2))
    await waitFor(() => expect(screen.getByText('He has lived here _____ 2010.')).toBeDefined())
  })

  it('shows a session-expired state on 401 and returns to /login after re-sign-in', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(jsonResponse(401, { code: 'TOKEN_EXPIRED', message: '세션이 만료되었습니다.' })),
    )
    seedAdminSession()

    renderQuestionDetailPage()

    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('세션이 만료되었습니다.'))
    fireEvent.click(screen.getByRole('button', { name: '다시 로그인' }))

    expect(screen.getByText('Login landing')).toBeDefined()
    expect(sessionStorage.getItem('grmr.auth.session')).toBeNull()
  })

  it('shows a distinct forbidden message on 403 without offering retry or re-sign-in', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(403, { code: 'FORBIDDEN', message: '권한이 없습니다.' })))
    seedAdminSession()

    renderQuestionDetailPage()

    await waitFor(() =>
      expect(screen.getByRole('alert').textContent).toContain('문제를 조회할 권한이 없습니다.'),
    )
    expect(screen.queryByRole('button', { name: '다시 시도' })).toBeNull()
    expect(screen.queryByRole('button', { name: '다시 로그인' })).toBeNull()
  })

  it('shows an invalid-ID state without calling the API when the route ID is not a positive integer', async () => {
    const fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)
    seedAdminSession()

    renderQuestionDetailPage('/admin/questions/abc')

    expect(screen.getByRole('alert').textContent).toContain('잘못된 문제 번호입니다.')
    expect(fetchSpy).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('link', { name: '목록으로 돌아가기' }))
    expect(screen.getByText('Question list landing')).toBeDefined()
  })
})
