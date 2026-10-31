import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { AudioSettings } from './AudioSettings'
import { readAudioSettings, useAudioSettingsStore } from '@/shared/store/audioSettingsStore'

beforeEach(() => {
  const data = new Map<string, string>()
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => { data.set(key, value) },
  })
})
afterEach(() => { cleanup(); vi.unstubAllGlobals() })
it('persists SFX volume and mute without changing existing music settings', () => {
  useAudioSettingsStore.setState({ settings: { music: { enabled: false, volume: 0.3 }, sfx: { enabled: true, volume: 1 } } })
  render(<AudioSettings />)
  expect(screen.getByRole('slider', { name: 'Music Volume' })).toHaveValue('30')
  fireEvent.change(screen.getByRole('slider', { name: 'SFX Volume' }), { target: { value: '35' } })
  fireEvent.click(screen.getByRole('checkbox', { name: 'SFX Mute' }))
  expect(readAudioSettings()).toEqual({ music: { enabled: false, volume: 0.3 }, sfx: { enabled: false, volume: 0.35 } })
})

it('changes music volume and mute independently', () => {
  useAudioSettingsStore.setState({ settings: { music: { enabled: true, volume: 1 }, sfx: { enabled: true, volume: 0.7 } } })
  render(<AudioSettings />)
  fireEvent.change(screen.getByRole('slider', { name: 'Music Volume' }), { target: { value: '25' } })
  fireEvent.click(screen.getByRole('checkbox', { name: 'Music Mute' }))
  expect(screen.getByText('25%')).toBeInTheDocument()
  expect(readAudioSettings()).toEqual({ music: { enabled: false, volume: 0.25 }, sfx: { enabled: true, volume: 0.7 } })
})
