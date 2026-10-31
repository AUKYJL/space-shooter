import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { readAudioSettings, useAudioSettingsStore } from './audioSettingsStore'
const key = 'space-shooter:audio:v1'
beforeEach(() => {
  // Node 25 exposes a host localStorage getter that can shadow jsdom's Storage.
  const data = new Map<string, string>()
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => { data.set(key, value) },
  })
})
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals() })

describe('audio preferences', () => {
  it('defaults to enabled channels at full volume', () => {
    expect(readAudioSettings()).toEqual({ music: { enabled: true, volume: 1 }, sfx: { enabled: true, volume: 1 } })
  })
  it('persists channels independently and restores on module initialization', async () => {
    useAudioSettingsStore.getState().setEnabled('music', false)
    useAudioSettingsStore.getState().setVolume('sfx', 0.4)
    expect(JSON.parse(window.localStorage.getItem(key)!)).toMatchObject({ music: { enabled: false }, sfx: { volume: 0.4 } })
    vi.resetModules()
    const restored = await import('./audioSettingsStore')
    expect(restored.useAudioSettingsStore.getState().settings).toEqual(readAudioSettings())
  })
  it('handles malformed storage and validates/clamps channel values', () => {
    window.localStorage.setItem(key, '{')
    expect(readAudioSettings().music.enabled).toBe(true)
    window.localStorage.setItem(key, JSON.stringify({ music: { enabled: 'no', volume: 7 }, sfx: { enabled: false, volume: -2 } }))
    expect(readAudioSettings()).toEqual({ music: { enabled: true, volume: 1 }, sfx: { enabled: false, volume: 0 } })
    useAudioSettingsStore.getState().setVolume('sfx', NaN)
    expect(Number.isFinite(useAudioSettingsStore.getState().settings.sfx.volume)).toBe(true)
  })
  it('continues when storage reads/writes throw', () => {
    vi.spyOn(window.localStorage, 'getItem').mockImplementation(() => { throw new Error('denied') })
    expect(() => readAudioSettings()).not.toThrow()
    vi.spyOn(window.localStorage, 'setItem').mockImplementation(() => { throw new Error('quota') })
    expect(() => useAudioSettingsStore.getState().setVolume('music', 0.25)).not.toThrow()
    expect(useAudioSettingsStore.getState().settings.music.volume).toBe(0.25)
  })
})
