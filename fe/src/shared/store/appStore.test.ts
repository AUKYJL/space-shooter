import { beforeEach, describe, expect, it } from 'vitest'

import { useAppStore } from '@/shared/store/appStore'

const storageKey = 'space-shooter:app:v2'

beforeEach(() => {
  localStorage.clear()
  useAppStore.setState({ selectedWeaponId: 'basic_laser', lastRunSummary: null })
})

describe('appStore local persistence', () => {
  it('persistToStorage writes selectedWeaponId', () => {
    useAppStore.getState().setSelectedWeaponId('spread_shot')
    useAppStore.getState().persistToStorage()

    const raw = localStorage.getItem(storageKey)
    expect(raw).toBeTruthy()
    expect(JSON.parse(raw as string)).toEqual({ selectedWeaponId: 'spread_shot' })
  })

  it('hydrateFromStorage restores selectedWeaponId and normalizes unknown ids', () => {
    localStorage.setItem(storageKey, JSON.stringify({ selectedWeaponId: 'spread_shot' }))
    useAppStore.getState().hydrateFromStorage()
    expect(useAppStore.getState().selectedWeaponId).toBe('spread_shot')

    localStorage.setItem(storageKey, JSON.stringify({ selectedWeaponId: 'nope' }))
    useAppStore.getState().hydrateFromStorage()
    expect(useAppStore.getState().selectedWeaponId).toBe('basic_laser')
  })
})

