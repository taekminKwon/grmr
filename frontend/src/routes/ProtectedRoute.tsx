import { Navigate } from 'react-router-dom'
import type { ReactElement } from 'react'
import type { AuthRole } from '../api/authApi'
import { useAuth } from '../auth/useAuth'
import ForbiddenPage from '../pages/ForbiddenPage'

function ProtectedRoute({
  children,
  requiredRole,
}: {
  children: ReactElement
  requiredRole?: AuthRole
}) {
  const { session } = useAuth()

  if (!session) {
    return <Navigate to="/login" replace />
  }

  // Session exists but the role doesn't match (STUDENT, missing, or otherwise
  // invalid): the user is authenticated so /login would be misleading, hence
  // a forbidden state rather than a redirect there.
  if (requiredRole && session.user.role !== requiredRole) {
    return <ForbiddenPage />
  }

  return children
}

export default ProtectedRoute
