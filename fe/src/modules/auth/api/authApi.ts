import { requestJson } from '@/shared/api/client'
import { endpoints } from '@/shared/api/endpoints'

export type Credentials = { username: string; password: string }
export type AuthResponse = { accessToken: string }

export function login(body: Credentials) {
  return requestJson<AuthResponse>({
    method: 'POST', url: endpoints.auth.login(), data: body, withCredentials: true, skipAuth: true,
  })
}

export function register(body: Credentials) {
  return requestJson<AuthResponse>({
    method: 'POST', url: endpoints.auth.register(), data: body, withCredentials: true, skipAuth: true,
  })
}
