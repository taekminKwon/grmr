import { useCallback, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { AuthContext } from './useAuth'
import type { AuthSession } from './authSession'
import { clearSession, loadSession, saveSession } from './authSession'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<AuthSession | null>(() => loadSession())

  const login = useCallback((next: AuthSession) => {
    saveSession(next)
    setSession(next)
  }, [])

  const logout = useCallback(() => {
    clearSession()
    setSession(null)
  }, [])

  const value = useMemo(() => ({ session, login, logout }), [session, login, logout])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
