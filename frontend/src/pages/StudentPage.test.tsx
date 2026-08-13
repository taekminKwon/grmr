import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it } from 'vitest'
import { AuthProvider } from '../auth/AuthContext'
import StudentPage from './StudentPage'

afterEach(() => {
  cleanup()
  sessionStorage.clear()
})

function seedStudentSession() {
  sessionStorage.setItem(
    'grmr.auth.session',
    JSON.stringify({ accessToken: 'access-token', user: { name: '김학생', role: 'STUDENT' } }),
  )
}

function renderStudentPage() {
  render(
    <AuthProvider>
      <MemoryRouter initialEntries={['/student']}>
        <Routes>
          <Route path="/student" element={<StudentPage />} />
          <Route path="/login" element={<div>Login landing</div>} />
        </Routes>
      </MemoryRouter>
    </AuthProvider>,
  )
}

describe('StudentPage', () => {
  it('renders the brand wordmark and signed-in user name', () => {
    seedStudentSession()
    renderStudentPage()

    expect(screen.getByText('Grammar Lab')).toBeDefined()
    expect(screen.getByText('김학생')).toBeDefined()
  })

  it('links Practice to /student/practice while My Study stays a coming-soon placeholder', () => {
    seedStudentSession()
    renderStudentPage()

    const practiceLink = screen.getByRole('link', { name: 'Practice' })
    expect(practiceLink.getAttribute('href')).toBe('/student/practice')

    expect(screen.queryByRole('link', { name: 'My Study' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'My Study' })).toBeNull()
    expect(screen.getByText('My Study')).toBeDefined()
    expect(screen.getAllByText('Coming soon')).toHaveLength(1)
  })

  it('logs out, clears the session, and returns to /login', () => {
    seedStudentSession()
    renderStudentPage()

    fireEvent.click(screen.getByRole('button', { name: 'Log out' }))

    expect(screen.getByText('Login landing')).toBeDefined()
    expect(sessionStorage.getItem('grmr.auth.session')).toBeNull()
  })
})
