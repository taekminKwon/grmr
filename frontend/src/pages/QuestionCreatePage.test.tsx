import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AuthProvider } from '../auth/AuthContext'
import QuestionCreatePage from './QuestionCreatePage'
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

function renderQuestionCreatePage() {
  render(
    <AuthProvider>
      <MemoryRouter initialEntries={['/admin/questions/new']}>
        <Routes>
          <Route path="/admin/questions/new" element={<QuestionCreatePage />} />
          <Route path="/admin/questions" element={<QuestionListPage />} />
          <Route path="/login" element={<div>Login landing</div>} />
        </Routes>
      </MemoryRouter>
    </AuthProvider>,
  )
}

function fillValidForm() {
  fireEvent.change(screen.getByLabelText('카테고리'), { target: { value: '현재완료' } })
  fireEvent.change(screen.getByLabelText('난이도'), { target: { value: 'INTERMEDIATE' } })
  fireEvent.change(screen.getByLabelText('문제 내용'), {
    target: { value: 'He has lived here _____ 2010.' },
  })
  fireEvent.change(screen.getByLabelText('보기 1'), { target: { value: 'for' } })
  fireEvent.change(screen.getByLabelText('보기 2'), { target: { value: 'since' } })
  fireEvent.change(screen.getByLabelText('보기 3'), { target: { value: 'during' } })
  fireEvent.change(screen.getByLabelText('보기 4'), { target: { value: 'from' } })
  fireEvent.change(screen.getByLabelText('정답'), { target: { value: 'since' } })
  fireEvent.change(screen.getByLabelText('해설'), {
    target: { value: '특정 시작 시점과 현재완료가 함께 쓰일 때 since를 사용합니다.' },
  })
}

const createdRawQuestion = {
  id: 1030,
  category: '현재완료',
  type: '객관식',
  level: '보통',
  status: '초안',
  text: 'He has lived here _____ 2010.',
  choices: ['for', 'since', 'during', 'from'],
  answer: 'since',
  explanation: '특정 시작 시점과 현재완료가 함께 쓰일 때 since를 사용합니다.',
  createdAt: '2026-08-07T09:00:00',
}

function emptyPageResponse() {
  return { content: [], page: 0, size: 20, totalElements: 0, totalPages: 0 }
}

describe('QuestionCreatePage', () => {
  it('renders the Phase 1 fields with MULTIPLE_CHOICE fixed as the only type option', () => {
    seedAdminSession()

    renderQuestionCreatePage()

    expect(screen.getByRole('heading', { name: '문제 추가' })).toBeDefined()

    const typeSelect = screen.getByLabelText('유형') as HTMLSelectElement
    expect(typeSelect.disabled).toBe(true)
    expect(typeSelect.value).toBe('MULTIPLE_CHOICE')
    expect(within(typeSelect).getAllByRole('option').map((option) => option.textContent)).toEqual(['객관식'])

    expect(screen.getByLabelText('보기 1')).toBeDefined()
    expect(screen.getByLabelText('보기 2')).toBeDefined()
    expect(screen.getByLabelText('보기 3')).toBeDefined()
    expect(screen.getByLabelText('보기 4')).toBeDefined()
  })

  it('blocks submission and shows field errors when required fields are missing', () => {
    const fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)
    seedAdminSession()

    renderQuestionCreatePage()
    fireEvent.click(screen.getByRole('button', { name: '문제 저장' }))

    expect(screen.getByText('카테고리를 입력하세요.')).toBeDefined()
    expect(screen.getByText('난이도를 선택하세요.')).toBeDefined()
    expect(screen.getByText('문제 내용을 입력하세요.')).toBeDefined()
    expect(screen.getByText('빈 보기가 없도록 모든 보기를 입력하세요.')).toBeDefined()
    expect(screen.getByText('정답을 선택하세요.')).toBeDefined()
    expect(screen.getByText('해설을 입력하세요.')).toBeDefined()
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('rejects an answer that no longer matches any choice (membership validation)', () => {
    const fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)
    seedAdminSession()

    renderQuestionCreatePage()
    fillValidForm()

    // Edit the choice backing the selected answer so it no longer matches.
    fireEvent.change(screen.getByLabelText('보기 2'), { target: { value: 'due to' } })
    fireEvent.click(screen.getByRole('button', { name: '문제 저장' }))

    expect(screen.getByText('정답은 보기 목록에 포함되어야 합니다.')).toBeDefined()
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('submits the payload through questionApi.createQuestion and navigates to the list with a success indication', async () => {
    const fetchSpy = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(201, createdRawQuestion))
      .mockResolvedValueOnce(jsonResponse(200, emptyPageResponse()))
    vi.stubGlobal('fetch', fetchSpy)
    seedAdminSession()

    renderQuestionCreatePage()
    fillValidForm()
    fireEvent.click(screen.getByRole('button', { name: '문제 저장' }))

    await waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(1))
    const [url, init] = fetchSpy.mock.calls[0]
    expect(url).toBe('/api/questions')
    expect(init.method).toBe('POST')
    expect(init.headers.Authorization).toBe('Bearer access-token-abc')
    expect(JSON.parse(init.body)).toEqual({
      category: '현재완료',
      type: '객관식',
      level: '보통',
      text: 'He has lived here _____ 2010.',
      choices: ['for', 'since', 'during', 'from'],
      answer: 'since',
      explanation: '특정 시작 시점과 현재완료가 함께 쓰일 때 since를 사용합니다.',
    })

    await waitFor(() => expect(screen.getByRole('heading', { name: '문제 관리' })).toBeDefined())
    await waitFor(() => expect(screen.getByText('문제가 등록되었습니다.')).toBeDefined())
  })

  it('shows the backend message on a 400 validation error and stays on the form', async () => {
    const fetchSpy = vi
      .fn()
      .mockResolvedValue(jsonResponse(400, { code: 'INVALID_QUESTION', message: '정답은 보기 목록에 포함되어야 합니다.' }))
    vi.stubGlobal('fetch', fetchSpy)
    seedAdminSession()

    renderQuestionCreatePage()
    fillValidForm()
    fireEvent.click(screen.getByRole('button', { name: '문제 저장' }))

    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('정답은 보기 목록에 포함되어야 합니다.'))
    expect(screen.getByRole('heading', { name: '문제 추가' })).toBeDefined()
    expect(fetchSpy).toHaveBeenCalledTimes(1)
  })

  it('shows a session-expired state on 401 and returns to /login after re-sign-in', async () => {
    const fetchSpy = vi.fn().mockResolvedValue(jsonResponse(401, { code: 'TOKEN_EXPIRED', message: '세션이 만료되었습니다.' }))
    vi.stubGlobal('fetch', fetchSpy)
    seedAdminSession()

    renderQuestionCreatePage()
    fillValidForm()
    fireEvent.click(screen.getByRole('button', { name: '문제 저장' }))

    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('세션이 만료되었습니다.'))
    fireEvent.click(screen.getByRole('button', { name: '다시 로그인' }))

    expect(screen.getByText('Login landing')).toBeDefined()
    expect(sessionStorage.getItem('grmr.auth.session')).toBeNull()
  })

  it('shows a distinct forbidden message on 403 without offering a re-sign-in action', async () => {
    const fetchSpy = vi
      .fn()
      .mockResolvedValue(jsonResponse(403, { code: 'FORBIDDEN', message: '권한이 없습니다.' }))
    vi.stubGlobal('fetch', fetchSpy)
    seedAdminSession()

    renderQuestionCreatePage()
    fillValidForm()
    fireEvent.click(screen.getByRole('button', { name: '문제 저장' }))

    await waitFor(() =>
      expect(screen.getByRole('alert').textContent).toContain('문제를 생성할 권한이 없습니다.'),
    )
    expect(screen.queryByRole('button', { name: '다시 로그인' })).toBeNull()
    expect(screen.getByRole('heading', { name: '문제 추가' })).toBeDefined()
  })
})
