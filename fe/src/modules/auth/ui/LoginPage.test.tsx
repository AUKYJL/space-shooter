import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { LoginPage } from './LoginPage'
import { login, register } from '@/modules/auth/api/authApi'
import { ApiError } from '@/shared/api/client'
import { useSessionStore } from '@/shared/store/sessionStore'

const navigate = vi.hoisted(() => vi.fn())
vi.mock('@tanstack/react-router', () => ({ useNavigate: () => navigate }))
vi.mock('@/modules/auth/api/authApi', () => ({ login: vi.fn(), register: vi.fn() }))

function setup() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  render(<QueryClientProvider client={queryClient}><LoginPage /></QueryClientProvider>)
  return queryClient
}
function fill(password = 'x') {
  fireEvent.change(screen.getByLabelText('Ник'), { target: { value: ' Player ' } })
  fireEvent.change(screen.getByLabelText('Пароль'), { target: { value: password } })
}

beforeEach(() => {
  vi.resetAllMocks()
  useSessionStore.getState().clearSession()
})
afterEach(cleanup)

describe('LoginPage', () => {
  it('logs in by Enter, preserves password whitespace, stores access and clears old user cache', async () => {
    vi.mocked(login).mockResolvedValue({ accessToken: 'access' })
    const queries = setup()
    queries.setQueryData(['old-user'], { private: true })
    fill(' X ')
    fireEvent.submit(screen.getByRole('button', { name: 'Войти' }).closest('form')!)
    await waitFor(() => expect(navigate).toHaveBeenCalledWith({ to: '/' }))
    expect(login).toHaveBeenCalledWith({ username: 'Player', password: ' X ' })
    expect(useSessionStore.getState().accessToken).toBe('access')
    expect(localStorage.getItem('space-shooter:session:v1')).toContain('access')
    expect(queries.getQueryData(['old-user'])).toBeUndefined()
  })

  it('registers with a one-character password and automatically signs in', async () => {
    vi.mocked(register).mockResolvedValue({ accessToken: 'registered' })
    setup()
    fireEvent.click(screen.getByRole('button', { name: 'Создать аккаунт' }))
    fill()
    fireEvent.click(screen.getByRole('button', { name: 'Зарегистрироваться' }))
    await waitFor(() => expect(register).toHaveBeenCalledWith({ username: 'Player', password: 'x' }))
    await waitFor(() => expect(useSessionStore.getState().accessToken).toBe('registered'))
    expect(login).not.toHaveBeenCalled()
  })

  it('requires nonempty fields and prevents duplicate submits while pending', async () => {
    vi.mocked(login).mockImplementation(() => new Promise(() => {}))
    setup()
    expect(screen.getByRole('button', { name: 'Войти' })).toBeDisabled()
    fill()
    fireEvent.click(screen.getByRole('button', { name: 'Войти' }))
    await waitFor(() => expect(screen.getByRole('button', { name: 'Подождите…' })).toBeDisabled())
    fireEvent.submit(screen.getByRole('button', { name: 'Подождите…' }).closest('form')!)
    expect(login).toHaveBeenCalledTimes(1)
  })

  it.each([[401, 'Неверный ник или пароль.'], [409, 'Этот ник уже занят.']])('shows readable error %s without navigating', async (status, message) => {
    vi.mocked(login).mockRejectedValue(new ApiError('API error', status, {}))
    setup()
    fill()
    fireEvent.click(screen.getByRole('button', { name: 'Войти' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(message)
    expect(navigate).not.toHaveBeenCalled()
    expect(useSessionStore.getState().accessToken).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Создать аккаунт' }))
    expect(screen.queryByRole('alert')).toBeNull()
  })
})
