import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AuthProvider } from '../auth/AuthContext'
import AssignmentEditPage from './AssignmentEditPage'

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

function renderAssignmentEditPage(initialEntry = '/admin/assignments/7/edit') {
  render(
    <AuthProvider>
      <MemoryRouter initialEntries={[initialEntry]}>
        <Routes>
          <Route path="/admin/assignments/:id/edit" element={<AssignmentEditPage />} />
          <Route path="/admin/assignments/:id" element={<div>Assignment detail landing</div>} />
          <Route path="/admin/assignments" element={<div>Assignment list landing</div>} />
          <Route path="/login" element={<div>Login landing</div>} />
        </Routes>
      </MemoryRouter>
    </AuthProvider>,
  )
}

const rawAssignmentClass = {
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

const rawAssignmentStudent = {
  id: 9,
  title: '보강 과제',
  targetType: 'STUDENT',
  targetStudentId: 501,
  target: '김민수',
  startDate: '2026-08-14',
  dueDate: '2026-08-20',
  progress: 0,
  status: '예정',
  questions: [{ id: 101, order: 1, text: 'He has lived here _____ 2010.', category: '현재완료' }],
}

const rawQuestionA = {
  id: 301,
  category: '수동태',
  type: '객관식',
  level: '보통',
  status: '사용 중',
  text: 'Question A text',
}

const rawQuestionB = {
  id: 302,
  category: '가정법',
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

async function waitForLoadToFinish() {
  await waitFor(() => expect(screen.queryByRole('status')).toBeNull())
}

describe('AssignmentEditPage', () => {
  it('loads the assignment and pre-fills the form with title read-only and questions ordered', async () => {
    const fetchSpy = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(200, rawAssignmentClass))
      .mockResolvedValueOnce(jsonResponse(200, questionPageResponse([])))
    vi.stubGlobal('fetch', fetchSpy)
    seedAdminSession()

    renderAssignmentEditPage()
    await waitForLoadToFinish()

    expect(screen.getByRole('heading', { name: '과제 수정' })).toBeDefined()
    expect(screen.getByText('현재완료 시제 연습')).toBeDefined()
    expect(screen.queryByLabelText('과제명')).toBeNull()
    expect((screen.getByLabelText('대상 유형') as HTMLSelectElement).value).toBe('CLASS')
    expect((screen.getByLabelText('반 이름') as HTMLInputElement).value).toBe('중1 A반')
    expect((screen.getByLabelText('시작일') as HTMLInputElement).value).toBe('2026-08-03')
    expect((screen.getByLabelText('마감일') as HTMLInputElement).value).toBe('2026-08-10')

    const selectedTable = screen.getByRole('table', { name: '선택한 문제 목록' })
    const rows = within(selectedTable).getAllByRole('row').slice(1)
    expect(within(rows[0]).getByText('He has lived here _____ 2010.')).toBeDefined()
    expect(within(rows[1]).getByText('She _____ here since 2020.')).toBeDefined()
  })

  it('pre-fills STUDENT target details', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(jsonResponse(200, rawAssignmentStudent))
        .mockResolvedValueOnce(jsonResponse(200, questionPageResponse([]))),
    )
    seedAdminSession()

    renderAssignmentEditPage('/admin/assignments/9/edit')
    await waitForLoadToFinish()

    expect((screen.getByLabelText('대상 유형') as HTMLSelectElement).value).toBe('STUDENT')
    expect((screen.getByLabelText('학생 ID') as HTMLInputElement).value).toBe('501')
  })

  it('toggling target type clears the opposite target field', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(jsonResponse(200, rawAssignmentClass))
        .mockResolvedValueOnce(jsonResponse(200, questionPageResponse([]))),
    )
    seedAdminSession()

    renderAssignmentEditPage()
    await waitForLoadToFinish()

    fireEvent.change(screen.getByLabelText('대상 유형'), { target: { value: 'STUDENT' } })

    expect(screen.queryByLabelText('반 이름')).toBeNull()
    expect((screen.getByLabelText('학생 ID') as HTMLInputElement).value).toBe('')

    fireEvent.change(screen.getByLabelText('대상 유형'), { target: { value: 'CLASS' } })
    expect((screen.getByLabelText('반 이름') as HTMLInputElement).value).toBe('')
  })

  it('supports adding, reordering, and removing selected questions via the search results', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(jsonResponse(200, rawAssignmentClass))
        .mockResolvedValueOnce(jsonResponse(200, questionPageResponse([rawQuestionA, rawQuestionB]))),
    )
    seedAdminSession()

    renderAssignmentEditPage()
    await waitForLoadToFinish()

    const searchTable = screen.getByRole('table', { name: '문제 검색 결과' })
    fireEvent.click(within(searchTable).getAllByRole('button', { name: '추가' })[0])

    expect(screen.getByRole('heading', { name: '선택한 문제 (3개)' })).toBeDefined()

    fireEvent.click(screen.getByRole('button', { name: 'Question A text 위로 이동' }))
    const selectedTable = screen.getByRole('table', { name: '선택한 문제 목록' })
    const rows = within(selectedTable).getAllByRole('row').slice(1)
    expect(within(rows[1]).getByText('Question A text')).toBeDefined()

    fireEvent.click(screen.getByRole('button', { name: 'Question A text 삭제' }))
    expect(screen.getByRole('heading', { name: '선택한 문제 (2개)' })).toBeDefined()
  })

  it('submits the PATCH payload with target, dates, and exact question order, then navigates to detail', async () => {
    const fetchSpy = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(200, rawAssignmentClass))
      .mockResolvedValueOnce(jsonResponse(200, questionPageResponse([])))
      .mockResolvedValueOnce(jsonResponse(200, { ...rawAssignmentClass, dueDate: '2026-08-12' }))
    vi.stubGlobal('fetch', fetchSpy)
    seedAdminSession()

    renderAssignmentEditPage()
    await waitForLoadToFinish()

    fireEvent.change(screen.getByLabelText('마감일'), { target: { value: '2026-08-12' } })
    fireEvent.click(screen.getByRole('button', { name: '변경 사항 저장' }))

    await waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(3))
    const [url, init] = fetchSpy.mock.calls[2]
    expect(url).toBe('/api/assignments/7')
    expect(init.method).toBe('PATCH')
    expect(init.headers.Authorization).toBe('Bearer access-token-abc')
    expect(JSON.parse(init.body)).toEqual({
      targetType: 'CLASS',
      targetGroup: '중1 A반',
      startDate: '2026-08-03',
      dueDate: '2026-08-12',
      questionIds: [101, 202],
    })

    await waitFor(() => expect(screen.getByText('Assignment detail landing')).toBeDefined())
  })

  it('submits the STUDENT target using a numeric id', async () => {
    const fetchSpy = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(200, rawAssignmentStudent))
      .mockResolvedValueOnce(jsonResponse(200, questionPageResponse([])))
      .mockResolvedValueOnce(jsonResponse(200, rawAssignmentStudent))
    vi.stubGlobal('fetch', fetchSpy)
    seedAdminSession()

    renderAssignmentEditPage('/admin/assignments/9/edit')
    await waitForLoadToFinish()

    fireEvent.click(screen.getByRole('button', { name: '변경 사항 저장' }))

    await waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(3))
    const [, init] = fetchSpy.mock.calls[2]
    expect(JSON.parse(init.body)).toEqual({
      targetType: 'STUDENT',
      targetStudentId: 501,
      startDate: '2026-08-14',
      dueDate: '2026-08-20',
      questionIds: [101],
    })
  })

  it('blocks submission and shows field errors when the target or questions become invalid', async () => {
    const fetchSpy = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(200, rawAssignmentClass))
      .mockResolvedValueOnce(jsonResponse(200, questionPageResponse([])))
    vi.stubGlobal('fetch', fetchSpy)
    seedAdminSession()

    renderAssignmentEditPage()
    await waitForLoadToFinish()

    fireEvent.change(screen.getByLabelText('반 이름'), { target: { value: '' } })
    fireEvent.click(screen.getByRole('button', { name: 'She _____ here since 2020. 삭제' }))
    fireEvent.click(screen.getByRole('button', { name: 'He has lived here _____ 2010. 삭제' }))
    fireEvent.click(screen.getByRole('button', { name: '변경 사항 저장' }))

    expect(screen.getByText('반 이름을 입력하세요.')).toBeDefined()
    expect(screen.getByText('문제를 1개 이상 선택하세요.')).toBeDefined()
    expect(fetchSpy).toHaveBeenCalledTimes(2)
  })

  it('shows the backend 409 message clearly for a closed assignment and does not navigate away', async () => {
    const fetchSpy = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(200, rawAssignmentClass))
      .mockResolvedValueOnce(jsonResponse(200, questionPageResponse([])))
      .mockResolvedValueOnce(
        jsonResponse(409, { code: 'ASSIGNMENT_ALREADY_CLOSED', message: '마감된 과제는 수정할 수 없습니다.' }),
      )
    vi.stubGlobal('fetch', fetchSpy)
    seedAdminSession()

    renderAssignmentEditPage()
    await waitForLoadToFinish()

    fireEvent.click(screen.getByRole('button', { name: '변경 사항 저장' }))

    await waitFor(() =>
      expect(screen.getByRole('alert').textContent).toContain('마감된 과제는 수정할 수 없습니다.'),
    )
    expect(screen.getByRole('heading', { name: '과제 수정' })).toBeDefined()
    expect(screen.queryByText('Assignment detail landing')).toBeNull()
  })

  it('shows a session-expired state on submit 401 and returns to /login after re-sign-in', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(jsonResponse(200, rawAssignmentClass))
        .mockResolvedValueOnce(jsonResponse(200, questionPageResponse([])))
        .mockResolvedValueOnce(jsonResponse(401, { code: 'TOKEN_EXPIRED', message: '세션이 만료되었습니다.' })),
    )
    seedAdminSession()

    renderAssignmentEditPage()
    await waitForLoadToFinish()

    fireEvent.click(screen.getByRole('button', { name: '변경 사항 저장' }))

    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('세션이 만료되었습니다.'))
    fireEvent.click(screen.getByRole('button', { name: '다시 로그인' }))

    expect(screen.getByText('Login landing')).toBeDefined()
    expect(sessionStorage.getItem('grmr.auth.session')).toBeNull()
  })

  it('shows a forbidden message on submit 403', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(jsonResponse(200, rawAssignmentClass))
        .mockResolvedValueOnce(jsonResponse(200, questionPageResponse([])))
        .mockResolvedValueOnce(jsonResponse(403, { code: 'FORBIDDEN', message: '권한이 없습니다.' })),
    )
    seedAdminSession()

    renderAssignmentEditPage()
    await waitForLoadToFinish()

    fireEvent.click(screen.getByRole('button', { name: '변경 사항 저장' }))

    await waitFor(() =>
      expect(screen.getByRole('alert').textContent).toContain('과제를 수정할 권한이 없습니다.'),
    )
  })

  it('cancel button navigates back to the detail page without submitting', async () => {
    const fetchSpy = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(200, rawAssignmentClass))
      .mockResolvedValueOnce(jsonResponse(200, questionPageResponse([])))
    vi.stubGlobal('fetch', fetchSpy)
    seedAdminSession()

    renderAssignmentEditPage()
    await waitForLoadToFinish()

    fireEvent.click(screen.getByRole('button', { name: '취소' }))

    expect(screen.getByText('Assignment detail landing')).toBeDefined()
    expect(fetchSpy).toHaveBeenCalledTimes(2)
  })

  it('shows a not-found state on load 404 without rendering the form', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(jsonResponse(404, { code: 'ASSIGNMENT_NOT_FOUND', message: '과제를 찾을 수 없습니다.' })),
    )
    seedAdminSession()

    renderAssignmentEditPage()

    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('과제를 찾을 수 없습니다.'))
    expect(screen.queryByRole('form', { name: '과제 수정' })).toBeNull()
  })

  it('shows a session-expired state on load 401', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(jsonResponse(401, { code: 'TOKEN_EXPIRED', message: '세션이 만료되었습니다.' })),
    )
    seedAdminSession()

    renderAssignmentEditPage()

    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('세션이 만료되었습니다.'))
    fireEvent.click(screen.getByRole('button', { name: '다시 로그인' }))
    expect(screen.getByText('Login landing')).toBeDefined()
  })

  it('shows a forbidden state on load 403', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(403, { code: 'FORBIDDEN', message: '권한이 없습니다.' })))
    seedAdminSession()

    renderAssignmentEditPage()

    await waitFor(() =>
      expect(screen.getByRole('alert').textContent).toContain('과제를 조회할 권한이 없습니다.'),
    )
  })

  it('shows an invalid-ID state without calling the API when the route ID is not a positive integer', async () => {
    const fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)
    seedAdminSession()

    renderAssignmentEditPage('/admin/assignments/abc/edit')

    expect(screen.getByRole('alert').textContent).toContain('잘못된 과제 번호입니다.')
    expect(fetchSpy).not.toHaveBeenCalled()
  })
})
