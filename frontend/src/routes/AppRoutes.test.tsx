import { cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it } from 'vitest'
import AppRoutes from './AppRoutes'

afterEach(cleanup)

function renderAt(path: string) {
  render(
    <MemoryRouter initialEntries={[path]}>
      <AppRoutes />
    </MemoryRouter>,
  )
}

describe('AppRoutes', () => {
  it('renders the login page at /login', () => {
    renderAt('/login')

    expect(screen.getByRole('heading', { name: 'Sign in' })).toBeDefined()
  })

  it('deterministically redirects the initial root path to /login', () => {
    renderAt('/')

    expect(screen.getByRole('heading', { name: 'Sign in' })).toBeDefined()
  })

  it('deterministically falls back to /login for unknown routes', () => {
    renderAt('/does-not-exist')

    expect(screen.getByRole('heading', { name: 'Sign in' })).toBeDefined()
  })
})
