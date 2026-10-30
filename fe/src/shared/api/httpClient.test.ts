import { describe, expect, it, vi } from 'vitest'

vi.mock('axios', async () => {
  const actual = await vi.importActual<typeof import('axios')>('axios')
  return {
    ...actual,
    default: {
      create: vi.fn(() => ({
        interceptors: { request: { use: vi.fn() }, response: { use: vi.fn() } },
      })),
    },
  }
})

import axios from 'axios'
import { createHttpClient } from './httpClient'

describe('httpClient', () => {
  it('creates axios instance with baseURL', () => {
    createHttpClient({ baseURL: 'http://x', getToken: () => null })
    expect(axios.create).toHaveBeenCalled()
  })
})
