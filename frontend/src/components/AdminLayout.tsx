import { Link, useNavigate } from 'react-router-dom'
import type { ReactNode } from 'react'
import { useAuth } from '../auth/useAuth'
import Button from './Button'
import './AdminLayout.css'

type AdminNavKey = 'dashboard' | 'questions' | 'assignments' | 'students'

const NAV_ITEMS: { key: AdminNavKey; label: string; to: string; adminOnly?: boolean }[] = [
  { key: 'dashboard', label: 'Dashboard', to: '/admin' },
  { key: 'questions', label: 'Questions', to: '/admin/questions', adminOnly: true },
  { key: 'assignments', label: 'Assignments', to: '/admin/assignments', adminOnly: true },
  { key: 'students', label: 'Students', to: '/admin/students', adminOnly: true },
]

const COMING_SOON_NAV_ITEMS = ['Study Records']

function AdminLayout({ active, children }: { active: AdminNavKey; children: ReactNode }) {
  const { session, logout } = useAuth()
  const navigate = useNavigate()

  if (!session) {
    return null
  }

  const isAdmin = session.user.role === 'ADMIN'
  const visibleNavItems = NAV_ITEMS.filter((item) => !item.adminOnly || isAdmin)

  function handleLogout() {
    logout()
    navigate('/login', { replace: true })
  }

  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <p className="admin-brand">Grammar Lab</p>

        <ul className="admin-nav">
          {visibleNavItems.map((item) => (
            <li key={item.key}>
              <Link
                className="admin-nav-link"
                to={item.to}
                aria-current={item.key === active ? 'page' : undefined}
              >
                {item.label}
              </Link>
            </li>
          ))}
          {COMING_SOON_NAV_ITEMS.map((item) => (
            <li key={item} className="admin-nav-item-disabled" aria-disabled="true">
              <span>{item}</span>
              <span className="admin-nav-badge">Coming soon</span>
            </li>
          ))}
        </ul>
      </aside>

      <div className="admin-main">
        <header className="admin-header">
          <span className="admin-user">
            <span className="admin-user-name">{session.user.name}</span>님
          </span>
          <Button type="button" variant="secondary" onClick={handleLogout}>
            Log out
          </Button>
        </header>

        <main className="admin-content">{children}</main>
      </div>
    </div>
  )
}

export default AdminLayout
