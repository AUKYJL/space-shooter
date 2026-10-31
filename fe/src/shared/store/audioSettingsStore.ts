import { create } from 'zustand'

export type AudioChannel = 'music' | 'sfx'
export type ChannelSettings = { enabled: boolean; volume: number }
export type AudioSettings = Record<AudioChannel, ChannelSettings>
const storageKey = 'space-shooter:audio:v1'
const defaults = (): AudioSettings => ({ music: { enabled: true, volume: 1 }, sfx: { enabled: true, volume: 1 } })

export function readAudioSettings(): AudioSettings {
  const settings = defaults()
  try {
    const data: unknown = JSON.parse(window.localStorage.getItem(storageKey) ?? 'null')
    if (!data || typeof data !== 'object') return settings
    for (const channel of ['music', 'sfx'] as const) {
      const value: unknown = (data as Record<string, unknown>)[channel]
      if (!value || typeof value !== 'object') continue
      const { enabled, volume } = value as Record<string, unknown>
      if (typeof enabled === 'boolean') settings[channel].enabled = enabled
      if (typeof volume === 'number' && Number.isFinite(volume)) settings[channel].volume = Math.max(0, Math.min(1, volume))
    }
  } catch { /* Storage can be unavailable in embedded/private browsers. */ }
  return settings
}

export const useAudioSettingsStore = create<{
  settings: AudioSettings
  setEnabled: (channel: AudioChannel, enabled: boolean) => void
  setVolume: (channel: AudioChannel, volume: number) => void
}>((set) => ({
  settings: readAudioSettings(),
  setEnabled: (channel, enabled) => set(({ settings }) => ({ settings: { ...settings, [channel]: { ...settings[channel], enabled } } })),
  setVolume: (channel, volume) => {
    if (!Number.isFinite(volume)) return
    set(({ settings }) => ({ settings: { ...settings, [channel]: { ...settings[channel], volume: Math.max(0, Math.min(1, volume)) } } }))
  },
}))

useAudioSettingsStore.subscribe(({ settings }) => {
  try { window.localStorage.setItem(storageKey, JSON.stringify(settings)) } catch { /* Non-fatal. */ }
})
