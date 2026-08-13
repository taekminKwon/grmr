import { Link } from 'react-router-dom'
import './ForbiddenPage.css'

function ForbiddenPage() {
  return (
    <main className="forbidden-page">
      <div className="forbidden-card">
        <h1>접근 권한이 없습니다</h1>
        <p className="forbidden-message">이 페이지는 관리자만 이용할 수 있습니다.</p>
        <Link className="forbidden-link" to="/admin">
          Admin 홈으로 이동
        </Link>
      </div>
    </main>
  )
}

export default ForbiddenPage
