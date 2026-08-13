import StudentLayout from '../components/StudentLayout'
import { useAuth } from '../auth/useAuth'
import './StudentPage.css'

function StudentPage() {
  const { session } = useAuth()

  if (!session) {
    return null
  }

  return (
    <StudentLayout>
      <h1>Student</h1>
      <p className="student-welcome">{session.user.name}님, 환영합니다.</p>

      <section className="student-overview" aria-label="Overview">
        <div className="student-overview-card">
          <h2>학습 현황</h2>
          <p>준비 중인 기능입니다.</p>
        </div>
      </section>
    </StudentLayout>
  )
}

export default StudentPage
