import { Link } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'
import './ForbiddenPage.css'

const ROLE_HOME: Record<string, { to: string; label: string }> = {
  ADMIN: { to: '/admin', label: 'Admin 홈으로 이동' },
  STUDENT: { to: '/student', label: 'Student 홈으로 이동' },
}

function ForbiddenPage() {
  const { session } = useAuth()
  const home = session ? ROLE_HOME[session.user.role] : undefined

  return (
    <main className="forbidden-page">
      <div className="forbidden-card">
        <h1>접근 권한이 없습니다</h1>
        <p className="forbidden-message">이 페이지에 접근할 권한이 없습니다.</p>
        {home && (
          <Link className="forbidden-link" to={home.to}>
            {home.label}
          </Link>
        )}
      </div>
    </main>
  )
}

export default ForbiddenPage
