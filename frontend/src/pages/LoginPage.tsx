import type { FormEvent } from 'react'
import './LoginPage.css'

function LoginPage() {
  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
  }

  return (
    <main className="login-page">
      <form className="login-form" onSubmit={handleSubmit} noValidate>
        <h1>Sign in</h1>

        <div className="login-field">
          <label htmlFor="email">Email</label>
          <input id="email" name="email" type="email" autoComplete="email" required />
        </div>

        <div className="login-field">
          <label htmlFor="password">Password</label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
          />
        </div>

        <div className="login-error" role="alert" aria-live="polite" />

        <button type="submit">Sign in</button>
      </form>
    </main>
  )
}

export default LoginPage
