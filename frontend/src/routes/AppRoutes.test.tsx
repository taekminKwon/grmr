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
})
