import { Link, useNavigate } from 'react-router-dom'
import type { ReactNode } from 'react'
import { useAuth } from '../auth/useAuth'
import Button from './Button'
import './StudentLayout.css'

type StudentNavKey = 'practice' | 'history'

const NAV_ITEMS: { key: StudentNavKey; label: string; to: string }[] = [
  { key: 'practice', label: 'Practice', to: '/student/practice' },
  { key: 'history', label: 'My Study', to: '/student/history' },
]

function StudentLayout({ active, children }: { active?: StudentNavKey; children: ReactNode }) {
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
          {NAV_ITEMS.map((item) => (
            <li key={item.key}>
              <Link
                className="student-nav-link"
                to={item.to}
                aria-current={item.key === active ? 'page' : undefined}
              >
                {item.label}
              </Link>
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
