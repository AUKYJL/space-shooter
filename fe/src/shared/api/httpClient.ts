import axios from 'axios'
import type { InternalAxiosRequestConfig } from 'axios'

type AuthRequestConfig = InternalAxiosRequestConfig & { skipAuth?: boolean; _authRetry?: boolean }

export type CreateHttpClientArgs = {
  baseURL: string
  getToken: () => string | null
  setToken: (token: string) => void
  onUnauthorized: () => void
}

export function createHttpClient({ baseURL, getToken, setToken, onUnauthorized }: CreateHttpClientArgs) {
  const instance = axios.create({ baseURL })
  let refreshPromise: Promise<string> | null = null

  instance.interceptors.request.use((config: AuthRequestConfig) => {
    const token = config.skipAuth ? null : getToken()
    if (token) config.headers.set('Authorization', `Bearer ${token}`)
    else config.headers.delete('Authorization')
    return config
  })

  instance.interceptors.response.use(undefined, async (error: unknown) => {
    if (!axios.isAxiosError(error) || error.response?.status !== 401 || !error.config) throw error
    const config = error.config as AuthRequestConfig
    if (config.skipAuth) throw error

    const sentToken = config.headers.get('Authorization')
    const token = getToken()
    if (!token) throw error
    if (config._authRetry) {
      if (sentToken === `Bearer ${token}`) onUnauthorized()
      throw error
    }
    config._authRetry = true

    // Another request may already have refreshed while this 401 was in flight.
    if (sentToken !== `Bearer ${token}`) return instance.request(config)

    if (!refreshPromise) {
      const refreshConfig = { skipAuth: true, withCredentials: true }
      refreshPromise = instance.post<{ accessToken: string }>('/refresh', undefined, refreshConfig)
        .then(({ data }) => {
          // Do not overwrite a login or cleared session while refresh was in flight.
          if (getToken() !== token) throw new axios.CanceledError('Session changed')
          setToken(data.accessToken)
          return data.accessToken
        })
        .catch((refreshError: unknown) => {
          if (axios.isAxiosError(refreshError) && refreshError.response?.status === 401 && getToken() === token) {
            onUnauthorized()
          }
          throw refreshError
        })
        .finally(() => { refreshPromise = null })
    }
    await refreshPromise
    return instance.request(config)
  })

  return instance
}
