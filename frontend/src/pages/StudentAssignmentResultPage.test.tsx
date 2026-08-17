import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AuthProvider } from '../auth/AuthContext'
import StudentAssignmentResultPage from './StudentAssignmentResultPage'

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

type InitialEntry = string | { pathname: string; state?: unknown }

function renderResultPage(initialEntry: InitialEntry = '/student/assignments/1/result') {
  render(
    <AuthProvider>
      <MemoryRouter initialEntries={[initialEntry]}>
        <Routes>
          <Route path="/student/assignments/:id/result" element={<StudentAssignmentResultPage />} />
          <Route path="/student/assignments/:id" element={<div>Solve landing</div>} />
          <Route path="/student/assignments" element={<div>Assignment list landing</div>} />
          <Route path="/login" element={<div>Login landing</div>} />
        </Routes>
      </MemoryRouter>
    </AuthProvider>,
  )
}

const rawResult = {
  assignmentId: 1,
  submissionStatus: 'SUBMITTED',
  submittedAt: '2026-08-15T10:00:00',
  totalQuestions: 3,
  answeredQuestions: 2,
  correctCount: 1,
  score: 33,
  results: [
    { questionId: 1024, submittedAnswer: 'since', correct: true, correctAnswer: 'since', explanation: '해설-1024' },
    { questionId: 1023, submittedAnswer: 'for', correct: false, correctAnswer: 'since', explanation: '해설-1023' },
    { questionId: 1021, submittedAnswer: null, correct: false, correctAnswer: 'were', explanation: '해설-1021' },
  ],
}

describe('StudentAssignmentResultPage', () => {
  it('fetches the result on mount using the session access token and renders the full snapshot in assignment order', async () => {
    const fetchSpy = vi.fn().mockResolvedValue(jsonResponse(200, rawResult))
    vi.stubGlobal('fetch', fetchSpy)
    seedStudentSession()

    renderResultPage()

    await waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(1))
    const [url, init] = fetchSpy.mock.calls[0]
    expect(url).toBe('/api/me/assignments/1/result')
    expect(init.headers.Authorization).toBe('Bearer access-token-abc')

    await waitFor(() => expect(screen.getByText('2026년 8월 15일 10:00')).toBeDefined())
    expect(screen.getByText('33점')).toBeDefined()
    expect(screen.getByText('1 / 3')).toBeDefined()
    expect(screen.getByText('2 / 1')).toBeDefined()

    const list = within(screen.getByRole('list', { name: '문항별 결과' }))
    const items = list.getAllByRole('listitem')
    expect(items).toHaveLength(3)

    expect(items[0].textContent).toContain('1번')
    expect(items[0].textContent).toContain('정답')
    expect(items[0].textContent).toContain('since')

    expect(items[1].textContent).toContain('2번')
    expect(items[1].textContent).toContain('오답')
    expect(items[1].textContent).toContain('for')
    expect(items[1].textContent).toContain('해설-1023')

    expect(items[2].textContent).toContain('3번')
    expect(items[2].textContent).toContain('미응답')
    expect(items[2].textContent).toContain('제출한 답안 없음')
    expect(items[2].textContent).toContain('were')
  })

  it('shows a loading indicator on a direct URL visit with no navigation state, then renders the fetched result', async () => {
    let resolveFetch: (value: Response) => void = () => {}
    const fetchSpy = vi.fn(
      () =>
        new Promise<Response>((resolve) => {
          resolveFetch = resolve
        }),
    )
    vi.stubGlobal('fetch', fetchSpy)
    seedStudentSession()

    renderResultPage('/student/assignments/1/result')

    expect(screen.getByRole('status').textContent).toBe('불러오는 중...')
    expect(screen.queryByText('33점')).toBeNull()

    resolveFetch(jsonResponse(200, rawResult))
    await waitFor(() => expect(screen.queryByRole('status')).toBeNull())
    expect(screen.getByText('33점')).toBeDefined()
  })

  it('shows the navigation-state hint immediately, then replaces it with the server value once the fetch resolves (state never overrides the server)', async () => {
    let resolveFetch: (value: Response) => void = () => {}
    const fetchSpy = vi.fn(
      () =>
        new Promise<Response>((resolve) => {
          resolveFetch = resolve
        }),
    )
    vi.stubGlobal('fetch', fetchSpy)
    seedStudentSession()

    const hint = { ...rawResult, score: 100, correctCount: 3, results: rawResult.results.map((r) => ({ ...r, correct: true })) }

    renderResultPage({ pathname: '/student/assignments/1/result', state: { result: hint } })

    // Hint renders immediately without waiting on the network.
    expect(screen.getByText('100점')).toBeDefined()
    expect(screen.queryByRole('status')).toBeNull()

    resolveFetch(jsonResponse(200, rawResult))

    await waitFor(() => expect(screen.getByText('33점')).toBeDefined())
    expect(screen.queryByText('100점')).toBeNull()
  })

  it('ignores a navigation-state hint for a different assignment id', async () => {
    const fetchSpy = vi.fn().mockResolvedValue(jsonResponse(200, rawResult))
    vi.stubGlobal('fetch', fetchSpy)
    seedStudentSession()

    const hintForOtherAssignment = { ...rawResult, assignmentId: 999, score: 100 }

    renderResultPage({ pathname: '/student/assignments/1/result', state: { result: hintForOtherAssignment } })

    expect(screen.queryByText('100점')).toBeNull()
    expect(screen.getByRole('status').textContent).toBe('불러오는 중...')

    await waitFor(() => expect(screen.getByText('33점')).toBeDefined())
  })

  it('never leaks grading fields on 409 ASSIGNMENT_NOT_SUBMITTED, even when a forged navigation-state hint is present', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        jsonResponse(409, { code: 'ASSIGNMENT_NOT_SUBMITTED', message: '아직 제출하지 않은 과제입니다.' }),
      ),
    )
    seedStudentSession()

    const forgedHint = { ...rawResult, score: 100 }

    renderResultPage({ pathname: '/student/assignments/1/result', state: { result: forgedHint } })

    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('아직 제출하지 않은 과제입니다.'))
    expect(screen.queryByText('100점')).toBeNull()
    expect(screen.queryByText('33점')).toBeNull()
    expect(screen.queryByRole('list', { name: '문항별 결과' })).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: '과제 풀러 가기' }))
    expect(screen.getByText('Solve landing')).toBeDefined()
  })

  it('renders the exact same snapshot across repeated reloads (no client-side regrading)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(200, rawResult)))
    seedStudentSession()

    renderResultPage()
    await waitFor(() => expect(screen.getByText('33점')).toBeDefined())
    const firstRenderText = screen.getByRole('list', { name: '문항별 결과' }).textContent

    cleanup()
    sessionStorage.clear()

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(200, rawResult)))
    seedStudentSession()

    renderResultPage()
    await waitFor(() => expect(screen.getByText('33점')).toBeDefined())
    const secondRenderText = screen.getByRole('list', { name: '문항별 결과' }).textContent

    expect(secondRenderText).toBe(firstRenderText)
  })

  it('shows a recoverable error and retries the same request on click', async () => {
    const fetchSpy = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(500, { code: 'INTERNAL_ERROR', message: '서버 오류가 발생했습니다.' }))
      .mockResolvedValueOnce(jsonResponse(200, rawResult))
    vi.stubGlobal('fetch', fetchSpy)
    seedStudentSession()

    renderResultPage()

    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('서버 오류가 발생했습니다.'))
    fireEvent.click(screen.getByRole('button', { name: '다시 시도' }))

    await waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(2))
    await waitFor(() => expect(screen.getByText('33점')).toBeDefined())
  })

  it('shows a session-expired state on 401 and returns to /login after re-sign-in', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(jsonResponse(401, { code: 'TOKEN_EXPIRED', message: '세션이 만료되었습니다.' })),
    )
    seedStudentSession()

    renderResultPage()

    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('세션이 만료되었습니다.'))
    fireEvent.click(screen.getByRole('button', { name: '다시 로그인' }))

    expect(screen.getByText('Login landing')).toBeDefined()
    expect(sessionStorage.getItem('grmr.auth.session')).toBeNull()
  })

  it('shows a distinct forbidden message on 403 without offering retry or re-sign-in', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(403, { code: 'FORBIDDEN', message: '권한이 없습니다.' })))
    seedStudentSession()

    renderResultPage()

    await waitFor(() =>
      expect(screen.getByRole('alert').textContent).toContain('결과를 조회할 권한이 없습니다.'),
    )
    expect(screen.queryByRole('button', { name: '다시 시도' })).toBeNull()
    expect(screen.queryByRole('button', { name: '다시 로그인' })).toBeNull()
  })

  it('shows a not-found state on 404', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(jsonResponse(404, { code: 'ASSIGNMENT_NOT_FOUND', message: '과제를 찾을 수 없습니다.' })),
    )
    seedStudentSession()

    renderResultPage()

    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('과제를 찾을 수 없습니다.'))
    expect(screen.queryByRole('button', { name: '다시 시도' })).toBeNull()
    expect(screen.queryByRole('button', { name: '다시 로그인' })).toBeNull()
  })

  it('shows a not-submitted state on 409 ASSIGNMENT_NOT_SUBMITTED with a link to continue solving', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        jsonResponse(409, { code: 'ASSIGNMENT_NOT_SUBMITTED', message: '아직 제출하지 않은 과제입니다.' }),
      ),
    )
    seedStudentSession()

    renderResultPage()

    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('아직 제출하지 않은 과제입니다.'))
    fireEvent.click(screen.getByRole('button', { name: '과제 풀러 가기' }))
    expect(screen.getByText('Solve landing')).toBeDefined()
  })

  it('shows an invalid-ID state without calling the API when the route ID is not a positive integer', async () => {
    const fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)
    seedStudentSession()

    renderResultPage('/student/assignments/abc/result')

    expect(screen.getByRole('alert').textContent).toContain('잘못된 과제 번호입니다.')
    expect(fetchSpy).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('link', { name: '내 과제로 돌아가기' }))
    expect(screen.getByText('Assignment list landing')).toBeDefined()
  })

  it('provides links back to the assignment list and to the submitted read-only question view', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(200, rawResult)))
    seedStudentSession()

    renderResultPage()
    await waitFor(() => expect(screen.getByText('33점')).toBeDefined())

    fireEvent.click(screen.getByRole('link', { name: '제출한 문제 보기' }))
    expect(screen.getByText('Solve landing')).toBeDefined()
  })
})
