import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AuthProvider } from '../auth/AuthContext'
import AssignmentCreatePage from './AssignmentCreatePage'

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

function renderAssignmentCreatePage() {
  render(
    <AuthProvider>
      <MemoryRouter initialEntries={['/admin/assignments/new']}>
        <Routes>
          <Route path="/admin/assignments/new" element={<AssignmentCreatePage />} />
          <Route path="/admin/assignments/:id" element={<div>Assignment detail landing</div>} />
          <Route path="/admin/assignments" element={<div>Assignment list landing</div>} />
          <Route path="/login" element={<div>Login landing</div>} />
        </Routes>
      </MemoryRouter>
    </AuthProvider>,
  )
}

const rawQuestionA = {
  id: 101,
  category: '현재완료',
  type: '객관식',
  level: '보통',
  status: '사용 중',
  text: 'Question A text',
}

const rawQuestionB = {
  id: 102,
  category: '수동태',
  type: '객관식',
  level: '기초',
  status: '사용 중',
  text: 'Question B text',
}

function questionPageResponse(content: unknown[], overrides: Partial<Record<string, unknown>> = {}) {
  return {
    content,
    page: 0,
    size: 10,
    totalElements: content.length,
    totalPages: content.length > 0 ? 1 : 0,
    ...overrides,
  }
}

async function waitForQuestionSearchToLoad() {
  await waitFor(() => expect(screen.queryByRole('status')).toBeNull())
}

function fillCommonFields() {
  fireEvent.change(screen.getByLabelText('과제명'), { target: { value: '현재완료 시제 연습' } })
  fireEvent.change(screen.getByLabelText('반 이름'), { target: { value: '중1 A반' } })
  fireEvent.change(screen.getByLabelText('시작일'), { target: { value: '2026-08-08' } })
  fireEvent.change(screen.getByLabelText('마감일'), { target: { value: '2026-08-10' } })
}

describe('AssignmentCreatePage', () => {
  it('renders the create form fields with CLASS as the default target type', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(200, questionPageResponse([]))))
    seedAdminSession()

    renderAssignmentCreatePage()

    expect(screen.getByRole('heading', { name: '과제 추가' })).toBeDefined()
    expect(screen.getByLabelText('과제명')).toBeDefined()
    expect((screen.getByLabelText('대상 유형') as HTMLSelectElement).value).toBe('CLASS')
    expect(screen.getByLabelText('반 이름')).toBeDefined()
    expect(screen.queryByLabelText('학생 ID')).toBeNull()
    expect(screen.getByLabelText('시작일')).toBeDefined()
    expect(screen.getByLabelText('마감일')).toBeDefined()
    expect(screen.getByRole('heading', { name: '문제 검색' })).toBeDefined()
    expect(screen.getByRole('heading', { name: '선택한 문제 (0개)' })).toBeDefined()

    await waitForQuestionSearchToLoad()
  })

  it('blocks submission and shows field errors when required fields are missing', async () => {
    const fetchSpy = vi.fn().mockResolvedValue(jsonResponse(200, questionPageResponse([])))
    vi.stubGlobal('fetch', fetchSpy)
    seedAdminSession()

    renderAssignmentCreatePage()
    await waitForQuestionSearchToLoad()

    fireEvent.click(screen.getByRole('button', { name: '과제 저장' }))

    expect(screen.getByText('과제명을 입력하세요.')).toBeDefined()
    expect(screen.getByText('반 이름을 입력하세요.')).toBeDefined()
    expect(screen.getByText('시작일을 선택하세요.')).toBeDefined()
    expect(screen.getByText('마감일을 선택하세요.')).toBeDefined()
    expect(screen.getByText('문제를 1개 이상 선택하세요.')).toBeDefined()
    expect(fetchSpy).toHaveBeenCalledTimes(1)
  })

  it('shows a date-range error when the start date is after the due date', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(200, questionPageResponse([]))))
    seedAdminSession()

    renderAssignmentCreatePage()
    await waitForQuestionSearchToLoad()

    fireEvent.change(screen.getByLabelText('시작일'), { target: { value: '2026-08-10' } })
    fireEvent.change(screen.getByLabelText('마감일'), { target: { value: '2026-08-08' } })
    fireEvent.click(screen.getByRole('button', { name: '과제 저장' }))

    expect(screen.getByText('시작일은 마감일보다 늦을 수 없습니다.')).toBeDefined()
  })

  it('toggling target type clears the opposite target field and its error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(200, questionPageResponse([]))))
    seedAdminSession()

    renderAssignmentCreatePage()
    await waitForQuestionSearchToLoad()

    fireEvent.change(screen.getByLabelText('반 이름'), { target: { value: '중1 A반' } })
    fireEvent.change(screen.getByLabelText('대상 유형'), { target: { value: 'STUDENT' } })

    expect(screen.queryByLabelText('반 이름')).toBeNull()
    expect((screen.getByLabelText('학생 ID') as HTMLInputElement).value).toBe('')

    fireEvent.click(screen.getByRole('button', { name: '과제 저장' }))
    expect(screen.getByText('유효한 학생 ID를 입력하세요.')).toBeDefined()

    fireEvent.change(screen.getByLabelText('대상 유형'), { target: { value: 'CLASS' } })

    expect(screen.queryByLabelText('학생 ID')).toBeNull()
    expect((screen.getByLabelText('반 이름') as HTMLInputElement).value).toBe('')
    expect(screen.queryByText('유효한 학생 ID를 입력하세요.')).toBeNull()
  })

  it('sends the applied question filters as query params when searching', async () => {
    const fetchSpy = vi.fn().mockResolvedValue(jsonResponse(200, questionPageResponse([])))
    vi.stubGlobal('fetch', fetchSpy)
    seedAdminSession()

    renderAssignmentCreatePage()
    await waitForQuestionSearchToLoad()
    expect(fetchSpy).toHaveBeenCalledTimes(1)
    expect(fetchSpy.mock.calls[0][0]).toBe('/api/questions?page=0&size=10')

    fireEvent.change(screen.getByLabelText('카테고리'), { target: { value: '현재완료' } })
    fireEvent.change(screen.getByLabelText('난이도'), { target: { value: 'INTERMEDIATE' } })
    fireEvent.click(screen.getByRole('button', { name: '검색' }))

    await waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(2))
    expect(fetchSpy.mock.calls[1][0]).toBe(
      '/api/questions?category=%ED%98%84%EC%9E%AC%EC%99%84%EB%A3%8C&level=%EB%B3%B4%ED%86%B5&page=0&size=10',
    )
  })

  // Regression test: the question-search controls must never be able to
  // trigger the outer create-assignment submission. They previously lived in
  // a nested <form>, and even though preventDefault() stopped the browser's
  // own navigation, the native "submit" event still bubbled up through the
  // DOM to the outer <form>'s onSubmit — silently POSTing /api/assignments
  // whenever the top-level fields already happened to be valid.
  it('never submits the assignment when searching questions, even with valid top-level fields', async () => {
    const fetchSpy = vi.fn().mockResolvedValue(jsonResponse(200, questionPageResponse([rawQuestionA])))
    vi.stubGlobal('fetch', fetchSpy)
    seedAdminSession()

    renderAssignmentCreatePage()
    await waitFor(() => expect(screen.getByText('Question A text')).toBeDefined())

    fillCommonFields()
    const searchTable = screen.getByRole('table', { name: '문제 검색 결과' })
    fireEvent.click(within(searchTable).getByRole('button', { name: '추가' }))

    fireEvent.change(screen.getByLabelText('카테고리'), { target: { value: '현재완료' } })
    fireEvent.click(screen.getByRole('button', { name: '검색' }))

    await waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(2))
    expect(fetchSpy.mock.calls.every(([url]) => String(url).startsWith('/api/questions'))).toBe(true)
    expect(screen.queryByText('Assignment detail landing')).toBeNull()

    fireEvent.change(screen.getByLabelText('키워드'), { target: { value: 'lived' } })
    fireEvent.keyDown(screen.getByLabelText('키워드'), { key: 'Enter' })
    await waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(3))
    expect(fetchSpy.mock.calls.every(([url]) => String(url).startsWith('/api/questions'))).toBe(true)
    expect(screen.queryByText('Assignment detail landing')).toBeNull()
  })

  it('supports adding, reordering, and removing selected questions', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(jsonResponse(200, questionPageResponse([rawQuestionA, rawQuestionB]))),
    )
    seedAdminSession()

    renderAssignmentCreatePage()
    await waitFor(() => expect(screen.getByText('Question A text')).toBeDefined())

    const searchTable = screen.getByRole('table', { name: '문제 검색 결과' })
    const addButtons = within(searchTable).getAllByRole('button', { name: '추가' })
    fireEvent.click(addButtons[0])
    fireEvent.click(within(searchTable).getByRole('button', { name: '추가' }))

    expect(screen.getByRole('heading', { name: '선택한 문제 (2개)' })).toBeDefined()

    const selectedTable = screen.getByRole('table', { name: '선택한 문제 목록' })
    const selectedRows = within(selectedTable).getAllByRole('row').slice(1)
    expect(within(selectedRows[0]).getByText('Question A text')).toBeDefined()
    expect(within(selectedRows[1]).getByText('Question B text')).toBeDefined()

    fireEvent.click(screen.getByRole('button', { name: 'Question A text 아래로 이동' }))

    const reorderedRows = within(selectedTable).getAllByRole('row').slice(1)
    expect(within(reorderedRows[0]).getByText('Question B text')).toBeDefined()
    expect(within(reorderedRows[1]).getByText('Question A text')).toBeDefined()

    fireEvent.click(screen.getByRole('button', { name: 'Question B text 삭제' }))

    expect(screen.getByRole('heading', { name: '선택한 문제 (1개)' })).toBeDefined()
    expect(within(searchTable).getAllByRole('button', { name: '추가' })).toHaveLength(1)
  })

  it('submits with the CLASS target and the exact selected question order, then navigates to the created detail page', async () => {
    const fetchSpy = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(200, questionPageResponse([rawQuestionA, rawQuestionB])))
      .mockResolvedValueOnce(
        jsonResponse(201, {
          id: 4,
          title: '현재완료 시제 연습',
          targetType: 'CLASS',
          targetGroup: '중1 A반',
          target: '중1 A반',
          startDate: '2026-08-08',
          dueDate: '2026-08-10',
          status: '예정',
          progress: 0,
        }),
      )
    vi.stubGlobal('fetch', fetchSpy)
    seedAdminSession()

    renderAssignmentCreatePage()
    await waitFor(() => expect(screen.getByText('Question A text')).toBeDefined())

    const searchTable = screen.getByRole('table', { name: '문제 검색 결과' })
    const rows = within(searchTable).getAllByRole('row').slice(1)
    fireEvent.click(within(rows[1]).getByRole('button', { name: '추가' }))
    fireEvent.click(within(rows[0]).getByRole('button', { name: '추가' }))

    fillCommonFields()
    fireEvent.click(screen.getByRole('button', { name: '과제 저장' }))

    await waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(2))
    const [url, init] = fetchSpy.mock.calls[1]
    expect(url).toBe('/api/assignments')
    expect(init.method).toBe('POST')
    expect(init.headers.Authorization).toBe('Bearer access-token-abc')
    expect(JSON.parse(init.body)).toEqual({
      title: '현재완료 시제 연습',
      targetType: 'CLASS',
      targetGroup: '중1 A반',
      startDate: '2026-08-08',
      dueDate: '2026-08-10',
      questionIds: [102, 101],
    })

    await waitFor(() => expect(screen.getByText('Assignment detail landing')).toBeDefined())
  })

  it('submits with the STUDENT target using a numeric id', async () => {
    const fetchSpy = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(200, questionPageResponse([rawQuestionA])))
      .mockResolvedValueOnce(
        jsonResponse(201, {
          id: 5,
          title: '보강 과제',
          targetType: 'STUDENT',
          targetStudentId: 501,
          target: '김민수',
          startDate: '2026-08-08',
          dueDate: '2026-08-10',
          status: '예정',
          progress: 0,
        }),
      )
    vi.stubGlobal('fetch', fetchSpy)
    seedAdminSession()

    renderAssignmentCreatePage()
    await waitFor(() => expect(screen.getByText('Question A text')).toBeDefined())

    fireEvent.click(screen.getByRole('button', { name: '추가' }))

    fireEvent.change(screen.getByLabelText('과제명'), { target: { value: '보강 과제' } })
    fireEvent.change(screen.getByLabelText('대상 유형'), { target: { value: 'STUDENT' } })
    fireEvent.change(screen.getByLabelText('학생 ID'), { target: { value: '501' } })
    fireEvent.change(screen.getByLabelText('시작일'), { target: { value: '2026-08-08' } })
    fireEvent.change(screen.getByLabelText('마감일'), { target: { value: '2026-08-10' } })
    fireEvent.click(screen.getByRole('button', { name: '과제 저장' }))

    await waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(2))
    const [, init] = fetchSpy.mock.calls[1]
    expect(JSON.parse(init.body)).toEqual({
      title: '보강 과제',
      targetType: 'STUDENT',
      targetStudentId: 501,
      startDate: '2026-08-08',
      dueDate: '2026-08-10',
      questionIds: [101],
    })

    await waitFor(() => expect(screen.getByText('Assignment detail landing')).toBeDefined())
  })

  it('shows the backend message on a 400 validation error and stays on the form', async () => {
    const fetchSpy = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(200, questionPageResponse([rawQuestionA])))
      .mockResolvedValueOnce(
        jsonResponse(400, { code: 'INVALID_ASSIGNMENT', message: '시작일은 마감일보다 늦을 수 없습니다.' }),
      )
    vi.stubGlobal('fetch', fetchSpy)
    seedAdminSession()

    renderAssignmentCreatePage()
    await waitFor(() => expect(screen.getByText('Question A text')).toBeDefined())
    fireEvent.click(screen.getByRole('button', { name: '추가' }))
    fillCommonFields()

    fireEvent.click(screen.getByRole('button', { name: '과제 저장' }))

    await waitFor(() =>
      expect(screen.getByRole('alert').textContent).toContain('시작일은 마감일보다 늦을 수 없습니다.'),
    )
    expect(screen.getByRole('heading', { name: '과제 추가' })).toBeDefined()
  })

  it('shows a session-expired state on 401 and returns to /login after re-sign-in', async () => {
    const fetchSpy = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(200, questionPageResponse([rawQuestionA])))
      .mockResolvedValueOnce(jsonResponse(401, { code: 'TOKEN_EXPIRED', message: '세션이 만료되었습니다.' }))
    vi.stubGlobal('fetch', fetchSpy)
    seedAdminSession()

    renderAssignmentCreatePage()
    await waitFor(() => expect(screen.getByText('Question A text')).toBeDefined())
    fireEvent.click(screen.getByRole('button', { name: '추가' }))
    fillCommonFields()

    fireEvent.click(screen.getByRole('button', { name: '과제 저장' }))

    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('세션이 만료되었습니다.'))
    fireEvent.click(screen.getByRole('button', { name: '다시 로그인' }))

    expect(screen.getByText('Login landing')).toBeDefined()
    expect(sessionStorage.getItem('grmr.auth.session')).toBeNull()
  })

  it('shows a distinct forbidden message on 403 without offering a re-sign-in action', async () => {
    const fetchSpy = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(200, questionPageResponse([rawQuestionA])))
      .mockResolvedValueOnce(jsonResponse(403, { code: 'FORBIDDEN', message: '권한이 없습니다.' }))
    vi.stubGlobal('fetch', fetchSpy)
    seedAdminSession()

    renderAssignmentCreatePage()
    await waitFor(() => expect(screen.getByText('Question A text')).toBeDefined())
    fireEvent.click(screen.getByRole('button', { name: '추가' }))
    fillCommonFields()

    fireEvent.click(screen.getByRole('button', { name: '과제 저장' }))

    await waitFor(() =>
      expect(screen.getByRole('alert').textContent).toContain('과제를 생성할 권한이 없습니다.'),
    )
    expect(screen.queryByRole('button', { name: '다시 로그인' })).toBeNull()
    expect(screen.getByRole('heading', { name: '과제 추가' })).toBeDefined()
  })

  it('shows the backend message on a 404 not-found error (e.g. missing question or student)', async () => {
    const fetchSpy = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(200, questionPageResponse([rawQuestionA])))
      .mockResolvedValueOnce(jsonResponse(404, { code: 'QUESTION_NOT_FOUND', message: '문제를 찾을 수 없습니다.' }))
    vi.stubGlobal('fetch', fetchSpy)
    seedAdminSession()

    renderAssignmentCreatePage()
    await waitFor(() => expect(screen.getByText('Question A text')).toBeDefined())
    fireEvent.click(screen.getByRole('button', { name: '추가' }))
    fillCommonFields()

    fireEvent.click(screen.getByRole('button', { name: '과제 저장' }))

    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('문제를 찾을 수 없습니다.'))
    expect(screen.getByRole('heading', { name: '과제 추가' })).toBeDefined()
  })
})
