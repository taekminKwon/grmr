import { Navigate } from 'react-router-dom'
import type { ReactElement } from 'react'
import { useAuth } from '../auth/useAuth'

function ProtectedRoute({ children }: { children: ReactElement }) {
  const { session } = useAuth()

  if (!session) {
    return <Navigate to="/login" replace />
  }

  return children
}

export default ProtectedRoute
