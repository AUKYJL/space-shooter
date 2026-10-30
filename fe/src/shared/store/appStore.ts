import { create } from 'zustand'

import type { RunSummary } from '@/game/ui-bridge/gameToReact'
import { WEAPON_CATALOG, type WeaponId } from '@/shared/lib/weapons'

type AppState = {
  selectedWeaponId: WeaponId
  lastRunSummary: RunSummary | null
}

type AppActions = {
  setSelectedWeaponId: (weaponId: WeaponId) => void
  setLastRunSummary: (summary: RunSummary | null) => void
  hydrateFromStorage: () => void
  persistToStorage: () => void
}

const storageKey = 'space-shooter:app:v2'

function safeParseJson<T>(value: string | null): T | null {
  if (!value) return null
  try {
    return JSON.parse(value) as T
  } catch {
    return null
  }
}

function normalizeWeaponId(value: unknown): WeaponId {
  if (typeof value !== 'string') return 'basic_laser'
  const found = WEAPON_CATALOG.some((w) => w.id === value)
  return found ? (value as WeaponId) : 'basic_laser'
}

export const useAppStore = create<AppState & AppActions>((set, get) => ({
  selectedWeaponId: 'basic_laser',
  lastRunSummary: null,

  setSelectedWeaponId: (weaponId) => {
    set({ selectedWeaponId: weaponId })
    get().persistToStorage()
  },

  setLastRunSummary: (summary) => {
    set({ lastRunSummary: summary })
  },

  hydrateFromStorage: () => {
    const data = safeParseJson<Pick<AppState, 'selectedWeaponId'>>(localStorage.getItem(storageKey))
    if (!data) return
    set({ selectedWeaponId: normalizeWeaponId(data.selectedWeaponId) })
  },

  persistToStorage: () => {
    const { selectedWeaponId } = get()
    localStorage.setItem(storageKey, JSON.stringify({ selectedWeaponId }))
  },
}))

