import { useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { login as loginRequest, LoginError } from '../api/authApi'
import { useAuth } from '../auth/useAuth'
import Button from '../components/Button'
import './LoginPage.css'

const NON_ADMIN_MESSAGE = '관리자 계정으로만 로그인할 수 있습니다.'
const UNEXPECTED_ERROR_MESSAGE = '로그인에 실패했습니다. 잠시 후 다시 시도해주세요.'

function LoginPage() {
  const [loginId, setLoginId] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const submittingRef = useRef(false)
  const { login } = useAuth()
  const navigate = useNavigate()

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (submittingRef.current) {
      return
    }

    submittingRef.current = true
    setSubmitting(true)
    setError('')

    try {
      const response = await loginRequest({ loginId, password })

      if (response.role !== 'ADMIN') {
        setError(NON_ADMIN_MESSAGE)
        return
      }

      login({
        accessToken: response.accessToken,
        user: { name: response.name, role: response.role },
      })
      navigate('/admin', { replace: true })
    } catch (err) {
      setError(err instanceof LoginError ? err.message : UNEXPECTED_ERROR_MESSAGE)
    } finally {
      submittingRef.current = false
      setSubmitting(false)
    }
  }

  return (
    <main className="login-page">
      <div className="login-card">
        <p className="login-brand">Grammar Lab</p>

        <form className="login-form" onSubmit={handleSubmit} noValidate>
          <h1>Sign in</h1>
          <p className="login-subtitle">관리자 계정으로 로그인하세요.</p>

          <div className="login-field">
            <label htmlFor="loginId">Login ID</label>
            <input
              id="loginId"
              name="loginId"
              type="text"
              autoComplete="username"
              required
              value={loginId}
              onChange={(event) => setLoginId(event.target.value)}
            />
          </div>

          <div className="login-field">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </div>

          <div className="login-error" role="alert" aria-live="polite">
            {error}
          </div>

          <Button type="submit" disabled={submitting}>
            {submitting ? 'Signing in…' : 'Sign in'}
          </Button>
        </form>
      </div>
    </main>
  )
}

export default LoginPage
