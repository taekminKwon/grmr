export type LoginCredentials = {
  loginId: string
  password: string
}

export type AuthRole = 'ADMIN' | 'STUDENT'

export type LoginResponse = {
  accessToken: string
  refreshToken: string
  tokenType: string
  expiresIn: number
  role: AuthRole
  name: string
}

type ApiErrorBody = {
  code?: string
  message?: string
}

export class LoginError extends Error {
  code?: string

  constructor(message: string, code?: string) {
    super(message)
    this.name = 'LoginError'
    this.code = code
  }
}

const DEFAULT_ERROR_MESSAGE = '로그인에 실패했습니다. 잠시 후 다시 시도해주세요.'
const NETWORK_ERROR_MESSAGE = '네트워크 오류가 발생했습니다. 연결 상태를 확인해주세요.'

export async function login(credentials: LoginCredentials): Promise<LoginResponse> {
  let response: Response

  try {
    response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(credentials),
    })
  } catch {
    throw new LoginError(NETWORK_ERROR_MESSAGE)
  }

  if (!response.ok) {
    const body: ApiErrorBody | null = await response.json().catch(() => null)
    throw new LoginError(body?.message ?? DEFAULT_ERROR_MESSAGE, body?.code)
  }

  return (await response.json()) as LoginResponse
}
