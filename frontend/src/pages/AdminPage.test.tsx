import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it } from 'vitest'
import { AuthProvider } from '../auth/AuthContext'
import AdminPage from './AdminPage'

afterEach(() => {
  cleanup()
  sessionStorage.clear()
})

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

function renderAdminPage() {
  render(
    <AuthProvider>
      <MemoryRouter initialEntries={['/admin']}>
        <Routes>
          <Route path="/admin" element={<AdminPage />} />
          <Route path="/login" element={<div>Login landing</div>} />
        </Routes>
      </MemoryRouter>
    </AuthProvider>,
  )
}

describe('AdminPage', () => {
  it('renders the brand wordmark and signed-in user name', () => {
    seedAdminSession()
    renderAdminPage()

    expect(screen.getByText('Grammar Lab')).toBeDefined()
    expect(screen.getByText('권태민')).toBeDefined()
  })

  it('marks Dashboard as the current, functional navigation item', () => {
    seedAdminSession()
    renderAdminPage()

    const dashboardLink = screen.getByRole('link', { name: 'Dashboard' })
    expect(dashboardLink.getAttribute('href')).toBe('/admin')
    expect(dashboardLink.getAttribute('aria-current')).toBe('page')
  })

  it('links to the Question list as a functional, non-current navigation item', () => {
    seedAdminSession()
    renderAdminPage()

    const questionsLink = screen.getByRole('link', { name: 'Questions' })
    expect(questionsLink.getAttribute('href')).toBe('/admin/questions')
    expect(questionsLink.getAttribute('aria-current')).toBeNull()
  })

  it('hides the Question list navigation item for a STUDENT session', () => {
    seedStudentSession()
    renderAdminPage()

    expect(screen.queryByRole('link', { name: 'Questions' })).toBeNull()
  })

  it('lists the remaining navigation items as non-interactive and marked coming soon', () => {
    seedAdminSession()
    renderAdminPage()

    for (const label of ['Assignments', 'Students', 'Study Records']) {
      expect(screen.queryByRole('link', { name: label })).toBeNull()
      expect(screen.queryByRole('button', { name: label })).toBeNull()
      expect(screen.getByText(label)).toBeDefined()
    }
    expect(screen.getAllByText('Coming soon')).toHaveLength(3)
  })

  it('logs out, clears the session, and returns to /login', () => {
    seedAdminSession()
    renderAdminPage()

    fireEvent.click(screen.getByRole('button', { name: 'Log out' }))

    expect(screen.getByText('Login landing')).toBeDefined()
    expect(sessionStorage.getItem('grmr.auth.session')).toBeNull()
  })
})
