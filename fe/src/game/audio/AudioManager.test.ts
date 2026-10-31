import { EventEmitter } from 'pixi.js'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ resume: vi.fn(), ensure: vi.fn(), get: vi.fn(), play: vi.fn() }))
vi.mock('@/game/assets/assets', () => ({ ensureBundle: mocks.ensure }))
vi.mock('pixi.js', async (original) => ({ ...await original<typeof import('pixi.js')>(), Assets: { get: mocks.get } }))
vi.mock('@pixi/sound', () => ({ sound: {
  context: { audioContext: { state: 'running', resume: mocks.resume } }, disableAutoPause: false,
} }))
import { AudioManager, bindAudioLifecycle, audioManager } from './AudioManager'
import { SFX_MANIFEST, type SfxId } from './audioCatalog'
import { useAudioSettingsStore } from '@/shared/store/audioSettingsStore'

function instance() {
  const value = Object.assign(new EventEmitter(), { paused: false, muted: false, volume: 1, stop: vi.fn() })
  value.stop.mockImplementation(() => value.emit('stop'))
  return value
}
const flush = async () => { await Promise.resolve(); await Promise.resolve(); await Promise.resolve() }
let manager: AudioManager
let now = 1000
beforeEach(async () => {
  vi.clearAllMocks()
  now = 1000
  vi.spyOn(performance, 'now').mockImplementation(() => now)
  mocks.ensure.mockResolvedValue(undefined)
  mocks.resume.mockResolvedValue(undefined)
  mocks.get.mockReturnValue({ isLoaded: true, play: mocks.play })
  mocks.play.mockImplementation(() => instance())
  useAudioSettingsStore.setState({ settings: { music: { enabled: true, volume: 1 }, sfx: { enabled: true, volume: 1 } } })
  manager = new AudioManager()
  await manager.initialize()
  vi.spyOn(manager, 'playMusic').mockImplementation(() => {})
})
afterEach(() => {
  manager.dispose()
  audioManager.dispose()
  vi.restoreAllMocks()
})
async function unlock() { manager.unlock(); await flush() }
const playedInstance = (index = 0) => mocks.play.mock.results[index].value as ReturnType<typeof instance>

describe('AudioManager', () => {
  it('drops locked SFX and ignores unknown IDs', async () => {
    manager.playSfx('laser_shot_01')
    expect(mocks.play).not.toHaveBeenCalled()
    await unlock()
    manager.playSfx('unknown' as SfxId)
    expect(mocks.play).not.toHaveBeenCalled()
  })

  it('calls resume synchronously in the gesture and retries after rejection', async () => {
    mocks.resume.mockRejectedValueOnce(new Error('NotAllowedError'))
    manager.unlock()
    expect(mocks.resume).toHaveBeenCalledTimes(1)
    await flush()
    manager.playSfx('laser_shot_01')
    expect(mocks.play).not.toHaveBeenCalled()
    await unlock()
    manager.playSfx('laser_shot_01')
    await flush()
    expect(mocks.play).toHaveBeenCalledOnce()
  })

  it('reads ready cache only and never loads missing or unloaded SFX', async () => {
    await unlock()
    mocks.get.mockReturnValueOnce(undefined).mockReturnValueOnce({ isLoaded: false, play: mocks.play })
    manager.playSfx('laser_shot_01')
    manager.playSfx('laser_shot_02')
    expect(mocks.ensure).not.toHaveBeenCalled()
    expect(mocks.play).not.toHaveBeenCalled()
    manager.playSfx('laser_shot_01')
    expect(mocks.play).toHaveBeenCalledOnce()
  })

  it('shares laser cooldown and reserves two voices even while play is pending', async () => {
    await unlock()
    let resolve!: (value: ReturnType<typeof instance>) => void
    mocks.play.mockImplementationOnce(() => new Promise((done) => { resolve = done }))
    manager.playSfx('laser_shot_01')
    now += 59
    manager.playSfx('laser_shot_02')
    expect(mocks.play).toHaveBeenCalledTimes(1)
    now++
    manager.playSfx('laser_shot_02')
    now += 60
    manager.playSfx('laser_shot_01')
    expect(mocks.play).toHaveBeenCalledTimes(2)
    manager.stopAll()
    const stale = instance()
    resolve(stale)
    await flush()
    expect(stale.stop).toHaveBeenCalledOnce()
  })

  it('enforces the global 16-voice cap and releases slots on end', async () => {
    await unlock()
    const ids = Object.keys(SFX_MANIFEST).filter((id) => id !== 'laser_shot_02' && id !== 'shield_hit') as SfxId[]
    for (const id of ids) manager.playSfx(id)
    await flush()
    expect(mocks.play).toHaveBeenCalledTimes(16)
    const first = playedInstance()
    first.emit('end')
    expect(first.listenerCount('stop')).toBe(0)
    now += 1000
    manager.playSfx(ids[0])
    await flush()
    expect(mocks.play).toHaveBeenCalledTimes(17)
  })

  it('multiplies manifest and user volumes once, including active instances', async () => {
    await unlock()
    manager.setVolume('sfx', 0.5)
    manager.playSfx('laser_shot_01')
    expect(mocks.play).toHaveBeenCalledWith(expect.objectContaining({ volume: 0.23 * 0.5 }))
    await flush()
    manager.setVolume('sfx', 0.25)
    expect(playedInstance().volume).toBe(0.23 * 0.25)
    manager.setEnabled('sfx', false)
    expect(playedInstance().muted).toBe(true)
    now += 1000
    manager.playSfx('player_hit')
    expect(mocks.play).toHaveBeenCalledOnce()
  })

  it('pauses gameplay independently while UI works, and hidden pauses everything', async () => {
    await unlock()
    manager.playSfx('laser_shot_01')
    await flush()
    manager.pause('run')
    expect(playedInstance().paused).toBe(true)
    manager.playSfx('player_hit')
    manager.playSfx('ui_pause')
    await flush()
    expect(mocks.play).toHaveBeenCalledTimes(2)
    const ui = playedInstance(1)
    expect(ui.paused).toBe(false)
    manager.pause('hidden')
    expect(ui.paused).toBe(true)
    manager.resume('hidden')
    expect(ui.paused).toBe(false)
    expect(playedInstance().paused).toBe(true)
    manager.resume('run')
    expect(playedInstance().paused).toBe(false)
  })

  it('plays death then game over and cancels the continuation on exit', async () => {
    await unlock()
    manager.playSfx('laser_shot_01')
    await flush()
    const laser = playedInstance()
    manager.finishRun('death')
    await flush()
    expect(laser.stop).toHaveBeenCalledOnce()
    expect(mocks.get).toHaveBeenLastCalledWith(SFX_MANIFEST.player_death.src)
    playedInstance(1).emit('end')
    await flush()
    expect(mocks.get).toHaveBeenLastCalledWith(SFX_MANIFEST.game_over.src)
    manager.finishRun('death')
    await flush()
    const death = playedInstance(3)
    manager.stopAll()
    death.emit('end')
    expect(mocks.play).toHaveBeenCalledTimes(4)
    expect(death.listenerCount('end')).toBe(0)
  })

  it('cancels pending result playback and its continuation after exit', async () => {
    await unlock()
    let resolve!: (value: ReturnType<typeof instance>) => void
    mocks.play.mockImplementationOnce(() => new Promise((done) => { resolve = done }))
    manager.finishRun('death')
    manager.stopAll()
    const stale = instance()
    resolve(stale)
    await flush()
    stale.emit('end')
    expect(stale.stop).toHaveBeenCalledOnce()
    expect(mocks.play).toHaveBeenCalledOnce()
  })

  it('can play extraction and skips a missing death cue without delaying game over', async () => {
    await unlock()
    manager.finishRun('extract')
    await flush()
    expect(mocks.get).toHaveBeenLastCalledWith(SFX_MANIFEST.extraction_success.src)
    mocks.get.mockReturnValueOnce(undefined)
    manager.finishRun('death')
    await flush()
    expect(mocks.get).toHaveBeenLastCalledWith(SFX_MANIFEST.game_over.src)
  })

  it('contains playback/context failures and releases failed slots', async () => {
    await unlock()
    mocks.play.mockRejectedValueOnce(new Error('device'))
    manager.playSfx('laser_shot_01')
    await flush()
    now += 60
    manager.playSfx('laser_shot_02')
    await flush()
    expect(mocks.play).toHaveBeenCalledTimes(2)
    mocks.resume.mockImplementationOnce(() => { throw new Error('device') })
    expect(() => manager.unlock()).not.toThrow()
  })

  it('does not unlock after dispose and cleans up gesture/visibility listeners', async () => {
    let done!: () => void
    mocks.resume.mockReturnValueOnce(new Promise<void>((resolve) => { done = resolve }))
    manager.unlock()
    manager.dispose()
    done()
    await flush()
    manager.playSfx('laser_shot_01')
    expect(mocks.play).not.toHaveBeenCalled()
    const unlockSpy = vi.spyOn(audioManager, 'unlock')
    const pauseSpy = vi.spyOn(audioManager, 'pause')
    const resumeSpy = vi.spyOn(audioManager, 'resume')
    const cleanup = bindAudioLifecycle()
    document.dispatchEvent(new Event('pointerdown'))
    expect(unlockSpy).toHaveBeenCalledOnce()
    vi.spyOn(document, 'hidden', 'get').mockReturnValue(true)
    document.dispatchEvent(new Event('visibilitychange'))
    expect(pauseSpy).toHaveBeenCalledWith('hidden')
    vi.spyOn(document, 'hidden', 'get').mockReturnValue(false)
    document.dispatchEvent(new Event('visibilitychange'))
    expect(resumeSpy).toHaveBeenCalledWith('hidden')
    cleanup()
    document.dispatchEvent(new Event('pointerdown'))
    expect(unlockSpy).toHaveBeenCalledOnce()
  })
})
