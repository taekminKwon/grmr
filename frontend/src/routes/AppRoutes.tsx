import { Navigate, Route, Routes } from 'react-router-dom'
import AdminPage from '../pages/AdminPage'
import AssignmentCreatePage from '../pages/AssignmentCreatePage'
import AssignmentDetailPage from '../pages/AssignmentDetailPage'
import AssignmentEditPage from '../pages/AssignmentEditPage'
import AssignmentListPage from '../pages/AssignmentListPage'
import LoginPage from '../pages/LoginPage'
import QuestionCreatePage from '../pages/QuestionCreatePage'
import QuestionDetailPage from '../pages/QuestionDetailPage'
import QuestionListPage from '../pages/QuestionListPage'
import StudentAssignmentListPage from '../pages/StudentAssignmentListPage'
import StudentAssignmentResultPage from '../pages/StudentAssignmentResultPage'
import StudentAssignmentSolvePage from '../pages/StudentAssignmentSolvePage'
import StudentHistoryDetailPage from '../pages/StudentHistoryDetailPage'
import StudentHistoryListPage from '../pages/StudentHistoryListPage'
import StudentPage from '../pages/StudentPage'
import StudentPracticePage from '../pages/StudentPracticePage'
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
        path="/admin/assignments"
        element={
          <ProtectedRoute requiredRole="ADMIN">
            <AssignmentListPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/assignments/new"
        element={
          <ProtectedRoute requiredRole="ADMIN">
            <AssignmentCreatePage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/assignments/:id"
        element={
          <ProtectedRoute requiredRole="ADMIN">
            <AssignmentDetailPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/assignments/:id/edit"
        element={
          <ProtectedRoute requiredRole="ADMIN">
            <AssignmentEditPage />
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
      <Route
        path="/student/assignments"
        element={
          <ProtectedRoute requiredRole="STUDENT">
            <StudentAssignmentListPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/student/assignments/:id"
        element={
          <ProtectedRoute requiredRole="STUDENT">
            <StudentAssignmentSolvePage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/student/assignments/:id/result"
        element={
          <ProtectedRoute requiredRole="STUDENT">
            <StudentAssignmentResultPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/student/practice"
        element={
          <ProtectedRoute requiredRole="STUDENT">
            <StudentPracticePage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/student/history"
        element={
          <ProtectedRoute requiredRole="STUDENT">
            <StudentHistoryListPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/student/history/:id"
        element={
          <ProtectedRoute requiredRole="STUDENT">
            <StudentHistoryDetailPage />
          </ProtectedRoute>
        }
      />
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  )
}

export default AppRoutes
