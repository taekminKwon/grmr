import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AuthProvider } from '../auth/AuthContext'
import StudentPracticePage from './StudentPracticePage'

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

function renderPracticePage() {
  render(
    <AuthProvider>
      <MemoryRouter initialEntries={['/student/practice']}>
        <Routes>
          <Route path="/student/practice" element={<StudentPracticePage />} />
          <Route path="/login" element={<div>Login landing</div>} />
        </Routes>
      </MemoryRouter>
    </AuthProvider>,
  )
}

function deliveredQuestionResponse(overrides: Partial<Record<string, unknown>> = {}): Response {
  return jsonResponse(200, {
    id: 2001,
    category: '현재완료',
    type: '객관식',
    level: '보통',
    text: 'He has lived here _____ 2010.',
    choices: ['for', 'since', 'during', 'from'],
    ...overrides,
  })
}

function gradedResponse(overrides: Partial<Record<string, unknown>> = {}): Response {
  return jsonResponse(201, {
    id: 501,
    questionId: 2001,
    correct: true,
    submittedAnswer: 'since',
    correctAnswer: 'since',
    explanation: '특정 시작 시점과 현재완료가 함께 쓰일 때 since를 사용합니다.',
    submittedAt: '2026-08-13T10:15:00',
    ...overrides,
  })
}

describe('StudentPracticePage', () => {
  it('fetches and renders a question on mount without leaking the answer or explanation before submission', async () => {
    const fetchSpy = vi.fn().mockResolvedValue(deliveredQuestionResponse())
    vi.stubGlobal('fetch', fetchSpy)
    seedStudentSession()

    renderPracticePage()

    expect(screen.getByRole('status').textContent).toBe('불러오는 중...')

    await waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(1))
    const [url, init] = fetchSpy.mock.calls[0]
    expect(url).toBe('/api/me/practice/questions/next')
    expect(init.headers.Authorization).toBe('Bearer access-token-abc')

    await waitFor(() => expect(screen.getByText('He has lived here _____ 2010.')).toBeDefined())
    for (const choice of ['for', 'since', 'during', 'from']) {
      expect(screen.getByLabelText(choice)).toBeDefined()
    }
    expect(screen.queryByText(/특정 시작 시점/)).toBeNull()
    expect(screen.queryByText('정답입니다!')).toBeNull()
    expect(screen.queryByText('오답입니다.')).toBeNull()
  })

  it('applies category and level filters, translating the level to its Korean label in the request', async () => {
    const fetchSpy = vi.fn().mockResolvedValue(deliveredQuestionResponse())
    vi.stubGlobal('fetch', fetchSpy)
    seedStudentSession()

    renderPracticePage()
    await waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(1))

    fireEvent.change(screen.getByLabelText('카테고리'), { target: { value: '현재완료' } })
    fireEvent.change(screen.getByLabelText('난이도'), { target: { value: 'BASIC' } })
    fireEvent.click(screen.getByRole('button', { name: '문제 불러오기' }))

    await waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(2))
    const [url] = fetchSpy.mock.calls[1]
    expect(url).toBe(
      '/api/me/practice/questions/next?category=%ED%98%84%EC%9E%AC%EC%99%84%EB%A3%8C&level=%EA%B8%B0%EC%B4%88',
    )
  })

  it('allows selecting exactly one choice at a time', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(deliveredQuestionResponse()))
    seedStudentSession()

    renderPracticePage()
    await waitFor(() => expect(screen.getByText('He has lived here _____ 2010.')).toBeDefined())

    const forChoice = screen.getByLabelText('for') as HTMLInputElement
    const sinceChoice = screen.getByLabelText('since') as HTMLInputElement

    fireEvent.click(forChoice)
    expect(forChoice.checked).toBe(true)

    fireEvent.click(sinceChoice)
    expect(sinceChoice.checked).toBe(true)
    expect(forChoice.checked).toBe(false)
  })

  it('requires a choice before allowing submission', async () => {
    const fetchSpy = vi.fn().mockResolvedValue(deliveredQuestionResponse())
    vi.stubGlobal('fetch', fetchSpy)
    seedStudentSession()

    renderPracticePage()
    await waitFor(() => expect(screen.getByText('He has lived here _____ 2010.')).toBeDefined())

    fireEvent.click(screen.getByRole('button', { name: '제출하기' }))

    expect(screen.getByText('보기를 선택하세요.')).toBeDefined()
    expect(fetchSpy).toHaveBeenCalledTimes(1)
  })

  it('submits the selected choice and renders a correct result with the submitted/correct answer and explanation', async () => {
    const fetchSpy = vi.fn().mockResolvedValueOnce(deliveredQuestionResponse()).mockResolvedValueOnce(gradedResponse())
    vi.stubGlobal('fetch', fetchSpy)
    seedStudentSession()

    renderPracticePage()
    await waitFor(() => expect(screen.getByText('He has lived here _____ 2010.')).toBeDefined())

    fireEvent.click(screen.getByLabelText('since'))
    fireEvent.click(screen.getByRole('button', { name: '제출하기' }))

    await waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(2))
    const [url, init] = fetchSpy.mock.calls[1]
    expect(url).toBe('/api/me/practice/answers')
    expect(init.method).toBe('POST')
    expect(JSON.parse(init.body)).toEqual({ questionId: 2001, submittedAnswer: 'since' })

    await waitFor(() => expect(screen.getByRole('status').textContent).toContain('정답입니다!'))
    expect(screen.getByRole('status').textContent).toContain('since')
    expect(screen.getByRole('status').textContent).toContain(
      '특정 시작 시점과 현재완료가 함께 쓰일 때 since를 사용합니다.',
    )
    expect(screen.queryByRole('radio')).toBeNull()
  })

  it('submits an incorrect choice and renders the incorrect result with the correct answer for learning', async () => {
    const fetchSpy = vi
      .fn()
      .mockResolvedValueOnce(deliveredQuestionResponse())
      .mockResolvedValueOnce(gradedResponse({ correct: false, submittedAnswer: 'for' }))
    vi.stubGlobal('fetch', fetchSpy)
    seedStudentSession()

    renderPracticePage()
    await waitFor(() => expect(screen.getByText('He has lived here _____ 2010.')).toBeDefined())

    fireEvent.click(screen.getByLabelText('for'))
    fireEvent.click(screen.getByRole('button', { name: '제출하기' }))

    await waitFor(() => expect(screen.getByRole('status').textContent).toContain('오답입니다.'))
    expect(screen.getByRole('status').textContent).toContain('for')
    expect(screen.getByRole('status').textContent).toContain('since')
  })

  it('provides a next-question action after a result that fetches and shows a new question', async () => {
    const fetchSpy = vi
      .fn()
      .mockResolvedValueOnce(deliveredQuestionResponse())
      .mockResolvedValueOnce(gradedResponse())
      .mockResolvedValueOnce(
        deliveredQuestionResponse({
          id: 2002,
          category: '수동태',
          text: 'The window _____ by the wind last night.',
          choices: ['broke', 'was broken', 'has broken', 'is breaking'],
        }),
      )
    vi.stubGlobal('fetch', fetchSpy)
    seedStudentSession()

    renderPracticePage()
    await waitFor(() => expect(screen.getByText('He has lived here _____ 2010.')).toBeDefined())

    fireEvent.click(screen.getByLabelText('since'))
    fireEvent.click(screen.getByRole('button', { name: '제출하기' }))
    await waitFor(() => expect(screen.getByRole('status').textContent).toContain('정답입니다!'))

    fireEvent.click(screen.getByRole('button', { name: '다음 문제' }))

    await waitFor(() => expect(screen.getByText('The window _____ by the wind last night.')).toBeDefined())
    expect(screen.queryByText('정답입니다!')).toBeNull()
    expect(fetchSpy).toHaveBeenCalledTimes(3)
  })

  it('guards against double submit while a request is in flight', async () => {
    let resolveSubmit: (value: Response) => void = () => {}
    const fetchSpy = vi
      .fn()
      .mockResolvedValueOnce(deliveredQuestionResponse())
      .mockImplementationOnce(
        () =>
          new Promise<Response>((resolve) => {
            resolveSubmit = resolve
          }),
      )
    vi.stubGlobal('fetch', fetchSpy)
    seedStudentSession()

    renderPracticePage()
    await waitFor(() => expect(screen.getByText('He has lived here _____ 2010.')).toBeDefined())

    fireEvent.click(screen.getByLabelText('since'))
    const submitButton = screen.getByRole('button', { name: '제출하기' })
    fireEvent.click(submitButton)
    fireEvent.click(submitButton)
    fireEvent.click(submitButton)

    expect(fetchSpy).toHaveBeenCalledTimes(2)

    resolveSubmit(gradedResponse())
    await waitFor(() => expect(screen.getByRole('status').textContent).toContain('정답입니다!'))
  })

  it('shows a no-question state on 404 with a retry action', async () => {
    const fetchSpy = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(404, { code: 'NO_QUESTION_AVAILABLE', message: '조건에 맞는 문제가 없습니다.' }))
      .mockResolvedValueOnce(deliveredQuestionResponse())
    vi.stubGlobal('fetch', fetchSpy)
    seedStudentSession()

    renderPracticePage()

    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('조건에 맞는 문제가 없습니다.'))
    fireEvent.click(screen.getByRole('button', { name: '다시 시도' }))

    await waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(2))
    await waitFor(() => expect(screen.getByText('He has lived here _____ 2010.')).toBeDefined())
  })

  it('shows a recoverable error on a server failure while loading and retries the same request on click', async () => {
    const fetchSpy = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(500, { code: 'INTERNAL_ERROR', message: '서버 오류가 발생했습니다.' }))
      .mockResolvedValueOnce(deliveredQuestionResponse())
    vi.stubGlobal('fetch', fetchSpy)
    seedStudentSession()

    renderPracticePage()

    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('서버 오류가 발생했습니다.'))
    fireEvent.click(screen.getByRole('button', { name: '다시 시도' }))

    await waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(2))
    await waitFor(() => expect(screen.getByText('He has lived here _____ 2010.')).toBeDefined())
  })

  it('shows a session-expired state on a 401 while loading and returns to /login after re-sign-in', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(jsonResponse(401, { code: 'TOKEN_EXPIRED', message: '세션이 만료되었습니다.' })),
    )
    seedStudentSession()

    renderPracticePage()

    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('세션이 만료되었습니다.'))
    fireEvent.click(screen.getByRole('button', { name: '다시 로그인' }))

    expect(screen.getByText('Login landing')).toBeDefined()
    expect(sessionStorage.getItem('grmr.auth.session')).toBeNull()
  })

  it('shows a forbidden message on a 403 while loading without offering retry or re-sign-in', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(403, { code: 'FORBIDDEN', message: '권한이 없습니다.' })))
    seedStudentSession()

    renderPracticePage()

    await waitFor(() =>
      expect(screen.getByRole('alert').textContent).toContain('문제를 조회할 권한이 없습니다.'),
    )
    expect(screen.queryByRole('button', { name: '다시 시도' })).toBeNull()
    expect(screen.queryByRole('button', { name: '다시 로그인' })).toBeNull()
  })

  it('shows a session-expired state on a 401 during submission', async () => {
    const fetchSpy = vi
      .fn()
      .mockResolvedValueOnce(deliveredQuestionResponse())
      .mockResolvedValueOnce(jsonResponse(401, { code: 'TOKEN_EXPIRED', message: '세션이 만료되었습니다.' }))
    vi.stubGlobal('fetch', fetchSpy)
    seedStudentSession()

    renderPracticePage()
    await waitFor(() => expect(screen.getByText('He has lived here _____ 2010.')).toBeDefined())

    fireEvent.click(screen.getByLabelText('since'))
    fireEvent.click(screen.getByRole('button', { name: '제출하기' }))

    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('세션이 만료되었습니다.'))
    fireEvent.click(screen.getByRole('button', { name: '다시 로그인' }))

    expect(screen.getByText('Login landing')).toBeDefined()
    expect(sessionStorage.getItem('grmr.auth.session')).toBeNull()
  })

  it('shows a forbidden message on a 403 during submission without a recovery action', async () => {
    const fetchSpy = vi
      .fn()
      .mockResolvedValueOnce(deliveredQuestionResponse())
      .mockResolvedValueOnce(jsonResponse(403, { code: 'FORBIDDEN', message: '권한이 없습니다.' }))
    vi.stubGlobal('fetch', fetchSpy)
    seedStudentSession()

    renderPracticePage()
    await waitFor(() => expect(screen.getByText('He has lived here _____ 2010.')).toBeDefined())

    fireEvent.click(screen.getByLabelText('since'))
    fireEvent.click(screen.getByRole('button', { name: '제출하기' }))

    await waitFor(() =>
      expect(screen.getByRole('alert').textContent).toContain('답안을 제출할 권한이 없습니다.'),
    )
    expect(screen.queryByRole('button', { name: '다시 시도' })).toBeNull()
    expect(screen.queryByRole('button', { name: '다시 로그인' })).toBeNull()
  })

  it('shows the backend message on a 409 contract error and offers a next-question action', async () => {
    const fetchSpy = vi
      .fn()
      .mockResolvedValueOnce(deliveredQuestionResponse())
      .mockResolvedValueOnce(jsonResponse(409, { code: 'QUESTION_NOT_IN_USE', message: '사용 중인 문제만 풀 수 있습니다.' }))
      .mockResolvedValueOnce(
        deliveredQuestionResponse({
          id: 2002,
          text: 'The window _____ by the wind last night.',
          choices: ['broke', 'was broken', 'has broken', 'is breaking'],
        }),
      )
    vi.stubGlobal('fetch', fetchSpy)
    seedStudentSession()

    renderPracticePage()
    await waitFor(() => expect(screen.getByText('He has lived here _____ 2010.')).toBeDefined())

    fireEvent.click(screen.getByLabelText('since'))
    fireEvent.click(screen.getByRole('button', { name: '제출하기' }))

    await waitFor(() =>
      expect(screen.getByRole('alert').textContent).toContain('사용 중인 문제만 풀 수 있습니다.'),
    )
    fireEvent.click(screen.getByRole('button', { name: '다음 문제' }))

    await waitFor(() => expect(screen.getByText('The window _____ by the wind last night.')).toBeDefined())
    expect(fetchSpy).toHaveBeenCalledTimes(3)
  })

  it('shows a retryable error on a network failure during submission and resubmits the same choice on click', async () => {
    const fetchSpy = vi
      .fn()
      .mockResolvedValueOnce(deliveredQuestionResponse())
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValueOnce(gradedResponse())
    vi.stubGlobal('fetch', fetchSpy)
    seedStudentSession()

    renderPracticePage()
    await waitFor(() => expect(screen.getByText('He has lived here _____ 2010.')).toBeDefined())

    fireEvent.click(screen.getByLabelText('since'))
    fireEvent.click(screen.getByRole('button', { name: '제출하기' }))

    await waitFor(() =>
      expect(screen.getByRole('alert').textContent).toContain('네트워크 오류가 발생했습니다.'),
    )
    fireEvent.click(screen.getByRole('button', { name: '다시 시도' }))

    await waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(3))
    await waitFor(() => expect(screen.getByRole('status').textContent).toContain('정답입니다!'))
  })
})
