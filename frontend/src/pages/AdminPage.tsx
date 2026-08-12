import AdminLayout from '../components/AdminLayout'
import { useAuth } from '../auth/useAuth'
import './AdminPage.css'

function AdminPage() {
  const { session } = useAuth()

  if (!session) {
    return null
  }

  return (
    <AdminLayout active="dashboard">
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
    </AdminLayout>
  )
}

export default AdminPage
