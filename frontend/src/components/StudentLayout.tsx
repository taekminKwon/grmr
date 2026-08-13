import { useNavigate } from 'react-router-dom'
import type { ReactNode } from 'react'
import { useAuth } from '../auth/useAuth'
import Button from './Button'
import './StudentLayout.css'

const COMING_SOON_NAV_ITEMS = ['Practice', 'My Study']

function StudentLayout({ children }: { children: ReactNode }) {
  const { session, logout } = useAuth()
  const navigate = useNavigate()

  if (!session) {
    return null
  }

  function handleLogout() {
    logout()
    navigate('/login', { replace: true })
  }

  return (
    <div className="student-shell">
      <aside className="student-sidebar">
        <p className="student-brand">Grammar Lab</p>

        <ul className="student-nav">
          {COMING_SOON_NAV_ITEMS.map((item) => (
            <li key={item} className="student-nav-item-disabled" aria-disabled="true">
              <span>{item}</span>
              <span className="student-nav-badge">Coming soon</span>
            </li>
          ))}
        </ul>
      </aside>

      <div className="student-main">
        <header className="student-header">
          <span className="student-user">
            <span className="student-user-name">{session.user.name}</span>님
          </span>
          <Button type="button" variant="secondary" onClick={handleLogout}>
            Log out
          </Button>
        </header>

        <main className="student-content">{children}</main>
      </div>
    </div>
  )
}

export default StudentLayout
