import { createContext, useContext } from 'react'
import type { AuthSession } from './authSession'

export type AuthContextValue = {
  session: AuthSession | null
  login: (session: AuthSession) => void
  logout: () => void
}

export const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
