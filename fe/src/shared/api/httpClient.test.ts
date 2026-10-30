import axios, { AxiosError, AxiosHeaders } from 'axios'
import type { AxiosResponse, InternalAxiosRequestConfig } from 'axios'
import { describe, expect, it, vi } from 'vitest'
import { createHttpClient } from './httpClient'

function reply(config: InternalAxiosRequestConfig, status: number, data: unknown = {}) {
  const response: AxiosResponse = { config, status, data, statusText: String(status), headers: new AxiosHeaders() }
  return status >= 400
    ? Promise.reject(new AxiosError('HTTP error', AxiosError.ERR_BAD_REQUEST, config, undefined, response))
    : Promise.resolve(response)
}

function setup(handler: (config: InternalAxiosRequestConfig) => Promise<AxiosResponse>) {
  let token: string | null = 'old'
  const setToken = vi.fn((value: string) => { token = value })
  const onUnauthorized = vi.fn(() => { token = null })
  const client = createHttpClient({ baseURL: 'http://api', getToken: () => token, setToken, onUnauthorized })
  const adapter = vi.fn(handler)
  client.defaults.adapter = adapter
  return { client, adapter, setToken, onUnauthorized, getToken: () => token, changeToken: (value: string | null) => { token = value } }
}

function gate() {
  let release!: () => void
  const promise = new Promise<void>((resolve) => { release = resolve })
  return { promise, release }
}

const hasNewToken = (config: InternalAxiosRequestConfig) => config.headers.get('Authorization') === 'Bearer new'

describe('httpClient', () => {
  it('attaches access and does not refresh successful requests', async () => {
    const fixture = setup((config) => reply(config, 200))
    await fixture.client.get('/me')
    expect(fixture.adapter.mock.calls[0][0].headers.get('Authorization')).toBe('Bearer old')
    expect(fixture.adapter).toHaveBeenCalledTimes(1)
  })

  it('refreshes after 401, sends cookie credentials only on refresh, and retries with new access', async () => {
    const fixture = setup((config) => config.url === '/refresh'
      ? reply(config, 200, { accessToken: 'new' }) : reply(config, hasNewToken(config) ? 200 : 401))
    await fixture.client.post('/runs/start', { weaponId: 'basic_laser' })
    expect(fixture.adapter.mock.calls.map(([config]) => config.url)).toEqual(['/runs/start', '/refresh', '/runs/start'])
    const refresh = fixture.adapter.mock.calls[1][0]
    expect(refresh.withCredentials).toBe(true)
    expect(refresh.headers.has('Authorization')).toBe(false)
    expect(fixture.adapter.mock.calls[0][0].withCredentials).not.toBe(true)
    expect(fixture.adapter.mock.calls[2][0].data).toBe('{"weaponId":"basic_laser"}')
    expect(fixture.setToken).toHaveBeenCalledWith('new')
  })

  it('shares one refresh across simultaneous 401s', async () => {
    const refreshGate = gate()
    const fixture = setup(async (config) => {
      if (config.url === '/refresh') {
        await refreshGate.promise
        return reply(config, 200, { accessToken: 'new' })
      }
      return reply(config, hasNewToken(config) ? 200 : 401)
    })
    const requests = Promise.all([fixture.client.get('/me'), fixture.client.get('/loadout'), fixture.client.get('/stations')])
    await vi.waitFor(() => expect(fixture.adapter).toHaveBeenCalledTimes(4))
    refreshGate.release()
    await requests
    expect(fixture.adapter.mock.calls.filter(([config]) => config.url === '/refresh')).toHaveLength(1)
  })

  it('retries delayed old-token 401 with current access without another refresh', async () => {
    const lateGate = gate()
    const fixture = setup(async (config) => {
      if (config.url === '/refresh') return reply(config, 200, { accessToken: 'new' })
      if (hasNewToken(config)) return reply(config, 200)
      if (config.url === '/late') await lateGate.promise
      return reply(config, 401)
    })
    const late = fixture.client.get('/late')
    await fixture.client.get('/me')
    lateGate.release()
    await late
    expect(fixture.adapter.mock.calls.filter(([config]) => config.url === '/refresh')).toHaveLength(1)
  })

  it('stops after a retried request returns 401', async () => {
    const fixture = setup((config) => config.url === '/refresh'
      ? reply(config, 200, { accessToken: 'new' }) : reply(config, 401))
    await expect(fixture.client.get('/me')).rejects.toMatchObject({ response: { status: 401 } })
    expect(fixture.adapter).toHaveBeenCalledTimes(3)
    expect(fixture.onUnauthorized).toHaveBeenCalledTimes(1)
    expect(fixture.getToken()).toBeNull()
  })

  it('clears auth once when concurrent requests fail refresh with 401', async () => {
    const refreshGate = gate()
    const fixture = setup(async (config) => {
      if (config.url === '/refresh') await refreshGate.promise
      return reply(config, 401)
    })
    const requests = Promise.allSettled([fixture.client.get('/me'), fixture.client.get('/loadout')])
    await vi.waitFor(() => expect(fixture.adapter).toHaveBeenCalledTimes(3))
    refreshGate.release()
    expect((await requests).every((result) => result.status === 'rejected')).toBe(true)
    expect(fixture.onUnauthorized).toHaveBeenCalledTimes(1)
  })

  it('does not refresh login/register failures or attach access to them', async () => {
    const fixture = setup((config) => reply(config, 401))
    const config = { skipAuth: true, withCredentials: true }
    for (const url of ['/auth/login', '/auth/register']) {
      await expect(fixture.client.post(url, { username: 'user', password: 'x' }, config)).rejects.toThrow()
    }
    expect(fixture.adapter).toHaveBeenCalledTimes(2)
    expect(fixture.adapter.mock.calls.every(([request]) => !request.headers.has('Authorization'))).toBe(true)
    expect(fixture.onUnauthorized).not.toHaveBeenCalled()
  })

  it.each([500, 0])('preserves auth when refresh fails with status %s', async (status) => {
    const fixture = setup((config) => {
      if (config.url !== '/refresh') return reply(config, 401)
      return status ? reply(config, status) : Promise.reject(new AxiosError('Network error'))
    })
    await expect(fixture.client.get('/me')).rejects.toThrow()
    expect(fixture.onUnauthorized).not.toHaveBeenCalled()
    expect(fixture.getToken()).toBe('old')
  })

  it('does not refresh unrelated server errors', async () => {
    const fixture = setup((config) => reply(config, 500))
    await expect(fixture.client.get('/me')).rejects.toThrow()
    expect(fixture.adapter).toHaveBeenCalledTimes(1)
    expect(fixture.onUnauthorized).not.toHaveBeenCalled()
  })

  it('does not resurrect or overwrite a changed session during refresh', async () => {
    const refreshGate = gate()
    const fixture = setup(async (config) => {
      if (config.url !== '/refresh') return reply(config, 401)
      await refreshGate.promise
      return reply(config, 200, { accessToken: 'new' })
    })
    const result = fixture.client.get('/me').catch((error: unknown) => error)
    await vi.waitFor(() => expect(fixture.adapter).toHaveBeenCalledTimes(2))
    fixture.changeToken(null)
    refreshGate.release()
    expect(axios.isCancel(await result)).toBe(true)
    expect(fixture.setToken).not.toHaveBeenCalled()
  })
})
