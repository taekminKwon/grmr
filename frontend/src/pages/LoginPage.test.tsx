import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import LoginPage from './LoginPage'

afterEach(cleanup)

describe('LoginPage', () => {
  it('renders an accessible heading and labeled form controls', () => {
    render(<LoginPage />)

    expect(screen.getByRole('heading', { name: 'Sign in' })).toBeDefined()

    const emailInput = screen.getByLabelText('Email') as HTMLInputElement
    expect(emailInput.type).toBe('email')
    expect(emailInput.autocomplete).toBe('email')

    const passwordInput = screen.getByLabelText('Password') as HTMLInputElement
    expect(passwordInput.type).toBe('password')
    expect(passwordInput.autocomplete).toBe('current-password')

    expect(screen.getByRole('button', { name: 'Sign in' })).toBeDefined()
  })

  it('reserves an inline region for validation or server errors', () => {
    render(<LoginPage />)

    const errorRegion = screen.getByRole('alert')
    expect(errorRegion).toBeDefined()
    expect(errorRegion.textContent).toBe('')
  })

  it('only prevents default on submit, without navigating or sending a request', () => {
    const fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)
    const initialHref = window.location.href

    render(<LoginPage />)

    const form = screen.getByRole('button', { name: 'Sign in' }).closest('form')
    expect(form).not.toBeNull()

    const wasNotCanceled = fireEvent.submit(form as HTMLFormElement)

    expect(wasNotCanceled).toBe(false)
    expect(window.location.href).toBe(initialHref)
    expect(fetchSpy).not.toHaveBeenCalled()

    vi.unstubAllGlobals()
  })
})
