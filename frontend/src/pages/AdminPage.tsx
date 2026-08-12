import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'
import Button from '../components/Button'
import './AdminPage.css'

const COMING_SOON_NAV_ITEMS = ['Questions', 'Assignments', 'Students', 'Study Records']

function AdminPage() {
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
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <p className="admin-brand">Grammar Lab</p>

        <ul className="admin-nav">
          <li>
            <Link className="admin-nav-link" to="/admin" aria-current="page">
              Dashboard
            </Link>
          </li>
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

        <main className="admin-content">
          <h1>Admin</h1>
          <p className="admin-welcome">{session.user.name}님, 환영합니다.</p>

          <section className="admin-overview" aria-label="Overview">
            <div className="admin-overview-card">
              <h2>오늘의 할 일</h2>
              <p>준비 중인 기능입니다.</p>
            </div>
            <div className="admin-overview-card">
              <h2>최근 활동</h2>
              <p>준비 중인 기능입니다.</p>
            </div>
          </section>
        </main>
      </div>
    </div>
  )
}

export default AdminPage
