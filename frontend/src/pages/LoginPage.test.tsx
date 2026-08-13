import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AuthProvider } from '../auth/AuthContext'
import LoginPage from './LoginPage'

afterEach(() => {
  cleanup()
  sessionStorage.clear()
  vi.unstubAllGlobals()
})

function renderLoginPage() {
  render(
    <AuthProvider>
      <MemoryRouter initialEntries={['/login']}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/admin" element={<div>Admin landing</div>} />
          <Route path="/student" element={<div>Student landing</div>} />
        </Routes>
      </MemoryRouter>
    </AuthProvider>,
  )
}

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

async function fillAndSubmit(loginId: string, password: string) {
  fireEvent.change(screen.getByLabelText('Login ID'), { target: { value: loginId } })
  fireEvent.change(screen.getByLabelText('Password'), { target: { value: password } })
  fireEvent.click(screen.getByRole('button', { name: /sign in/i }))
}

const adminResponse = {
  accessToken: 'access-token',
  refreshToken: 'refresh-token-secret',
  tokenType: 'Bearer',
  expiresIn: 3600,
  role: 'ADMIN',
  name: '권태민',
}

const studentResponse = {
  accessToken: 'access-token',
  refreshToken: 'refresh-token-secret',
  tokenType: 'Bearer',
  expiresIn: 3600,
  role: 'STUDENT',
  name: '김학생',
}

describe('LoginPage', () => {
  it('renders an accessible heading and labeled, controlled form controls', () => {
    renderLoginPage()

    expect(screen.getByRole('heading', { name: 'Sign in' })).toBeDefined()

    const loginIdInput = screen.getByLabelText('Login ID') as HTMLInputElement
    expect(loginIdInput.autocomplete).toBe('username')

    const passwordInput = screen.getByLabelText('Password') as HTMLInputElement
    expect(passwordInput.type).toBe('password')
    expect(passwordInput.autocomplete).toBe('current-password')

    fireEvent.change(loginIdInput, { target: { value: 'admin01' } })
    expect(loginIdInput.value).toBe('admin01')

    expect(screen.getByRole('button', { name: 'Sign in' })).toBeDefined()
  })

  it('reserves an inline accessible region for server/network errors', () => {
    renderLoginPage()

    const errorRegion = screen.getByRole('alert')
    expect(errorRegion).toBeDefined()
    expect(errorRegion.textContent).toBe('')
  })

  it('submits loginId/password to POST /api/auth/login', async () => {
    const fetchSpy = vi.fn().mockResolvedValue(jsonResponse(200, adminResponse))
    vi.stubGlobal('fetch', fetchSpy)

    renderLoginPage()
    await fillAndSubmit('admin01', 'password123!')

    await waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(1))
    const [url, init] = fetchSpy.mock.calls[0]
    expect(url).toBe('/api/auth/login')
    expect(init.method).toBe('POST')
    expect(JSON.parse(init.body)).toEqual({ loginId: 'admin01', password: 'password123!' })
  })

  it('shows a disabled/submitting state and prevents duplicate submits', async () => {
    let resolveFetch: (value: Response) => void = () => {}
    const fetchSpy = vi.fn(
      () =>
        new Promise<Response>((resolve) => {
          resolveFetch = resolve
        }),
    )
    vi.stubGlobal('fetch', fetchSpy)

    renderLoginPage()
    fireEvent.change(screen.getByLabelText('Login ID'), { target: { value: 'admin01' } })
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'password123!' } })

    const submitButton = screen.getByRole('button', { name: /sign in/i })
    fireEvent.click(submitButton)
    fireEvent.click(submitButton)

    expect(fetchSpy).toHaveBeenCalledTimes(1)
    expect((submitButton as HTMLButtonElement).disabled).toBe(true)

    resolveFetch(jsonResponse(200, adminResponse))
    await waitFor(() => expect(screen.getByText('Admin landing')).toBeDefined())
  })

  it('shows the backend message on invalid credentials and stays on the login page', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        jsonResponse(401, {
          code: 'INVALID_CREDENTIALS',
          message: '아이디 또는 비밀번호가 올바르지 않습니다.',
        }),
      ),
    )

    renderLoginPage()
    await fillAndSubmit('admin01', 'wrong-password')

    await waitFor(() =>
      expect(screen.getByRole('alert').textContent).toBe('아이디 또는 비밀번호가 올바르지 않습니다.'),
    )
    expect(screen.getByRole('heading', { name: 'Sign in' })).toBeDefined()
  })

  it('shows a network error message when the request fails to reach the server', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))

    renderLoginPage()
    await fillAndSubmit('admin01', 'password123!')

    await waitFor(() => expect(screen.getByRole('alert').textContent).not.toBe(''))
    expect(screen.getByRole('heading', { name: 'Sign in' })).toBeDefined()
  })

  it('navigates to /admin and stores only the access token and user on ADMIN success', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(200, adminResponse)))

    renderLoginPage()
    await fillAndSubmit('admin01', 'password123!')

    await waitFor(() => expect(screen.getByText('Admin landing')).toBeDefined())

    const stored = sessionStorage.getItem('grmr.auth.session')
    expect(stored).not.toBeNull()
    expect(stored).not.toContain('refresh-token-secret')
    const parsed = JSON.parse(stored as string)
    expect(parsed).toEqual({ accessToken: 'access-token', user: { name: '권태민', role: 'ADMIN' } })
  })

  it('navigates to /student and stores only the access token and user on STUDENT success', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(200, studentResponse)))

    renderLoginPage()
    await fillAndSubmit('student01', 'password123!')

    await waitFor(() => expect(screen.getByText('Student landing')).toBeDefined())

    const stored = sessionStorage.getItem('grmr.auth.session')
    expect(stored).not.toBeNull()
    expect(stored).not.toContain('refresh-token-secret')
    const parsed = JSON.parse(stored as string)
    expect(parsed).toEqual({ accessToken: 'access-token', user: { name: '김학생', role: 'STUDENT' } })
  })

  it('shows an error and stays on the login page when the server reports an unrecognized role', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(jsonResponse(200, { ...adminResponse, role: 'BOGUS' })),
    )

    renderLoginPage()
    await fillAndSubmit('someone', 'password123!')

    await waitFor(() =>
      expect(screen.getByRole('alert').textContent).toBe('알 수 없는 계정 유형입니다. 관리자에게 문의해주세요.'),
    )
    expect(screen.getByRole('heading', { name: 'Sign in' })).toBeDefined()
    expect(sessionStorage.getItem('grmr.auth.session')).toBeNull()
  })
})
