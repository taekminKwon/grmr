import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AuthProvider } from '../auth/AuthContext'
import StudentAssignmentSolvePage from './StudentAssignmentSolvePage'

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

function ResultLanding() {
  const location = useLocation()
  const state = location.state as { result?: unknown } | null
  return <div>Assignment result landing{state && 'result' in state ? ' with result state' : ''}</div>
}

function renderSolvePage(initialEntries: string[] = ['/student/assignments/1']) {
  render(
    <AuthProvider>
      <MemoryRouter initialEntries={initialEntries}>
        <Routes>
          <Route path="/student/assignments" element={<div>Assignment list landing</div>} />
          <Route path="/student/assignments/:id" element={<StudentAssignmentSolvePage />} />
          <Route path="/student/assignments/:id/result" element={<ResultLanding />} />
          <Route path="/login" element={<div>Login landing</div>} />
        </Routes>
      </MemoryRouter>
    </AuthProvider>,
  )
}

function rawQuestion(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 1024,
    order: 1,
    category: '현재완료',
    level: '보통',
    text: 'He has lived here _____ 2010.',
    choices: ['for', 'since', 'during', 'from'],
    myAnswer: null,
    ...overrides,
  }
}

function questionOne(myAnswer: string | null = null) {
  return rawQuestion({ id: 1024, order: 1, text: 'He has lived here _____ 2010.', myAnswer })
}

function questionTwo(myAnswer: string | null = null) {
  return rawQuestion({ id: 1023, order: 2, text: 'She _____ here since last year.', myAnswer })
}

function questionThree(myAnswer: string | null = null) {
  return rawQuestion({
    id: 1021,
    order: 3,
    category: '가정법',
    level: '심화',
    text: 'If I _____ you, I would study harder.',
    choices: ['am', 'was', 'were', 'be'],
    myAnswer,
  })
}

function questionsResponse(submissionStatus: string, questions: ReturnType<typeof rawQuestion>[]) {
  return jsonResponse(200, { assignmentId: 1, submissionStatus, questions })
}

describe('StudentAssignmentSolvePage', () => {
  it('resumes at the first unanswered question', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        questionsResponse('IN_PROGRESS', [questionOne('since'), questionTwo(null), questionThree(null)]),
      ),
    )
    seedStudentSession()

    renderSolvePage()

    await waitFor(() => expect(screen.getByText('She _____ here since last year.')).toBeDefined())
    expect(
      screen.getByRole('button', { name: '2번 문항, 미답변' }).getAttribute('aria-current'),
    ).toBe('true')
  })

  it('resumes at the first question when every question already has a draft answer', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        questionsResponse('IN_PROGRESS', [questionOne('since'), questionTwo('for'), questionThree('were')]),
      ),
    )
    seedStudentSession()

    renderSolvePage()

    await waitFor(() => expect(screen.getByText('He has lived here _____ 2010.')).toBeDefined())
    expect(
      screen.getByRole('button', { name: '1번 문항, 답변 완료' }).getAttribute('aria-current'),
    ).toBe('true')
  })

  it('renders questions in ascending order and navigates with the number nav and prev/next controls', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        questionsResponse('IN_PROGRESS', [questionOne('since'), questionTwo(null), questionThree(null)]),
      ),
    )
    seedStudentSession()

    renderSolvePage()
    await waitFor(() => expect(screen.getByText('She _____ here since last year.')).toBeDefined())

    const nav = screen.getByRole('navigation', { name: '문항 이동' })
    const navButtons = within(nav).getAllByRole('button')
    expect(navButtons.map((button) => button.textContent)).toEqual(['1', '2', '3'])

    expect((screen.getByRole('button', { name: '이전 문제' }) as HTMLButtonElement).disabled).toBe(false)
    expect((screen.getByRole('button', { name: '다음 문제' }) as HTMLButtonElement).disabled).toBe(false)

    fireEvent.click(screen.getByRole('button', { name: '3번 문항, 미답변' }))
    expect(screen.getByText('If I _____ you, I would study harder.')).toBeDefined()
    expect((screen.getByRole('button', { name: '다음 문제' }) as HTMLButtonElement).disabled).toBe(true)

    fireEvent.click(screen.getByRole('button', { name: '이전 문제' }))
    expect(screen.getByText('She _____ here since last year.')).toBeDefined()

    fireEvent.click(screen.getByRole('button', { name: '1번 문항, 답변 완료' }))
    expect(screen.getByText('He has lived here _____ 2010.')).toBeDefined()
    expect((screen.getByRole('button', { name: '이전 문제' }) as HTMLButtonElement).disabled).toBe(true)
  })

  it('shows answered progress and only updates it once the draft save is confirmed persisted', async () => {
    let resolveSave: (value: Response) => void = () => {}
    const fetchSpy = vi.fn().mockImplementation((_url: string, init?: RequestInit) => {
      const method = init?.method ?? 'GET'
      if (method === 'GET') {
        return Promise.resolve(
          questionsResponse('IN_PROGRESS', [questionOne('since'), questionTwo(null), questionThree(null)]),
        )
      }
      return new Promise<Response>((resolve) => {
        resolveSave = resolve
      })
    })
    vi.stubGlobal('fetch', fetchSpy)
    seedStudentSession()

    renderSolvePage()
    await waitFor(() => expect(screen.getByText('She _____ here since last year.')).toBeDefined())
    expect(screen.getByText('답변 완료 1 / 3문항 (33%)')).toBeDefined()

    fireEvent.click(screen.getByLabelText('for'))
    // The optimistic local selection must not inflate the count while the
    // PUT is still pending — only a confirmed persisted draft may count.
    expect(screen.getByText('답변 완료 1 / 3문항 (33%)')).toBeDefined()

    resolveSave(jsonResponse(200, { questionId: 1023, answer: 'for', savedAt: '2026-08-15T10:00:00' }))
    await waitFor(() => expect(screen.getByText('답변 완료 2 / 3문항 (67%)')).toBeDefined())
  })

  it('saves the selected answer via PUT and shows saving/saved status', async () => {
    const fetchSpy = vi.fn().mockImplementation((url: string, init?: RequestInit) => {
      const method = init?.method ?? 'GET'
      if (method === 'GET') {
        return Promise.resolve(questionsResponse('IN_PROGRESS', [questionOne(null)]))
      }
      expect(url).toBe('/api/me/assignments/1/answers/1024')
      expect(init?.headers as Record<string, string>).toMatchObject({
        Authorization: 'Bearer access-token-abc',
        'Content-Type': 'application/json',
      })
      expect(JSON.parse(init!.body as string)).toEqual({ answer: 'since' })
      return Promise.resolve(jsonResponse(200, { questionId: 1024, answer: 'since', savedAt: '2026-08-15T10:05:00' }))
    })
    vi.stubGlobal('fetch', fetchSpy)
    seedStudentSession()

    renderSolvePage()
    await waitFor(() => expect(screen.getByText('He has lived here _____ 2010.')).toBeDefined())

    fireEvent.click(screen.getByLabelText('since'))
    expect(screen.getByText('저장 중...')).toBeDefined()

    await waitFor(() => expect(screen.getByText('저장됨 · 2026년 8월 15일 10:05')).toBeDefined())
  })

  it('overwrites the draft when a different choice is selected, and protects against a stale out-of-order save response', async () => {
    let resolveFirstSave: (value: Response) => void = () => {}
    let resolveSecondSave: (value: Response) => void = () => {}

    const fetchSpy = vi.fn().mockImplementation((_url: string, init?: RequestInit) => {
      const method = init?.method ?? 'GET'
      if (method === 'GET') {
        return Promise.resolve(questionsResponse('IN_PROGRESS', [questionOne(null)]))
      }
      const body = JSON.parse(init!.body as string) as { answer: string }
      if (body.answer === 'for') {
        return new Promise<Response>((resolve) => {
          resolveFirstSave = resolve
        })
      }
      return new Promise<Response>((resolve) => {
        resolveSecondSave = resolve
      })
    })
    vi.stubGlobal('fetch', fetchSpy)
    seedStudentSession()

    renderSolvePage()
    await waitFor(() => expect(screen.getByText('He has lived here _____ 2010.')).toBeDefined())

    fireEvent.click(screen.getByLabelText('for'))
    fireEvent.click(screen.getByLabelText('since'))

    // The radio reflects the newer local choice immediately, before either save resolves.
    expect((screen.getByLabelText('since') as HTMLInputElement).checked).toBe(true)
    expect((screen.getByLabelText('for') as HTMLInputElement).checked).toBe(false)

    // The stale (first) response arrives after the newer save was already issued; it must not be applied.
    resolveFirstSave(jsonResponse(200, { questionId: 1024, answer: 'for', savedAt: '2026-01-01T00:00:00' }))
    await Promise.resolve()
    await Promise.resolve()
    expect(screen.getByText('저장 중...')).toBeDefined()
    expect(screen.queryByText('저장됨 · 2026년 1월 1일 0:00')).toBeNull()

    resolveSecondSave(jsonResponse(200, { questionId: 1024, answer: 'since', savedAt: '2026-08-15T10:05:00' }))
    await waitFor(() => expect(screen.getByText('저장됨 · 2026년 8월 15일 10:05')).toBeDefined())
  })

  it('retries the save with the current choice after a save error', async () => {
    const fetchSpy = vi
      .fn()
      .mockResolvedValueOnce(questionsResponse('IN_PROGRESS', [questionOne(null)]))
      .mockResolvedValueOnce(jsonResponse(500, { code: 'INTERNAL_ERROR', message: '답안을 저장하지 못했습니다.' }))
      .mockResolvedValueOnce(jsonResponse(200, { questionId: 1024, answer: 'since', savedAt: '2026-08-15T10:05:00' }))
    vi.stubGlobal('fetch', fetchSpy)
    seedStudentSession()

    renderSolvePage()
    await waitFor(() => expect(screen.getByText('He has lived here _____ 2010.')).toBeDefined())

    fireEvent.click(screen.getByLabelText('since'))
    await waitFor(() => expect(screen.getByText('답안을 저장하지 못했습니다.')).toBeDefined())

    // A failed save now also surfaces a retry action in the unsaved-changes
    // banner, so scope to the inline one under the current question.
    const saveStatus = document.querySelector('.assignment-solve-save-status') as HTMLElement
    fireEvent.click(within(saveStatus).getByRole('button', { name: '다시 저장' }))

    await waitFor(() => expect(screen.getByText('저장됨 · 2026년 8월 15일 10:05')).toBeDefined())
    expect(fetchSpy).toHaveBeenCalledTimes(3)
    const [, retryInit] = fetchSpy.mock.calls[2]
    expect(JSON.parse(retryInit.body)).toEqual({ answer: 'since' })
  })

  it('shows a session-expired save error on 401 and returns to /login after re-sign-in', async () => {
    const fetchSpy = vi
      .fn()
      .mockResolvedValueOnce(questionsResponse('IN_PROGRESS', [questionOne(null)]))
      .mockResolvedValueOnce(jsonResponse(401, { code: 'TOKEN_EXPIRED', message: '세션이 만료되었습니다.' }))
    vi.stubGlobal('fetch', fetchSpy)
    seedStudentSession()

    renderSolvePage()
    await waitFor(() => expect(screen.getByText('He has lived here _____ 2010.')).toBeDefined())

    fireEvent.click(screen.getByLabelText('since'))
    await waitFor(() => expect(screen.getByText('세션이 만료되어 답안을 저장하지 못했습니다.')).toBeDefined())

    fireEvent.click(screen.getByRole('button', { name: '다시 로그인' }))
    expect(screen.getByText('Login landing')).toBeDefined()
    expect(sessionStorage.getItem('grmr.auth.session')).toBeNull()
  })

  it('marks the assignment forcibly submitted when a save hits a 409 already-submitted conflict', async () => {
    const fetchSpy = vi
      .fn()
      .mockResolvedValueOnce(questionsResponse('IN_PROGRESS', [questionOne(null)]))
      .mockResolvedValueOnce(
        jsonResponse(409, { code: 'ASSIGNMENT_ALREADY_SUBMITTED', message: '이미 제출된 과제는 답안을 수정할 수 없습니다.' }),
      )
    vi.stubGlobal('fetch', fetchSpy)
    seedStudentSession()

    renderSolvePage()
    await waitFor(() => expect(screen.getByText('He has lived here _____ 2010.')).toBeDefined())

    fireEvent.click(screen.getByLabelText('since'))

    await waitFor(() =>
      expect(screen.getByText('이미 제출된 과제입니다. 답안을 더 이상 수정할 수 없습니다.')).toBeDefined(),
    )
    expect((screen.getByLabelText('since') as HTMLInputElement).disabled).toBe(true)
  })

  it('never renders correctness/grading information while solving, even after selecting answers', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((_url: string, init?: RequestInit) => {
        const method = init?.method ?? 'GET'
        if (method === 'GET') {
          return Promise.resolve(questionsResponse('IN_PROGRESS', [questionOne(null)]))
        }
        return Promise.resolve(jsonResponse(200, { questionId: 1024, answer: 'since', savedAt: '2026-08-15T10:05:00' }))
      }),
    )
    seedStudentSession()

    renderSolvePage()
    await waitFor(() => expect(screen.getByText('He has lived here _____ 2010.')).toBeDefined())

    fireEvent.click(screen.getByLabelText('since'))
    await waitFor(() => expect(screen.getByText('저장됨 · 2026년 8월 15일 10:05')).toBeDefined())

    expect(screen.queryByText(/정답/)).toBeNull()
    expect(screen.queryByText(/오답/)).toBeNull()
    expect(screen.queryByText(/설명/)).toBeNull()
    expect(document.querySelector('[class*="correct"]')).toBeNull()
  })

  it('disables submission and lists which answers are still saving while a draft PUT is pending', async () => {
    let resolveSave: (value: Response) => void = () => {}
    const fetchSpy = vi.fn().mockImplementation((_url: string, init?: RequestInit) => {
      const method = init?.method ?? 'GET'
      if (method === 'GET') {
        return Promise.resolve(questionsResponse('IN_PROGRESS', [questionOne(null)]))
      }
      return new Promise<Response>((resolve) => {
        resolveSave = resolve
      })
    })
    vi.stubGlobal('fetch', fetchSpy)
    seedStudentSession()

    renderSolvePage()
    await waitFor(() => expect(screen.getByText('He has lived here _____ 2010.')).toBeDefined())

    fireEvent.click(screen.getByLabelText('since'))
    expect(screen.getByText('저장 중...')).toBeDefined()
    expect((screen.getByRole('button', { name: '제출하기' }) as HTMLButtonElement).disabled).toBe(true)
    expect(screen.getByText('모든 답안이 저장된 후에 제출할 수 있습니다.')).toBeDefined()
    expect(screen.getByText('1번 문항 저장 중...')).toBeDefined()

    resolveSave(jsonResponse(200, { questionId: 1024, answer: 'since', savedAt: '2026-08-15T10:05:00' }))
    await waitFor(() =>
      expect((screen.getByRole('button', { name: '제출하기' }) as HTMLButtonElement).disabled).toBe(false),
    )
    expect(screen.queryByText('모든 답안이 저장된 후에 제출할 수 있습니다.')).toBeNull()
  })

  it('does not count a failed save toward progress and blocks submission until a retry succeeds', async () => {
    const fetchSpy = vi
      .fn()
      .mockResolvedValueOnce(questionsResponse('IN_PROGRESS', [questionOne(null)]))
      .mockResolvedValueOnce(jsonResponse(500, { code: 'INTERNAL_ERROR', message: '답안을 저장하지 못했습니다.' }))
      .mockResolvedValueOnce(jsonResponse(200, { questionId: 1024, answer: 'since', savedAt: '2026-08-15T10:05:00' }))
    vi.stubGlobal('fetch', fetchSpy)
    seedStudentSession()

    renderSolvePage()
    await waitFor(() => expect(screen.getByText('He has lived here _____ 2010.')).toBeDefined())
    expect(screen.getByText('답변 완료 0 / 1문항 (0%)')).toBeDefined()

    fireEvent.click(screen.getByLabelText('since'))
    await waitFor(() => expect(screen.getByText('답안을 저장하지 못했습니다.')).toBeDefined())

    // The failed draft must not be counted, and submission must stay blocked.
    expect(screen.getByText('답변 완료 0 / 1문항 (0%)')).toBeDefined()
    expect((screen.getByRole('button', { name: '제출하기' }) as HTMLButtonElement).disabled).toBe(true)
    expect(screen.getByText('1번 문항 저장 실패')).toBeDefined()

    const banner = document.querySelector('.assignment-solve-unsaved-banner') as HTMLElement
    fireEvent.click(within(banner).getByRole('button', { name: '다시 저장' }))

    await waitFor(() => expect(screen.getByText('답변 완료 1 / 1문항 (100%)')).toBeDefined())
    expect((screen.getByRole('button', { name: '제출하기' }) as HTMLButtonElement).disabled).toBe(false)
  })

  it('ignores a stale save response so it cannot count or unblock a newer selection', async () => {
    let resolveFirstSave: (value: Response) => void = () => {}
    let resolveSecondSave: (value: Response) => void = () => {}

    const fetchSpy = vi.fn().mockImplementation((_url: string, init?: RequestInit) => {
      const method = init?.method ?? 'GET'
      if (method === 'GET') {
        return Promise.resolve(questionsResponse('IN_PROGRESS', [questionOne(null)]))
      }
      const body = JSON.parse(init!.body as string) as { answer: string }
      if (body.answer === 'for') {
        return new Promise<Response>((resolve) => {
          resolveFirstSave = resolve
        })
      }
      return new Promise<Response>((resolve) => {
        resolveSecondSave = resolve
      })
    })
    vi.stubGlobal('fetch', fetchSpy)
    seedStudentSession()

    renderSolvePage()
    await waitFor(() => expect(screen.getByText('He has lived here _____ 2010.')).toBeDefined())

    fireEvent.click(screen.getByLabelText('for'))
    fireEvent.click(screen.getByLabelText('since'))
    expect((screen.getByRole('button', { name: '제출하기' }) as HTMLButtonElement).disabled).toBe(true)

    // The stale response for the superseded "for" choice arrives after
    // "since" was already selected; it must not be counted as persisted
    // and must not unblock submission on its own.
    resolveFirstSave(jsonResponse(200, { questionId: 1024, answer: 'for', savedAt: '2026-01-01T00:00:00' }))
    await Promise.resolve()
    await Promise.resolve()
    expect(screen.getByText('답변 완료 0 / 1문항 (0%)')).toBeDefined()
    expect((screen.getByRole('button', { name: '제출하기' }) as HTMLButtonElement).disabled).toBe(true)

    resolveSecondSave(jsonResponse(200, { questionId: 1024, answer: 'since', savedAt: '2026-08-15T10:05:00' }))
    await waitFor(() => expect(screen.getByText('답변 완료 1 / 1문항 (100%)')).toBeDefined())
    expect((screen.getByRole('button', { name: '제출하기' }) as HTMLButtonElement).disabled).toBe(false)
  })

  it('only submits and navigates once the pending draft save has been confirmed persisted', async () => {
    let resolveSave: (value: Response) => void = () => {}
    const submitResultBody = {
      assignmentId: 1,
      submissionStatus: 'SUBMITTED',
      submittedAt: '2026-08-17T09:00:00',
      totalQuestions: 1,
      answeredQuestions: 1,
      correctCount: 1,
      score: 100,
      results: [{ questionId: 1024, submittedAnswer: 'since', correct: true, correctAnswer: 'since', explanation: '...' }],
    }
    const fetchSpy = vi.fn().mockImplementation((url: string, init?: RequestInit) => {
      const method = init?.method ?? 'GET'
      if (method === 'GET') {
        return Promise.resolve(questionsResponse('IN_PROGRESS', [questionOne(null)]))
      }
      if (method === 'PUT') {
        return new Promise<Response>((resolve) => {
          resolveSave = resolve
        })
      }
      expect(url).toBe('/api/me/assignments/1/submit')
      return Promise.resolve(jsonResponse(200, submitResultBody))
    })
    vi.stubGlobal('fetch', fetchSpy)
    seedStudentSession()

    renderSolvePage()
    await waitFor(() => expect(screen.getByText('He has lived here _____ 2010.')).toBeDefined())

    fireEvent.click(screen.getByLabelText('since'))
    expect((screen.getByRole('button', { name: '제출하기' }) as HTMLButtonElement).disabled).toBe(true)

    resolveSave(jsonResponse(200, { questionId: 1024, answer: 'since', savedAt: '2026-08-15T10:05:00' }))
    await waitFor(() =>
      expect((screen.getByRole('button', { name: '제출하기' }) as HTMLButtonElement).disabled).toBe(false),
    )

    fireEvent.click(screen.getByRole('button', { name: '제출하기' }))
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: '제출 확정' }))

    await waitFor(() => expect(screen.getByText('Assignment result landing with result state')).toBeDefined())
    expect(fetchSpy).toHaveBeenCalledTimes(3)
    const [submitUrl, submitInit] = fetchSpy.mock.calls[2]
    expect(submitUrl).toBe('/api/me/assignments/1/submit')
    expect(submitInit.method).toBe('POST')
  })

  it('opens a confirmation dialog with answered/unanswered counts and cancels without submitting', async () => {
    const fetchSpy = vi.fn().mockResolvedValue(
      questionsResponse('IN_PROGRESS', [questionOne('since'), questionTwo(null), questionThree(null)]),
    )
    vi.stubGlobal('fetch', fetchSpy)
    seedStudentSession()

    renderSolvePage()
    await waitFor(() => expect(screen.getByText('She _____ here since last year.')).toBeDefined())

    fireEvent.click(screen.getByRole('button', { name: '제출하기' }))
    const dialog = screen.getByRole('dialog')
    expect(within(dialog).getByText('답변 완료 1문항 · 미답변 2문항')).toBeDefined()

    fireEvent.click(within(dialog).getByRole('button', { name: '취소' }))
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(fetchSpy).toHaveBeenCalledTimes(1)
  })

  it('submits successfully with unanswered questions remaining and navigates to the result route with the result as optional state', async () => {
    const resultBody = {
      assignmentId: 1,
      submissionStatus: 'SUBMITTED',
      submittedAt: '2026-08-17T09:00:00',
      totalQuestions: 3,
      answeredQuestions: 1,
      correctCount: 1,
      score: 33,
      results: [
        { questionId: 1024, submittedAnswer: 'since', correct: true, correctAnswer: 'since', explanation: '...' },
        { questionId: 1023, submittedAnswer: null, correct: false, correctAnswer: 'since', explanation: '...' },
        { questionId: 1021, submittedAnswer: null, correct: false, correctAnswer: 'were', explanation: '...' },
      ],
    }
    const fetchSpy = vi
      .fn()
      .mockResolvedValueOnce(
        questionsResponse('IN_PROGRESS', [questionOne('since'), questionTwo(null), questionThree(null)]),
      )
      .mockResolvedValueOnce(jsonResponse(200, resultBody))
    vi.stubGlobal('fetch', fetchSpy)
    seedStudentSession()

    renderSolvePage()
    await waitFor(() => expect(screen.getByText('She _____ here since last year.')).toBeDefined())

    fireEvent.click(screen.getByRole('button', { name: '제출하기' }))
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: '제출 확정' }))

    await waitFor(() => expect(screen.getByText('Assignment result landing with result state')).toBeDefined())
    const [url, init] = fetchSpy.mock.calls[1]
    expect(url).toBe('/api/me/assignments/1/submit')
    expect(init.method).toBe('POST')
  })

  it('shows a session-expired submit error on 401 with a re-sign-in action inside the dialog', async () => {
    const fetchSpy = vi
      .fn()
      .mockResolvedValueOnce(questionsResponse('IN_PROGRESS', [questionOne('since')]))
      .mockResolvedValueOnce(jsonResponse(401, { code: 'TOKEN_EXPIRED', message: '세션이 만료되었습니다.' }))
    vi.stubGlobal('fetch', fetchSpy)
    seedStudentSession()

    renderSolvePage()
    await waitFor(() => expect(screen.getByText('He has lived here _____ 2010.')).toBeDefined())

    fireEvent.click(screen.getByRole('button', { name: '제출하기' }))
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: '제출 확정' }))

    await waitFor(() =>
      expect(screen.getByText('세션이 만료되어 제출하지 못했습니다. 다시 로그인해주세요.')).toBeDefined(),
    )
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: '다시 로그인' }))
    expect(screen.getByText('Login landing')).toBeDefined()
    expect(sessionStorage.getItem('grmr.auth.session')).toBeNull()
  })

  it('shows a forbidden submit error on 403 without a re-sign-in action', async () => {
    const fetchSpy = vi
      .fn()
      .mockResolvedValueOnce(questionsResponse('IN_PROGRESS', [questionOne('since')]))
      .mockResolvedValueOnce(jsonResponse(403, { code: 'FORBIDDEN', message: '과제를 제출할 권한이 없습니다.' }))
    vi.stubGlobal('fetch', fetchSpy)
    seedStudentSession()

    renderSolvePage()
    await waitFor(() => expect(screen.getByText('He has lived here _____ 2010.')).toBeDefined())

    fireEvent.click(screen.getByRole('button', { name: '제출하기' }))
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: '제출 확정' }))

    await waitFor(() =>
      expect(screen.getByText('과제를 제출할 권한이 없습니다. 학생 계정으로 로그인했는지 확인해주세요.')).toBeDefined(),
    )
    expect(within(screen.getByRole('dialog')).queryByRole('button', { name: '다시 로그인' })).toBeNull()
  })

  it('shows a closed-assignment submit error on 409 and keeps the dialog open for retry', async () => {
    const fetchSpy = vi
      .fn()
      .mockResolvedValueOnce(questionsResponse('IN_PROGRESS', [questionOne('since')]))
      .mockResolvedValueOnce(jsonResponse(409, { code: 'ASSIGNMENT_CLOSED', message: '마감된 과제는 제출할 수 없습니다.' }))
    vi.stubGlobal('fetch', fetchSpy)
    seedStudentSession()

    renderSolvePage()
    await waitFor(() => expect(screen.getByText('He has lived here _____ 2010.')).toBeDefined())

    fireEvent.click(screen.getByRole('button', { name: '제출하기' }))
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: '제출 확정' }))

    await waitFor(() => expect(screen.getByText('마감된 과제는 제출할 수 없습니다.')).toBeDefined())
    expect(screen.getByRole('dialog')).toBeDefined()
    expect((within(screen.getByRole('dialog')).getByRole('button', { name: '제출 확정' }) as HTMLButtonElement).disabled).toBe(
      false,
    )
  })

  it('closes the dialog and switches to read-only when submit hits a 409 already-submitted conflict', async () => {
    const fetchSpy = vi
      .fn()
      .mockResolvedValueOnce(questionsResponse('IN_PROGRESS', [questionOne('since')]))
      .mockResolvedValueOnce(
        jsonResponse(409, { code: 'ASSIGNMENT_ALREADY_SUBMITTED', message: '이미 제출된 과제입니다.' }),
      )
    vi.stubGlobal('fetch', fetchSpy)
    seedStudentSession()

    renderSolvePage()
    await waitFor(() => expect(screen.getByText('He has lived here _____ 2010.')).toBeDefined())

    fireEvent.click(screen.getByRole('button', { name: '제출하기' }))
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: '제출 확정' }))

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(screen.getByText('이미 제출된 과제입니다.')).toBeDefined()
    expect(screen.getByText('이미 제출된 과제입니다. 답안을 더 이상 수정할 수 없습니다.')).toBeDefined()

    const resultButtons = screen.getAllByRole('button', { name: '결과 보기' })
    expect(resultButtons).toHaveLength(2)
    fireEvent.click(resultButtons[0])
    expect(screen.getByText('Assignment result landing')).toBeDefined()
  })

  it('shows a network-error submit message', async () => {
    const fetchSpy = vi
      .fn()
      .mockResolvedValueOnce(questionsResponse('IN_PROGRESS', [questionOne('since')]))
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
    vi.stubGlobal('fetch', fetchSpy)
    seedStudentSession()

    renderSolvePage()
    await waitFor(() => expect(screen.getByText('He has lived here _____ 2010.')).toBeDefined())

    fireEvent.click(screen.getByRole('button', { name: '제출하기' }))
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: '제출 확정' }))

    await waitFor(() =>
      expect(screen.getByText('네트워크 오류가 발생했습니다. 연결 상태를 확인해주세요.')).toBeDefined(),
    )
  })

  it('shows a read-only SUBMITTED view with a result CTA and disabled choices, without a submit action', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(questionsResponse('SUBMITTED', [questionOne('since'), questionTwo('for')])),
    )
    seedStudentSession()

    renderSolvePage()

    await waitFor(() =>
      expect(screen.getByText('이미 제출된 과제입니다. 답안을 더 이상 수정할 수 없습니다.')).toBeDefined(),
    )
    expect((screen.getByLabelText('since') as HTMLInputElement).disabled).toBe(true)
    expect(screen.queryByRole('button', { name: '제출하기' })).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: '결과 보기' }))
    expect(screen.getByText('Assignment result landing')).toBeDefined()
  })

  it('shows an invalid-id message and issues no request for a non-numeric route param', async () => {
    const fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)
    seedStudentSession()

    renderSolvePage(['/student/assignments/abc'])

    expect(screen.getByText('잘못된 과제 번호입니다.')).toBeDefined()
    expect(fetchSpy).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('link', { name: '목록으로 돌아가기' }))
    expect(screen.getByText('Assignment list landing')).toBeDefined()
  })

  it('shows a session-expired load error on 401 and returns to /login after re-sign-in', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(jsonResponse(401, { code: 'TOKEN_EXPIRED', message: '세션이 만료되었습니다.' })),
    )
    seedStudentSession()

    renderSolvePage()

    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('세션이 만료되었습니다'))
    fireEvent.click(screen.getByRole('button', { name: '다시 로그인' }))

    expect(screen.getByText('Login landing')).toBeDefined()
    expect(sessionStorage.getItem('grmr.auth.session')).toBeNull()
  })

  it('shows a forbidden load error on 403 with a back link and no retry/re-login actions', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(jsonResponse(403, { code: 'FORBIDDEN', message: '권한이 없습니다.' })),
    )
    seedStudentSession()

    renderSolvePage()

    await waitFor(() =>
      expect(screen.getByRole('alert').textContent).toContain('과제를 조회할 권한이 없습니다.'),
    )
    expect(screen.queryByRole('button', { name: '다시 시도' })).toBeNull()
    expect(screen.queryByRole('button', { name: '다시 로그인' })).toBeNull()

    fireEvent.click(screen.getByRole('link', { name: '목록으로 돌아가기' }))
    expect(screen.getByText('Assignment list landing')).toBeDefined()
  })

  it('shows a not-found load error on 404 with a back link', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(jsonResponse(404, { code: 'ASSIGNMENT_NOT_FOUND', message: '과제를 찾을 수 없습니다.' })),
    )
    seedStudentSession()

    renderSolvePage()

    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('과제를 찾을 수 없습니다.'))
    expect(screen.getByRole('link', { name: '목록으로 돌아가기' })).toBeDefined()
  })

  it('shows a recoverable generic load error and retries the same request on click', async () => {
    const fetchSpy = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(500, { code: 'INTERNAL_ERROR', message: '서버 오류가 발생했습니다.' }))
      .mockResolvedValueOnce(questionsResponse('IN_PROGRESS', [questionOne('since')]))
    vi.stubGlobal('fetch', fetchSpy)
    seedStudentSession()

    renderSolvePage()

    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('서버 오류가 발생했습니다.'))
    fireEvent.click(screen.getByRole('button', { name: '다시 시도' }))

    await waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(2))
    await waitFor(() => expect(screen.getByText('He has lived here _____ 2010.')).toBeDefined())
  })

  it('shows a network-error load message distinctly, using the same recoverable path', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValueOnce(new TypeError('Failed to fetch')))
    seedStudentSession()

    renderSolvePage()

    await waitFor(() =>
      expect(screen.getByRole('alert').textContent).toContain('네트워크 오류가 발생했습니다.'),
    )
    expect(screen.getByRole('button', { name: '다시 시도' })).toBeDefined()
  })
})
