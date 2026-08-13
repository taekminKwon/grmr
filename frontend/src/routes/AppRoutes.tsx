import { Navigate, Route, Routes } from 'react-router-dom'
import AdminPage from '../pages/AdminPage'
import LoginPage from '../pages/LoginPage'
import QuestionCreatePage from '../pages/QuestionCreatePage'
import QuestionListPage from '../pages/QuestionListPage'
import ProtectedRoute from './ProtectedRoute'

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/admin"
        element={
          // Session-only, not ADMIN-gated: login (see LoginPage) already rejects
          // non-ADMIN accounts, so every reachable session here is an admin
          // session. Explicit role-gating is reserved for Question management,
          // which this correction scopes to.
          <ProtectedRoute>
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
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  )
}

export default AppRoutes
