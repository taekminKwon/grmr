import { Navigate, Route, Routes } from 'react-router-dom'
import AdminPage from '../pages/AdminPage'
import LoginPage from '../pages/LoginPage'
import QuestionCreatePage from '../pages/QuestionCreatePage'
import QuestionDetailPage from '../pages/QuestionDetailPage'
import QuestionListPage from '../pages/QuestionListPage'
import StudentPage from '../pages/StudentPage'
import ProtectedRoute from './ProtectedRoute'

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/admin"
        element={
          <ProtectedRoute requiredRole="ADMIN">
            <AdminPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/questions"
        element={
          <ProtectedRoute requiredRole="ADMIN">
            <QuestionListPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/questions/new"
        element={
          <ProtectedRoute requiredRole="ADMIN">
            <QuestionCreatePage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/questions/:id"
        element={
          <ProtectedRoute requiredRole="ADMIN">
            <QuestionDetailPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/student"
        element={
          <ProtectedRoute requiredRole="STUDENT">
            <StudentPage />
          </ProtectedRoute>
        }
      />
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  )
}

export default AppRoutes
