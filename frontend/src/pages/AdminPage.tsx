import { useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'

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
    <main className="admin-page">
      <h1>Admin</h1>
      <p>{session.user.name}님, 환영합니다.</p>
      <button type="button" onClick={handleLogout}>
        Log out
      </button>
    </main>
  )
}

export default AdminPage
