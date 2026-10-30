import { describe, expect, it } from 'vitest'

import { createSessionStore } from './sessionStore'

describe('sessionStore', () => {
  it('persists and restores accessToken', () => {
    const storage = new Map<string, string>()
    const store1 = createSessionStore({
      getItem: (k) => storage.get(k) ?? null,
      setItem: (k, v) => storage.set(k, v),
      removeItem: (k) => storage.delete(k),
    })

    store1.getState().setAccessToken('t1')
    expect(storage.get('space-shooter:session:v1')).toContain('t1')

    const store2 = createSessionStore({
      getItem: (k) => storage.get(k) ?? null,
      setItem: (k, v) => storage.set(k, v),
      removeItem: (k) => storage.delete(k),
    })
    expect(store2.getState().accessToken).toBe('t1')
  })
})

