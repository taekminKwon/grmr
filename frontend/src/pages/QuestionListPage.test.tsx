import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AuthProvider } from '../auth/AuthContext'
import QuestionListPage from './QuestionListPage'

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

function seedStudentSession() {
  sessionStorage.setItem(
    'grmr.auth.session',
    JSON.stringify({ accessToken: 'access-token-abc', user: { name: '김학생', role: 'STUDENT' } }),
  )
}

function renderQuestionListPage(initialEntries: (string | { pathname: string; state?: unknown })[] = [
  '/admin/questions',
]) {
  render(
    <AuthProvider>
      <MemoryRouter initialEntries={initialEntries}>
        <Routes>
          <Route path="/admin/questions" element={<QuestionListPage />} />
          <Route path="/admin/questions/new" element={<div>Question create landing</div>} />
          <Route path="/admin/questions/:id" element={<div>Question detail landing</div>} />
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

describe('QuestionListPage', () => {
  it('fetches questions on mount using the session access token and renders the list', async () => {
    const fetchSpy = vi.fn().mockResolvedValue(jsonResponse(200, pageResponse([rawQuestion])))
    vi.stubGlobal('fetch', fetchSpy)
    seedAdminSession()

    renderQuestionListPage()

    await waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(1))
    const [url, init] = fetchSpy.mock.calls[0]
    expect(url).toBe('/api/questions?page=0&size=20')
    expect(init.headers.Authorization).toBe('Bearer access-token-abc')

    await waitFor(() => expect(screen.getByText('He has lived here _____ 2010.')).toBeDefined())
    const row = within(screen.getByRole('table'))
    expect(row.getByText('현재완료')).toBeDefined()
    expect(row.getByText('객관식')).toBeDefined()
    expect(row.getByText('보통')).toBeDefined()
    expect(row.getByText('사용 중')).toBeDefined()
    expect(row.getByText('1024')).toBeDefined()
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

    renderQuestionListPage()

    expect(screen.getByRole('status').textContent).toBe('불러오는 중...')

    resolveFetch(jsonResponse(200, pageResponse([])))
    await waitFor(() => expect(screen.queryByRole('status')).toBeNull())
  })

  it('exposes only MULTIPLE_CHOICE as a type filter choice', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(200, pageResponse([]))))
    seedAdminSession()

    renderQuestionListPage()
    await waitFor(() => expect(screen.getByText('조건에 맞는 문제가 없습니다.')).toBeDefined())

    const typeSelect = screen.getByLabelText('유형') as HTMLSelectElement
    const optionLabels = within(typeSelect)
      .getAllByRole('option')
      .map((option) => option.textContent)

    expect(optionLabels).toEqual(['전체', '객관식'])
  })

  it('serializes applied filters through the shared contract and resets to page 0', async () => {
    const fetchSpy = vi.fn().mockResolvedValue(jsonResponse(200, pageResponse([rawQuestion])))
    vi.stubGlobal('fetch', fetchSpy)
    seedAdminSession()

    renderQuestionListPage()
    await waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(1))

    fireEvent.change(screen.getByLabelText('카테고리'), { target: { value: '현재완료' } })
    fireEvent.change(screen.getByLabelText('유형'), { target: { value: 'MULTIPLE_CHOICE' } })
    fireEvent.change(screen.getByLabelText('난이도'), { target: { value: 'INTERMEDIATE' } })
    fireEvent.change(screen.getByLabelText('상태'), { target: { value: 'ACTIVE' } })
    fireEvent.change(screen.getByLabelText('키워드'), { target: { value: 'since' } })
    fireEvent.click(screen.getByRole('button', { name: '검색' }))

    await waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(2))
    const [url] = fetchSpy.mock.calls[1]
    expect(url).toBe(
      '/api/questions?category=%ED%98%84%EC%9E%AC%EC%99%84%EB%A3%8C&type=%EA%B0%9D%EA%B4%80%EC%8B%9D&level=%EB%B3%B4%ED%86%B5&status=%EC%82%AC%EC%9A%A9+%EC%A4%91&keyword=since&page=0&size=20',
    )
  })

  it('clears filters and refetches from page 0 on reset', async () => {
    const fetchSpy = vi.fn().mockResolvedValue(jsonResponse(200, pageResponse([rawQuestion])))
    vi.stubGlobal('fetch', fetchSpy)
    seedAdminSession()

    renderQuestionListPage()
    await waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(1))

    fireEvent.change(screen.getByLabelText('키워드'), { target: { value: 'since' } })
    fireEvent.click(screen.getByRole('button', { name: '검색' }))
    await waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(2))

    fireEvent.click(screen.getByRole('button', { name: '초기화' }))
    await waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(3))

    const [url] = fetchSpy.mock.calls[2]
    expect(url).toBe('/api/questions?page=0&size=20')
    expect((screen.getByLabelText('키워드') as HTMLInputElement).value).toBe('')
  })

  it('shows an empty state when no questions match', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(200, pageResponse([]))))
    seedAdminSession()

    renderQuestionListPage()

    await waitFor(() => expect(screen.getByText('조건에 맞는 문제가 없습니다.')).toBeDefined())
  })

  it('shows a recoverable error and retries the same request on click', async () => {
    const fetchSpy = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(500, { code: 'INTERNAL_ERROR', message: '서버 오류가 발생했습니다.' }))
      .mockResolvedValueOnce(jsonResponse(200, pageResponse([rawQuestion])))
    vi.stubGlobal('fetch', fetchSpy)
    seedAdminSession()

    renderQuestionListPage()

    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('서버 오류가 발생했습니다.'))
    expect(screen.getByRole('button', { name: '다시 시도' })).toBeDefined()

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

    renderQuestionListPage()

    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('세션이 만료되었습니다.'))
    const reSignInButton = screen.getByRole('button', { name: '다시 로그인' })

    fireEvent.click(reSignInButton)

    expect(screen.getByText('Login landing')).toBeDefined()
    expect(sessionStorage.getItem('grmr.auth.session')).toBeNull()
  })

  it('paginates using backend page metadata, disabling controls at the bounds', async () => {
    const fetchSpy = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse(
          200,
          pageResponse([rawQuestion], { page: 0, totalPages: 2, totalElements: 21 }),
        ),
      )
      .mockResolvedValueOnce(
        jsonResponse(
          200,
          pageResponse([{ ...rawQuestion, id: 1025, text: 'Second page question.' }], {
            page: 1,
            totalPages: 2,
            totalElements: 21,
          }),
        ),
      )
    vi.stubGlobal('fetch', fetchSpy)
    seedAdminSession()

    renderQuestionListPage()
    await waitFor(() => expect(screen.getByText('He has lived here _____ 2010.')).toBeDefined())

    const prevButton = screen.getByRole('button', { name: '이전' })
    const nextButton = screen.getByRole('button', { name: '다음' })
    expect((prevButton as HTMLButtonElement).disabled).toBe(true)
    expect((nextButton as HTMLButtonElement).disabled).toBe(false)
    expect(screen.getByText('1 / 2 페이지 · 총 21건')).toBeDefined()

    fireEvent.click(nextButton)

    await waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(2))
    const [url] = fetchSpy.mock.calls[1]
    expect(url).toBe('/api/questions?page=1&size=20')

    await waitFor(() => expect(screen.getByText('Second page question.')).toBeDefined())
    expect((screen.getByRole('button', { name: '이전' }) as HTMLButtonElement).disabled).toBe(false)
    expect((screen.getByRole('button', { name: '다음' }) as HTMLButtonElement).disabled).toBe(true)
  })

  it('shows the 문제 추가 entry point for an ADMIN session and navigates to the create route', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(200, pageResponse([]))))
    seedAdminSession()

    renderQuestionListPage()
    await waitFor(() => expect(screen.getByText('조건에 맞는 문제가 없습니다.')).toBeDefined())

    const addButton = screen.getByRole('button', { name: '문제 추가' })
    fireEvent.click(addButton)

    expect(screen.getByText('Question create landing')).toBeDefined()
  })

  it('navigates to the question detail page when 상세보기 is clicked', async () => {
    const fetchSpy = vi.fn().mockResolvedValue(jsonResponse(200, pageResponse([rawQuestion])))
    vi.stubGlobal('fetch', fetchSpy)
    seedAdminSession()

    renderQuestionListPage()
    await waitFor(() => expect(screen.getByText('He has lived here _____ 2010.')).toBeDefined())

    fireEvent.click(screen.getByRole('link', { name: /상세보기/ }))

    expect(screen.getByText('Question detail landing')).toBeDefined()
  })

  it('hides the 문제 추가 entry point for a STUDENT session', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(200, pageResponse([]))))
    seedStudentSession()

    renderQuestionListPage()
    await waitFor(() => expect(screen.getByText('조건에 맞는 문제가 없습니다.')).toBeDefined())

    expect(screen.queryByRole('button', { name: '문제 추가' })).toBeNull()
  })

  it('shows a success notice after navigating back from a successful question creation', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(200, pageResponse([]))))
    seedAdminSession()

    renderQuestionListPage([{ pathname: '/admin/questions', state: { questionCreated: true } }])

    await waitFor(() => expect(screen.getByRole('status').textContent).toContain('문제가 등록되었습니다.'))

    fireEvent.click(screen.getByRole('button', { name: '알림 닫기' }))
    expect(screen.queryByText('문제가 등록되었습니다.')).toBeNull()
  })

  it('does not show the success notice on a plain visit to the list', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(200, pageResponse([]))))
    seedAdminSession()

    renderQuestionListPage()
    await waitFor(() => expect(screen.getByText('조건에 맞는 문제가 없습니다.')).toBeDefined())

    expect(screen.queryByText('문제가 등록되었습니다.')).toBeNull()
  })
})
