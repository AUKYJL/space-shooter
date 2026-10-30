import { act, cleanup, render, waitFor } from '@testing-library/react'
import { useQueryClient } from '@tanstack/react-query'
import type { QueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useSessionStore } from '@/shared/store/sessionStore'
import { QueryProvider } from './QueryProvider'

const navigate = vi.hoisted(() => vi.fn())
vi.mock('@/app/router/router', () => ({ router: { navigate } }))

let queryClient: QueryClient;
function CaptureClient() {
  const client = useQueryClient()
  useEffect(() => { queryClient = client }, [client])
  return null
}

beforeEach(() => {
  navigate.mockClear()
  useSessionStore.getState().setAccessToken('old')
})
afterEach(cleanup)

describe('auth session lifecycle', () => {
  it('clears private queries and redirects on session expiration', async () => {
    render(<QueryProvider><CaptureClient /></QueryProvider>)
    queryClient.setQueryData(['private'], { username: 'old-user' })
    act(() => useSessionStore.getState().clearSession())
    await waitFor(() => expect(navigate).toHaveBeenCalledWith({ to: '/login', replace: true }))
    expect(queryClient.getQueryData(['private'])).toBeUndefined()
    expect(localStorage.getItem('space-shooter:session:v1')).toBeNull()
  })

  it('keeps queries during a successful access refresh', () => {
    render(<QueryProvider><CaptureClient /></QueryProvider>)
    queryClient.setQueryData(['private'], { username: 'same-user' })
    act(() => useSessionStore.getState().setAccessToken('new'))
    expect(queryClient.getQueryData(['private'])).toEqual({ username: 'same-user' })
    expect(navigate).not.toHaveBeenCalled()
  })
})
