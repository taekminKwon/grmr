import { afterEach, describe, expect, it, vi } from 'vitest'
import { LoginError, login } from './authApi'

afterEach(() => {
  vi.unstubAllGlobals()
})

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

describe('authApi login', () => {
  it('POSTs to the same-origin /api/auth/login path with the credentials as JSON', async () => {
    const fetchSpy = vi.fn().mockResolvedValue(
      jsonResponse(200, {
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
        tokenType: 'Bearer',
        expiresIn: 3600,
        role: 'ADMIN',
        name: '권태민',
      }),
    )
    vi.stubGlobal('fetch', fetchSpy)

    await login({ loginId: 'admin01', password: 'password123!' })

    expect(fetchSpy).toHaveBeenCalledTimes(1)
    const [url, init] = fetchSpy.mock.calls[0]
    expect(url).toBe('/api/auth/login')
    expect(init.method).toBe('POST')
    expect(init.headers).toMatchObject({ 'Content-Type': 'application/json' })
    expect(JSON.parse(init.body)).toEqual({ loginId: 'admin01', password: 'password123!' })
  })

  it('resolves with the parsed login response on success', async () => {
    const response = {
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
      tokenType: 'Bearer',
      expiresIn: 3600,
      role: 'ADMIN',
      name: '권태민',
    }
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(200, response)))

    const result = await login({ loginId: 'admin01', password: 'password123!' })

    expect(result).toEqual(response)
  })

  it('throws a LoginError with the backend message for invalid credentials', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        jsonResponse(401, {
          code: 'INVALID_CREDENTIALS',
          message: '아이디 또는 비밀번호가 올바르지 않습니다.',
        }),
      ),
    )

    await expect(login({ loginId: 'admin01', password: 'wrong' })).rejects.toMatchObject({
      message: '아이디 또는 비밀번호가 올바르지 않습니다.',
      code: 'INVALID_CREDENTIALS',
    })
  })

  it('throws a LoginError when fetch itself rejects (network error)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))

    const promise = login({ loginId: 'admin01', password: 'password123!' })

    await expect(promise).rejects.toBeInstanceOf(LoginError)
    await expect(promise).rejects.toMatchObject({ code: undefined })
  })
})
