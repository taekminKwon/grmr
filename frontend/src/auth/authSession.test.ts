import { afterEach, describe, expect, it } from 'vitest'
import { clearSession, loadSession, saveSession } from './authSession'

afterEach(() => {
  sessionStorage.clear()
})

describe('authSession', () => {
  it('persists and restores the access token and minimal user info', () => {
    saveSession({ accessToken: 'access-token', user: { name: '권태민', role: 'ADMIN' } })

    expect(loadSession()).toEqual({
      accessToken: 'access-token',
      user: { name: '권태민', role: 'ADMIN' },
    })
  })

  it('uses the sessionStorage key, so it does not survive across browser restarts', () => {
    saveSession({ accessToken: 'access-token', user: { name: '권태민', role: 'ADMIN' } })

    expect(sessionStorage.getItem('grmr.auth.session')).not.toBeNull()
  })

  it('never persists a refreshToken, even if present on the object handed in', () => {
    const sessionWithExtraField: Parameters<typeof saveSession>[0] & { refreshToken: string } = {
      accessToken: 'access-token',
      refreshToken: 'refresh-token-should-not-be-stored',
      user: { name: '권태민', role: 'ADMIN' },
    }

    saveSession(sessionWithExtraField)

    const raw = sessionStorage.getItem('grmr.auth.session')
    expect(raw).not.toContain('refresh-token-should-not-be-stored')
  })

  it('returns null when nothing is stored', () => {
    expect(loadSession()).toBeNull()
  })

  it('clears the stored session', () => {
    saveSession({ accessToken: 'access-token', user: { name: '권태민', role: 'ADMIN' } })
    clearSession()

    expect(loadSession()).toBeNull()
  })
})
