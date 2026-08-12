import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it } from 'vitest'
import { AuthProvider } from '../auth/AuthContext'
import AppRoutes from './AppRoutes'

afterEach(() => {
  cleanup()
  sessionStorage.clear()
})

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
})
