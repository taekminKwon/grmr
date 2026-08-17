import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AuthProvider } from '../auth/AuthContext'
import AppRoutes from './AppRoutes'

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

function renderAt(path: string) {
  render(
    <AuthProvider>
      <MemoryRouter initialEntries={[path]}>
        <AppRoutes />
      </MemoryRouter>
    </AuthProvider>,
  )
}

function seedAdminSession() {
  sessionStorage.setItem(
    'grmr.auth.session',
    JSON.stringify({ accessToken: 'access-token', user: { name: '권태민', role: 'ADMIN' } }),
  )
}

function seedStudentSession() {
  sessionStorage.setItem(
    'grmr.auth.session',
    JSON.stringify({ accessToken: 'access-token', user: { name: '김학생', role: 'STUDENT' } }),
  )
}

describe('AppRoutes', () => {
  it('renders the login page at /login', () => {
    renderAt('/login')

    expect(screen.getByRole('heading', { name: 'Sign in' })).toBeDefined()
  })

  it('deterministically redirects the initial root path to /login', () => {
    renderAt('/')

    expect(screen.getByRole('heading', { name: 'Sign in' })).toBeDefined()
  })

  it('deterministically falls back to /login for unknown routes', () => {
    renderAt('/does-not-exist')

    expect(screen.getByRole('heading', { name: 'Sign in' })).toBeDefined()
  })

  it('redirects unauthenticated access to /admin back to /login', () => {
    renderAt('/admin')

    expect(screen.getByRole('heading', { name: 'Sign in' })).toBeDefined()
  })

  it('restores the session from sessionStorage and shows the admin landing page', () => {
    seedAdminSession()

    renderAt('/admin')

    expect(screen.getByRole('heading', { name: 'Admin' })).toBeDefined()
    expect(screen.getByText('권태민님, 환영합니다.')).toBeDefined()
  })

  it('logs out, clears the session, and returns to /login', () => {
    seedAdminSession()

    renderAt('/admin')
    fireEvent.click(screen.getByRole('button', { name: 'Log out' }))

    expect(screen.getByRole('heading', { name: 'Sign in' })).toBeDefined()
    expect(sessionStorage.getItem('grmr.auth.session')).toBeNull()
  })

  it('renders a forbidden state for an authenticated STUDENT at /admin', () => {
    seedStudentSession()

    renderAt('/admin')

    expect(screen.getByRole('heading', { name: '접근 권한이 없습니다' })).toBeDefined()
    expect(screen.queryByRole('heading', { name: 'Admin' })).toBeNull()
  })

  it('redirects unauthenticated access to /student back to /login', () => {
    renderAt('/student')

    expect(screen.getByRole('heading', { name: 'Sign in' })).toBeDefined()
  })

  it('restores the session from sessionStorage and shows the student landing page', () => {
    seedStudentSession()

    renderAt('/student')

    expect(screen.getByRole('heading', { name: 'Student' })).toBeDefined()
    expect(screen.getByText('김학생님, 환영합니다.')).toBeDefined()
  })

  it('renders a forbidden state for an authenticated ADMIN at /student', () => {
    seedAdminSession()

    renderAt('/student')

    expect(screen.getByRole('heading', { name: '접근 권한이 없습니다' })).toBeDefined()
    expect(screen.queryByRole('heading', { name: 'Student' })).toBeNull()
  })

  it('renders a forbidden state at /student when the session role is missing or invalid', () => {
    sessionStorage.setItem(
      'grmr.auth.session',
      JSON.stringify({ accessToken: 'access-token', user: { name: '알수없음', role: 'BOGUS' } }),
    )

    renderAt('/student')

    expect(screen.getByRole('heading', { name: '접근 권한이 없습니다' })).toBeDefined()
  })

  it('shows 내 과제, Practice, and My Study links for a STUDENT, with no admin navigation', () => {
    seedStudentSession()

    renderAt('/student')

    expect(screen.getByRole('link', { name: '내 과제' }).getAttribute('href')).toBe('/student/assignments')
    expect(screen.getByRole('link', { name: 'Practice' }).getAttribute('href')).toBe('/student/practice')
    expect(screen.getByRole('link', { name: 'My Study' }).getAttribute('href')).toBe('/student/history')
    expect(screen.queryByRole('link', { name: 'Questions' })).toBeNull()
  })

  it('logs out from the student shell, clears the session, and returns to /login', () => {
    seedStudentSession()

    renderAt('/student')
    fireEvent.click(screen.getByRole('button', { name: 'Log out' }))

    expect(screen.getByRole('heading', { name: 'Sign in' })).toBeDefined()
    expect(sessionStorage.getItem('grmr.auth.session')).toBeNull()
  })

  it('redirects unauthenticated access to /admin/questions back to /login', () => {
    renderAt('/admin/questions')

    expect(screen.getByRole('heading', { name: 'Sign in' })).toBeDefined()
  })

  it('renders the Question list for an authenticated admin at /admin/questions', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        jsonResponse(200, { content: [], page: 0, size: 20, totalElements: 0, totalPages: 0 }),
      ),
    )
    seedAdminSession()

    renderAt('/admin/questions')

    expect(screen.getByRole('heading', { name: '문제 관리' })).toBeDefined()
    await waitFor(() => expect(screen.getByText('조건에 맞는 문제가 없습니다.')).toBeDefined())
  })

  it('renders a forbidden state for an authenticated STUDENT at /admin/questions', () => {
    seedStudentSession()

    renderAt('/admin/questions')

    expect(screen.getByRole('heading', { name: '접근 권한이 없습니다' })).toBeDefined()
    expect(screen.queryByRole('heading', { name: '문제 관리' })).toBeNull()
  })

  it('renders a forbidden state at /admin/questions when the session role is missing or invalid', () => {
    sessionStorage.setItem(
      'grmr.auth.session',
      JSON.stringify({ accessToken: 'access-token', user: { name: '알수없음', role: 'BOGUS' } }),
    )

    renderAt('/admin/questions')

    expect(screen.getByRole('heading', { name: '접근 권한이 없습니다' })).toBeDefined()
  })

  it('redirects unauthenticated access to /admin/questions/new back to /login', () => {
    renderAt('/admin/questions/new')

    expect(screen.getByRole('heading', { name: 'Sign in' })).toBeDefined()
  })

  it('renders the Question create form for an authenticated admin at /admin/questions/new', () => {
    seedAdminSession()

    renderAt('/admin/questions/new')

    expect(screen.getByRole('heading', { name: '문제 추가' })).toBeDefined()
  })

  it('renders a forbidden state for an authenticated STUDENT at /admin/questions/new', () => {
    seedStudentSession()

    renderAt('/admin/questions/new')

    expect(screen.getByRole('heading', { name: '접근 권한이 없습니다' })).toBeDefined()
    expect(screen.queryByRole('heading', { name: '문제 추가' })).toBeNull()
  })

  it('renders a forbidden state at /admin/questions/new when the session role is missing or invalid', () => {
    sessionStorage.setItem(
      'grmr.auth.session',
      JSON.stringify({ accessToken: 'access-token', user: { name: '알수없음', role: 'BOGUS' } }),
    )

    renderAt('/admin/questions/new')

    expect(screen.getByRole('heading', { name: '접근 권한이 없습니다' })).toBeDefined()
  })

  it('redirects unauthenticated access to /admin/questions/:id back to /login', () => {
    renderAt('/admin/questions/1024')

    expect(screen.getByRole('heading', { name: 'Sign in' })).toBeDefined()
  })

  it('renders the Question detail for an authenticated admin at /admin/questions/:id', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        jsonResponse(200, {
          id: 1024,
          category: '현재완료',
          type: '객관식',
          level: '보통',
          status: '사용 중',
          text: 'He has lived here _____ 2010.',
          choices: ['for', 'since'],
          answer: 'since',
          explanation: '설명',
          createdAt: '2026-07-20T10:15:00',
        }),
      ),
    )
    seedAdminSession()

    renderAt('/admin/questions/1024')

    expect(screen.getByRole('heading', { name: '문제 상세' })).toBeDefined()
    await waitFor(() => expect(screen.getByText('He has lived here _____ 2010.')).toBeDefined())
  })

  it('renders a forbidden state for an authenticated STUDENT at /admin/questions/:id', () => {
    seedStudentSession()

    renderAt('/admin/questions/1024')

    expect(screen.getByRole('heading', { name: '접근 권한이 없습니다' })).toBeDefined()
    expect(screen.queryByRole('heading', { name: '문제 상세' })).toBeNull()
  })

  it('renders a forbidden state at /admin/questions/:id when the session role is missing or invalid', () => {
    sessionStorage.setItem(
      'grmr.auth.session',
      JSON.stringify({ accessToken: 'access-token', user: { name: '알수없음', role: 'BOGUS' } }),
    )

    renderAt('/admin/questions/1024')

    expect(screen.getByRole('heading', { name: '접근 권한이 없습니다' })).toBeDefined()
  })

  it('redirects unauthenticated access to /admin/assignments back to /login', () => {
    renderAt('/admin/assignments')

    expect(screen.getByRole('heading', { name: 'Sign in' })).toBeDefined()
  })

  it('renders the Assignment list for an authenticated admin at /admin/assignments', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        jsonResponse(200, { content: [], page: 0, size: 20, totalElements: 0, totalPages: 0 }),
      ),
    )
    seedAdminSession()

    renderAt('/admin/assignments')

    expect(screen.getByRole('heading', { name: '과제 관리' })).toBeDefined()
    await waitFor(() => expect(screen.getByText('조건에 맞는 과제가 없습니다.')).toBeDefined())
  })

  it('renders a forbidden state for an authenticated STUDENT at /admin/assignments', () => {
    seedStudentSession()

    renderAt('/admin/assignments')

    expect(screen.getByRole('heading', { name: '접근 권한이 없습니다' })).toBeDefined()
    expect(screen.queryByRole('heading', { name: '과제 관리' })).toBeNull()
  })

  it('renders a forbidden state at /admin/assignments when the session role is missing or invalid', () => {
    sessionStorage.setItem(
      'grmr.auth.session',
      JSON.stringify({ accessToken: 'access-token', user: { name: '알수없음', role: 'BOGUS' } }),
    )

    renderAt('/admin/assignments')

    expect(screen.getByRole('heading', { name: '접근 권한이 없습니다' })).toBeDefined()
  })

  it('redirects unauthenticated access to /admin/assignments/new back to /login', () => {
    renderAt('/admin/assignments/new')

    expect(screen.getByRole('heading', { name: 'Sign in' })).toBeDefined()
  })

  it('renders the Assignment create form for an authenticated admin at /admin/assignments/new', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        jsonResponse(200, { content: [], page: 0, size: 10, totalElements: 0, totalPages: 0 }),
      ),
    )
    seedAdminSession()

    renderAt('/admin/assignments/new')

    expect(screen.getByRole('heading', { name: '과제 추가' })).toBeDefined()
    await waitFor(() => expect(screen.getByText('조건에 맞는 문제가 없습니다.')).toBeDefined())
  })

  it('renders a forbidden state for an authenticated STUDENT at /admin/assignments/new', () => {
    seedStudentSession()

    renderAt('/admin/assignments/new')

    expect(screen.getByRole('heading', { name: '접근 권한이 없습니다' })).toBeDefined()
    expect(screen.queryByRole('heading', { name: '과제 추가' })).toBeNull()
  })

  it('renders a forbidden state at /admin/assignments/new when the session role is missing or invalid', () => {
    sessionStorage.setItem(
      'grmr.auth.session',
      JSON.stringify({ accessToken: 'access-token', user: { name: '알수없음', role: 'BOGUS' } }),
    )

    renderAt('/admin/assignments/new')

    expect(screen.getByRole('heading', { name: '접근 권한이 없습니다' })).toBeDefined()
  })

  it('redirects unauthenticated access to /admin/assignments/:id back to /login', () => {
    renderAt('/admin/assignments/7')

    expect(screen.getByRole('heading', { name: 'Sign in' })).toBeDefined()
  })

  it('renders the Assignment detail for an authenticated admin at /admin/assignments/:id', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        jsonResponse(200, {
          id: 7,
          title: '현재완료 시제 연습',
          targetType: 'CLASS',
          targetGroup: '중1 A반',
          target: '중1 A반',
          startDate: '2026-08-03',
          dueDate: '2026-08-10',
          progress: 40,
          status: '진행 중',
          questions: [],
        }),
      ),
    )
    seedAdminSession()

    renderAt('/admin/assignments/7')

    expect(screen.getByRole('heading', { name: '과제 상세' })).toBeDefined()
    await waitFor(() => expect(screen.getByText('현재완료 시제 연습')).toBeDefined())
  })

  it('renders a forbidden state for an authenticated STUDENT at /admin/assignments/:id', () => {
    seedStudentSession()

    renderAt('/admin/assignments/7')

    expect(screen.getByRole('heading', { name: '접근 권한이 없습니다' })).toBeDefined()
    expect(screen.queryByRole('heading', { name: '과제 상세' })).toBeNull()
  })

  it('renders a forbidden state at /admin/assignments/:id when the session role is missing or invalid', () => {
    sessionStorage.setItem(
      'grmr.auth.session',
      JSON.stringify({ accessToken: 'access-token', user: { name: '알수없음', role: 'BOGUS' } }),
    )

    renderAt('/admin/assignments/7')

    expect(screen.getByRole('heading', { name: '접근 권한이 없습니다' })).toBeDefined()
  })

  it('shows the Assignments link in the admin navigation', () => {
    seedAdminSession()

    renderAt('/admin')

    expect(screen.getByRole('link', { name: 'Assignments' }).getAttribute('href')).toBe('/admin/assignments')
  })

  it('redirects unauthenticated access to /student/assignments back to /login', () => {
    renderAt('/student/assignments')

    expect(screen.getByRole('heading', { name: 'Sign in' })).toBeDefined()
  })

  it('renders the assignment list for an authenticated STUDENT at /student/assignments', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        jsonResponse(200, { content: [], page: 0, size: 20, totalElements: 0, totalPages: 0 }),
      ),
    )
    seedStudentSession()

    renderAt('/student/assignments')

    expect(screen.getByRole('heading', { name: '내 과제' })).toBeDefined()
    await waitFor(() => expect(screen.getByText('받은 과제가 없습니다.')).toBeDefined())
  })

  it('renders a forbidden state for an authenticated ADMIN at /student/assignments', () => {
    seedAdminSession()

    renderAt('/student/assignments')

    expect(screen.getByRole('heading', { name: '접근 권한이 없습니다' })).toBeDefined()
    expect(screen.queryByRole('heading', { name: '내 과제' })).toBeNull()
  })

  it('renders a forbidden state at /student/assignments when the session role is missing or invalid', () => {
    sessionStorage.setItem(
      'grmr.auth.session',
      JSON.stringify({ accessToken: 'access-token', user: { name: '알수없음', role: 'BOGUS' } }),
    )

    renderAt('/student/assignments')

    expect(screen.getByRole('heading', { name: '접근 권한이 없습니다' })).toBeDefined()
  })

  it('redirects unauthenticated access to /student/assignments/:id back to /login', () => {
    renderAt('/student/assignments/1')

    expect(screen.getByRole('heading', { name: 'Sign in' })).toBeDefined()
  })

  it('renders the assignment solve page for an authenticated STUDENT at /student/assignments/:id', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        jsonResponse(200, {
          assignmentId: 1,
          submissionStatus: 'IN_PROGRESS',
          questions: [
            {
              id: 1024,
              order: 1,
              category: '현재완료',
              level: '보통',
              text: 'He has lived here _____ 2010.',
              choices: ['for', 'since', 'during', 'from'],
              myAnswer: null,
            },
          ],
        }),
      ),
    )
    seedStudentSession()

    renderAt('/student/assignments/1')

    await waitFor(() => expect(screen.getByRole('heading', { name: '과제 풀이' })).toBeDefined())
    expect(screen.getByText('He has lived here _____ 2010.')).toBeDefined()
  })

  it('renders a forbidden state for an authenticated ADMIN at /student/assignments/:id', () => {
    seedAdminSession()

    renderAt('/student/assignments/1')

    expect(screen.getByRole('heading', { name: '접근 권한이 없습니다' })).toBeDefined()
    expect(screen.queryByRole('heading', { name: '과제 풀이' })).toBeNull()
  })

  it('renders a forbidden state at /student/assignments/:id when the session role is missing or invalid', () => {
    sessionStorage.setItem(
      'grmr.auth.session',
      JSON.stringify({ accessToken: 'access-token', user: { name: '알수없음', role: 'BOGUS' } }),
    )

    renderAt('/student/assignments/1')

    expect(screen.getByRole('heading', { name: '접근 권한이 없습니다' })).toBeDefined()
  })

  it('redirects unauthenticated access to /student/assignments/:id/result back to /login', () => {
    renderAt('/student/assignments/1/result')

    expect(screen.getByRole('heading', { name: 'Sign in' })).toBeDefined()
  })

  it('renders the assignment result page for an authenticated STUDENT at /student/assignments/:id/result', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        jsonResponse(200, {
          assignmentId: 1,
          submissionStatus: 'SUBMITTED',
          submittedAt: '2026-08-15T10:00:00',
          totalQuestions: 1,
          answeredQuestions: 1,
          correctCount: 1,
          score: 100,
          results: [
            { questionId: 1024, submittedAnswer: 'since', correct: true, correctAnswer: 'since', explanation: '설명' },
          ],
        }),
      ),
    )
    seedStudentSession()

    renderAt('/student/assignments/1/result')

    expect(screen.getByRole('heading', { name: '과제 결과' })).toBeDefined()
    await waitFor(() => expect(screen.getByText('100점')).toBeDefined())
  })

  it('renders a forbidden state for an authenticated ADMIN at /student/assignments/:id/result', () => {
    seedAdminSession()

    renderAt('/student/assignments/1/result')

    expect(screen.getByRole('heading', { name: '접근 권한이 없습니다' })).toBeDefined()
    expect(screen.queryByRole('heading', { name: '과제 결과' })).toBeNull()
  })

  it('renders a forbidden state at /student/assignments/:id/result when the session role is missing or invalid', () => {
    sessionStorage.setItem(
      'grmr.auth.session',
      JSON.stringify({ accessToken: 'access-token', user: { name: '알수없음', role: 'BOGUS' } }),
    )

    renderAt('/student/assignments/1/result')

    expect(screen.getByRole('heading', { name: '접근 권한이 없습니다' })).toBeDefined()
  })

  it('redirects unauthenticated access to /student/practice back to /login', () => {
    renderAt('/student/practice')

    expect(screen.getByRole('heading', { name: 'Sign in' })).toBeDefined()
  })

  it('renders the Practice page for an authenticated STUDENT at /student/practice', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        jsonResponse(200, {
          id: 2001,
          category: '현재완료',
          type: '객관식',
          level: '보통',
          text: 'He has lived here _____ 2010.',
          choices: ['for', 'since', 'during', 'from'],
        }),
      ),
    )
    seedStudentSession()

    renderAt('/student/practice')

    expect(screen.getByRole('heading', { name: 'Practice' })).toBeDefined()
    await waitFor(() => expect(screen.getByText('He has lived here _____ 2010.')).toBeDefined())
  })

  it('renders a forbidden state for an authenticated ADMIN at /student/practice', () => {
    seedAdminSession()

    renderAt('/student/practice')

    expect(screen.getByRole('heading', { name: '접근 권한이 없습니다' })).toBeDefined()
    expect(screen.queryByRole('heading', { name: 'Practice' })).toBeNull()
  })

  it('renders a forbidden state at /student/practice when the session role is missing or invalid', () => {
    sessionStorage.setItem(
      'grmr.auth.session',
      JSON.stringify({ accessToken: 'access-token', user: { name: '알수없음', role: 'BOGUS' } }),
    )

    renderAt('/student/practice')

    expect(screen.getByRole('heading', { name: '접근 권한이 없습니다' })).toBeDefined()
  })

  it('redirects unauthenticated access to /student/history back to /login', () => {
    renderAt('/student/history')

    expect(screen.getByRole('heading', { name: 'Sign in' })).toBeDefined()
  })

  it('renders the history list for an authenticated STUDENT at /student/history', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        jsonResponse(200, { content: [], page: 0, size: 20, totalElements: 0, totalPages: 0 }),
      ),
    )
    seedStudentSession()

    renderAt('/student/history')

    expect(screen.getByRole('heading', { name: 'My Study' })).toBeDefined()
    await waitFor(() => expect(screen.getByText('학습 기록이 없습니다.')).toBeDefined())
  })

  it('renders a forbidden state for an authenticated ADMIN at /student/history', () => {
    seedAdminSession()

    renderAt('/student/history')

    expect(screen.getByRole('heading', { name: '접근 권한이 없습니다' })).toBeDefined()
    expect(screen.queryByRole('heading', { name: 'My Study' })).toBeNull()
  })

  it('renders a forbidden state at /student/history when the session role is missing or invalid', () => {
    sessionStorage.setItem(
      'grmr.auth.session',
      JSON.stringify({ accessToken: 'access-token', user: { name: '알수없음', role: 'BOGUS' } }),
    )

    renderAt('/student/history')

    expect(screen.getByRole('heading', { name: '접근 권한이 없습니다' })).toBeDefined()
  })

  it('redirects unauthenticated access to /student/history/:id back to /login', () => {
    renderAt('/student/history/501')

    expect(screen.getByRole('heading', { name: 'Sign in' })).toBeDefined()
  })

  it('renders the history detail for an authenticated STUDENT at /student/history/:id', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        jsonResponse(200, {
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
          submittedAnswer: 'were',
          correct: true,
          submittedAt: '2026-08-13T10:15:00',
        }),
      ),
    )
    seedStudentSession()

    renderAt('/student/history/501')

    expect(screen.getByRole('heading', { name: '학습 기록 상세' })).toBeDefined()
    await waitFor(() => expect(screen.getByText('If I _____ you, I would study harder.')).toBeDefined())
  })

  it('renders a forbidden state for an authenticated ADMIN at /student/history/:id', () => {
    seedAdminSession()

    renderAt('/student/history/501')

    expect(screen.getByRole('heading', { name: '접근 권한이 없습니다' })).toBeDefined()
    expect(screen.queryByRole('heading', { name: '학습 기록 상세' })).toBeNull()
  })

  it('renders a forbidden state at /student/history/:id when the session role is missing or invalid', () => {
    sessionStorage.setItem(
      'grmr.auth.session',
      JSON.stringify({ accessToken: 'access-token', user: { name: '알수없음', role: 'BOGUS' } }),
    )

    renderAt('/student/history/501')

    expect(screen.getByRole('heading', { name: '접근 권한이 없습니다' })).toBeDefined()
  })
})
