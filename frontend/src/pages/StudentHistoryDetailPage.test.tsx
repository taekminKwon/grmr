import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AuthProvider } from '../auth/AuthContext'
import StudentHistoryDetailPage from './StudentHistoryDetailPage'

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

function renderHistoryDetailPage(initialEntry = '/student/history/501') {
  render(
    <AuthProvider>
      <MemoryRouter initialEntries={[initialEntry]}>
        <Routes>
          <Route path="/student/history/:id" element={<StudentHistoryDetailPage />} />
          <Route path="/student/history" element={<div>History list landing</div>} />
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
  question: {
    category: '가정법',
    level: '심화',
    text: 'If I _____ you, I would study harder.',
    choices: ['am', 'was', 'were', 'be'],
    correctAnswer: 'were',
    explanation: '가정법 과거에서는 주어의 인칭에 관계없이 be동사로 were를 씁니다.',
  },
  submittedAnswer: 'am',
  correct: false,
  submittedAt: '2026-08-13T10:15:00',
}

describe('StudentHistoryDetailPage', () => {
  it('fetches the record on mount using the session access token and renders the full snapshot', async () => {
    const fetchSpy = vi.fn().mockResolvedValue(jsonResponse(200, rawRecord))
    vi.stubGlobal('fetch', fetchSpy)
    seedStudentSession()

    renderHistoryDetailPage()

    await waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(1))
    const [url, init] = fetchSpy.mock.calls[0]
    expect(url).toBe('/api/me/practice/records/501')
    expect(init.headers.Authorization).toBe('Bearer access-token-abc')

    await waitFor(() => expect(screen.getByText('If I _____ you, I would study harder.')).toBeDefined())
    expect(screen.getByText('가정법')).toBeDefined()
    expect(screen.getByText('심화')).toBeDefined()
    expect(screen.getByText('오답')).toBeDefined()
    expect(screen.getByText('2026년 8월 13일 10:15')).toBeDefined()
    expect(screen.getByText('가정법 과거에서는 주어의 인칭에 관계없이 be동사로 were를 씁니다.')).toBeDefined()

    const choiceList = within(screen.getByRole('list', { name: '보기' }))
    for (const choice of rawRecord.question.choices) {
      expect(choiceList.getByText(choice)).toBeDefined()
    }

    // Submitted answer ('am') is wrong: it should be marked distinctly from the correct answer ('were').
    const submittedChoice = choiceList.getByText('am').closest('li')
    expect(submittedChoice?.textContent).toContain('내 답안')
    expect(submittedChoice?.textContent).not.toContain('정답')

    const correctChoice = choiceList.getByText('were').closest('li')
    expect(correctChoice?.textContent).toContain('정답')
    expect(correctChoice?.textContent).not.toContain('내 답안')
  })

  it('marks a single choice with both badges when the submitted answer was correct', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(jsonResponse(200, { ...rawRecord, submittedAnswer: 'were', correct: true })),
    )
    seedStudentSession()

    renderHistoryDetailPage()

    await waitFor(() => expect(screen.getByRole('list', { name: '보기' })).toBeDefined())
    const choiceList = within(screen.getByRole('list', { name: '보기' }))
    const correctChoice = choiceList.getByText('were').closest('li')
    expect(correctChoice?.textContent).toContain('정답')
    expect(correctChoice?.textContent).toContain('내 답안')
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

    renderHistoryDetailPage()

    expect(screen.getByRole('status').textContent).toBe('불러오는 중...')

    resolveFetch(jsonResponse(200, rawRecord))
    await waitFor(() => expect(screen.queryByRole('status')).toBeNull())
  })

  it('shows a not-found state on 404 with a link back to the list', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(jsonResponse(404, { code: 'STUDY_RECORD_NOT_FOUND', message: '학습 기록을 찾을 수 없습니다.' })),
    )
    seedStudentSession()

    renderHistoryDetailPage()

    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('학습 기록을 찾을 수 없습니다.'))
    expect(screen.queryByRole('button', { name: '다시 시도' })).toBeNull()
    expect(screen.queryByRole('button', { name: '다시 로그인' })).toBeNull()

    fireEvent.click(screen.getByRole('link', { name: '목록으로 돌아가기' }))
    expect(screen.getByText('History list landing')).toBeDefined()
  })

  it('shows a recoverable error and retries the same request on click', async () => {
    const fetchSpy = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(500, { code: 'INTERNAL_ERROR', message: '서버 오류가 발생했습니다.' }))
      .mockResolvedValueOnce(jsonResponse(200, rawRecord))
    vi.stubGlobal('fetch', fetchSpy)
    seedStudentSession()

    renderHistoryDetailPage()

    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('서버 오류가 발생했습니다.'))
    fireEvent.click(screen.getByRole('button', { name: '다시 시도' }))

    await waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(2))
    await waitFor(() => expect(screen.getByText('If I _____ you, I would study harder.')).toBeDefined())
  })

  it('shows a session-expired state on 401 and returns to /login after re-sign-in', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(jsonResponse(401, { code: 'TOKEN_EXPIRED', message: '세션이 만료되었습니다.' })),
    )
    seedStudentSession()

    renderHistoryDetailPage()

    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('세션이 만료되었습니다.'))
    fireEvent.click(screen.getByRole('button', { name: '다시 로그인' }))

    expect(screen.getByText('Login landing')).toBeDefined()
    expect(sessionStorage.getItem('grmr.auth.session')).toBeNull()
  })

  it('shows a distinct forbidden message on 403 without offering retry or re-sign-in', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(403, { code: 'FORBIDDEN', message: '권한이 없습니다.' })))
    seedStudentSession()

    renderHistoryDetailPage()

    await waitFor(() =>
      expect(screen.getByRole('alert').textContent).toContain('학습 기록을 조회할 권한이 없습니다.'),
    )
    expect(screen.queryByRole('button', { name: '다시 시도' })).toBeNull()
    expect(screen.queryByRole('button', { name: '다시 로그인' })).toBeNull()
  })

  it('shows an invalid-ID state without calling the API when the route ID is not a positive integer', async () => {
    const fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)
    seedStudentSession()

    renderHistoryDetailPage('/student/history/abc')

    expect(screen.getByRole('alert').textContent).toContain('잘못된 학습 기록 번호입니다.')
    expect(fetchSpy).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('link', { name: '목록으로 돌아가기' }))
    expect(screen.getByText('History list landing')).toBeDefined()
  })
})
