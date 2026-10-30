import axios from 'axios'

export type CreateHttpClientArgs = {
  baseURL: string
  getToken: () => string | null
}

export function createHttpClient({ baseURL, getToken }: CreateHttpClientArgs) {
  const instance = axios.create({ baseURL })

  instance.interceptors.request.use((config) => {
    const token = getToken()
    if (!token) return config

    config.headers = {
      ...config.headers,
      Authorization: `Bearer ${token}`,
    }

    return config
  })

  return instance
}

