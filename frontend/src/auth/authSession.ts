import type { AuthRole } from '../api/authApi'

export type AuthUser = {
  name: string
  role: AuthRole
}

export type AuthSession = {
  accessToken: string
  user: AuthUser
}

const STORAGE_KEY = 'grmr.auth.session'

// sessionStorage, not localStorage: the access token should not outlive the
// browser tab/session. This also means refreshToken is intentionally absent
// from AuthSession and never written here.
export function saveSession(session: AuthSession): void {
  // Explicitly pick fields rather than storing `session` as-is: callers may
  // hand in a broader object (e.g. a parsed login response), and this must
  // never let a refreshToken reach storage regardless of what was passed.
  const minimal: AuthSession = {
    accessToken: session.accessToken,
    user: { name: session.user.name, role: session.user.role },
  }
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(minimal))
}

export function loadSession(): AuthSession | null {
  const raw = sessionStorage.getItem(STORAGE_KEY)
  if (!raw) {
    return null
  }

  try {
    const parsed = JSON.parse(raw) as Partial<AuthSession>
    if (!parsed.accessToken || !parsed.user) {
      return null
    }
    return parsed as AuthSession
  } catch {
    return null
  }
}

export function clearSession(): void {
  sessionStorage.removeItem(STORAGE_KEY)
}
