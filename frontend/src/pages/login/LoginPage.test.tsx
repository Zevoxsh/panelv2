import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import LoginPage from './LoginPage'

const mockLogin = vi.fn().mockResolvedValue({ role: 'admin' })
const mockNavigate = vi.fn()

vi.mock('../../stores/auth.store', () => ({
  useAuthStore: () => ({
    user: null,
    isLoading: false,
    login: mockLogin,
    logout: vi.fn(),
    fetchMe: vi.fn(),
  }),
}))

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return { ...actual, useNavigate: () => mockNavigate }
})

describe('LoginPage', () => {
  it('affiche les champs email et mot de passe', () => {
    render(<MemoryRouter><LoginPage /></MemoryRouter>)
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/mot de passe/i)).toBeInTheDocument()
  })

  it('appelle login avec email et password', async () => {
    render(<MemoryRouter><LoginPage /></MemoryRouter>)
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'admin@panel.local' } })
    fireEvent.change(screen.getByLabelText(/mot de passe/i), { target: { value: 'admin123' } })
    fireEvent.click(screen.getByRole('button', { name: /se connecter/i }))
    await waitFor(() => expect(mockLogin).toHaveBeenCalledWith('admin@panel.local', 'admin123'))
  })
})
