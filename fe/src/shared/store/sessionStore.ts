import { create } from 'zustand'

export type StorageLike = {
  getItem: (key: string) => string | null
  setItem: (key: string, value: string) => void
  removeItem: (key: string) => void
}

type SessionState = {
  accessToken: string | null
}

type SessionActions = {
  setAccessToken: (token: string) => void
  clearSession: () => void
}

type SessionStore = SessionState & SessionActions

const storageKey = 'space-shooter:session:v1'

function safeParseJson<T>(value: string | null): T | null {
  if (!value) return null
  try {
    return JSON.parse(value) as T
  } catch {
    return null
  }
}

function getDefaultStorage(): StorageLike | null {
  if (typeof window === 'undefined') return null
  if (!window.localStorage) return null
  return window.localStorage
}

function readInitialToken(storage: StorageLike | null): string | null {
  if (!storage) return null
  const parsed = safeParseJson<{ accessToken?: unknown }>(storage.getItem(storageKey))
  const token = parsed?.accessToken
  return typeof token === 'string' && token.length > 0 ? token : null
}

export function createSessionStore(storage: StorageLike | null = getDefaultStorage()) {
  const initialToken = readInitialToken(storage)

  return create<SessionStore>((set, get) => ({
    accessToken: initialToken,

    setAccessToken: (token) => {
      set({ accessToken: token })
      if (!storage) return
      storage.setItem(storageKey, JSON.stringify({ accessToken: get().accessToken }))
    },

    clearSession: () => {
      set({ accessToken: null })
      if (!storage) return
      storage.removeItem(storageKey)
    },
  }))
}

export const useSessionStore = createSessionStore()

