import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AudioManager } from './AudioManager'
import { useAudioSettingsStore } from '@/shared/store/audioSettingsStore'

vi.mock('@pixi/sound', () => ({ sound: { context: {}, disableAutoPause: false } }))
const elements: FakeAudio[] = []
class FakeAudio {
  src = ''
  preload = ''
  currentTime = 0
  loop = false
  volume = 1
  paused = true
  onended: (() => void) | null = null
  onerror: (() => void) | null = null
  load = vi.fn()
  pause = vi.fn(() => { this.paused = true })
  play = vi.fn((): Promise<void> => {
    expect(elements.filter((element) => !element.paused && element !== this)).toHaveLength(0)
    this.paused = false
    return Promise.resolve()
  })
  removeAttribute = vi.fn(() => { this.src = '' })
  constructor() { elements.push(this) }
  end() { this.paused = true; this.onended?.() }
}
let manager: AudioManager
const flush = async () => { await Promise.resolve(); await Promise.resolve(); await Promise.resolve() }
const advance = async (ms = 300) => { await vi.advanceTimersByTimeAsync(ms) }
const current = () => elements.find((element) => !element.paused)!
const loaded = () => elements.filter((element) => element.src).map((element) => element.src)

beforeEach(async () => {
  vi.useFakeTimers()
  vi.stubGlobal('Audio', FakeAudio)
  elements.length = 0
  useAudioSettingsStore.setState({ settings: { music: { enabled: true, volume: 1 }, sfx: { enabled: true, volume: 1 } } })
  manager = new AudioManager()
  await manager.initialize()
})
afterEach(() => {
  manager.dispose()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

describe('HTML music lifecycle', () => {
  it('allocates lazily and loops only menu without preparing gameplay', async () => {
    expect(elements).toHaveLength(0)
    manager.playMusic('menu-theme')
    await flush()
    expect(elements).toHaveLength(2)
    expect(loaded()).toEqual(['/music/menu-theme.ogg'])
    expect(current().loop).toBe(true)
    await advance()
    expect(current().volume).toBe(1)
    manager.playMusic('menu-theme')
    expect(current().load).toHaveBeenCalledOnce()
    expect(current().play).toHaveBeenCalledOnce()
  })

  it.each([[0, '01', '02'], [0.5, '02', '03'], [0.99, '03', '01']])('chooses random first track (%s) and prepares exactly one next', async (random, first, next) => {
    vi.spyOn(Math, 'random').mockReturnValue(Number(random))
    manager.startRunMusic('one')
    await flush()
    expect(current().src).toBe(`/music/gameplay-${first}.ogg`)
    expect(loaded()).toEqual([`/music/gameplay-${first}.ogg`, `/music/gameplay-${next}.ogg`])
    manager.startRunMusic('one')
    expect(Math.random).toHaveBeenCalledOnce()
    expect(current().play).toHaveBeenCalledOnce()
  })

  it('cycles tracks by swapping prepared elements without reloading the next source', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0)
    manager.startRunMusic('one')
    await flush()
    const first = current()
    const prepared = elements[1]
    first.end()
    await flush()
    expect(current()).toBe(prepared)
    expect(prepared.load).toHaveBeenCalledOnce()
    expect(first.src).toBe('/music/gameplay-03.ogg')
    prepared.end()
    await flush()
    expect(current().src).toBe('/music/gameplay-03.ogg')
    current().end()
    await flush()
    expect(current().src).toBe('/music/gameplay-01.ogg')
    expect(elements).toHaveLength(2)
  })

  it('fades sequentially and only activates the latest requested context', async () => {
    manager.playMusic('menu-theme')
    await flush(); await advance()
    const menu = current()
    manager.startRunMusic('one')
    await advance(150)
    expect(menu.volume).toBeCloseTo(0.5)
    manager.playMusic('result-theme')
    await advance()
    await flush()
    expect(menu.pause).toHaveBeenCalled()
    expect(current().src).toBe('/music/result-theme.ogg')
    await advance()
    expect(current().volume).toBe(1)
    expect(loaded().some((url) => url.includes('gameplay'))).toBe(false)
  })

  it('plays result once and does not restart on settings, gestures or visibility', async () => {
    manager.finishRun('extract')
    await flush(); await advance()
    const result = current()
    expect(result.loop).toBe(false)
    result.end()
    manager.setVolume('music', 0.5)
    manager.pause('hidden'); manager.resume('hidden'); manager.unlock()
    manager.playMusic('result-theme')
    await flush()
    expect(result.play).toHaveBeenCalledOnce()
    expect(result.paused).toBe(true)
    manager.startRunMusic('two')
    await flush()
    expect(current().src).toContain('/music/gameplay-')
  })

  it('preserves position across pause/mute and composes run and hidden reasons', async () => {
    manager.startRunMusic('one')
    await flush(); await advance()
    const track = current()
    track.currentTime = 42
    manager.pause('run')
    await advance(150)
    expect(track.volume).toBeCloseTo(0.5)
    manager.pause('hidden')
    expect(track.paused).toBe(true)
    manager.resume('hidden')
    expect(track.paused).toBe(true)
    manager.resume('run')
    await flush(); await advance()
    expect(track.currentTime).toBe(42)
    expect(track.paused).toBe(false)
    manager.setEnabled('music', false)
    expect(track.paused).toBe(true)
    manager.setEnabled('music', true)
    await flush(); await advance()
    expect(track.currentTime).toBe(42)
    expect(track.load).toHaveBeenCalledOnce()
  })

  it('completes run-pause fade and resumes, including when interrupted mid-fade', async () => {
    manager.playMusic('menu-theme')
    await flush(); await advance()
    const track = current()
    manager.pause('run'); await advance()
    expect(track.paused).toBe(true)
    manager.resume('run'); await flush(); await advance()
    manager.pause('run'); await advance(150)
    manager.resume('run'); await advance()
    expect(track.paused).toBe(false)
    expect(track.volume).toBe(1)
  })

  it('updates volume during a fade independently of SFX', async () => {
    manager.playMusic('menu-theme')
    await flush(); await advance(150)
    manager.setVolume('music', 0.4)
    expect(current().volume).toBeCloseTo(0.2)
    manager.setVolume('sfx', 0.1)
    expect(current().volume).toBeCloseTo(0.2)
    await advance(150)
    expect(current().volume).toBeCloseTo(0.4)
  })

  it('retries autoplay synchronously on a gesture without waiting for Pixi', async () => {
    manager.pause('hidden')
    manager.playMusic('menu-theme')
    const track = elements[0]
    track.play.mockRejectedValueOnce(new DOMException('gesture required', 'NotAllowedError'))
    manager.resume('hidden')
    await flush()
    manager.setVolume('music', 0.4)
    expect(track.play).toHaveBeenCalledOnce()
    manager.unlock()
    expect(track.play).toHaveBeenCalledTimes(2)
    await flush()
    expect(track.paused).toBe(false)
  })

  it('skips failed active and prepared tracks and stops when all are unavailable', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0)
    manager.startRunMusic('one')
    await flush()
    elements[1].onerror?.()
    expect(elements[1].src).toBe('/music/gameplay-03.ogg')
    current().onerror?.()
    await flush()
    expect(current().src).toBe('/music/gameplay-03.ogg')
    current().onerror?.()
    manager.unlock(); manager.resume('hidden')
    expect(elements.every((element) => element.paused)).toBe(true)
    expect(elements.map((element) => element.load.mock.calls.length)).toEqual([1, 2])
    manager.startRunMusic('two')
    await flush()
    expect(current().src).toBe('/music/gameplay-01.ogg')
  })

  it('does not retry a failed menu/result or restart from stale ended callbacks', async () => {
    manager.playMusic('menu-theme')
    await flush()
    const track = current()
    const staleEnd = track.onended
    track.onerror?.()
    manager.unlock(); manager.setVolume('music', 0.2)
    expect(track.play).toHaveBeenCalledOnce()
    manager.playMusic('result-theme')
    staleEnd?.()
    await flush()
    expect(current().src).toBe('/music/result-theme.ogg')
  })

  it('ignores pending playback after switching or disposing and releases resources', async () => {
    manager.pause('hidden'); manager.playMusic('menu-theme')
    const track = elements[0]
    let resolve!: () => void
    track.play.mockImplementationOnce(() => { track.paused = false; return new Promise<void>((done) => { resolve = done }) })
    manager.resume('hidden')
    manager.playMusic('result-theme')
    await advance()
    resolve(); await flush()
    expect(current().src).toBe('/music/result-theme.ogg')
    const stale = current().onended
    manager.dispose()
    stale?.(); await advance()
    expect(elements.every((element) => element.paused && element.src === '')).toBe(true)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('pauses immediately if hidden during a context transition', async () => {
    manager.playMusic('menu-theme'); await flush(); await advance()
    manager.startRunMusic('one'); await advance(150)
    manager.pause('hidden')
    expect(elements.every((element) => element.paused)).toBe(true)
    await advance()
    expect(elements.every((element) => element.paused)).toBe(true)
    manager.resume('hidden'); await flush()
    expect(current().src).toContain('/music/gameplay-')
  })
})

it('clears obsolete prefetch on result and releases downloads on stop', async () => {
  manager.startRunMusic('one'); await flush(); await advance()
  manager.playMusic('result-theme'); await advance(); await flush()
  expect(loaded()).toEqual(['/music/result-theme.ogg'])
  manager.stopMusic(); await advance()
  expect(loaded()).toEqual([])
})

it('contains rejected play failures and retries failed sources only in a new context', async () => {
  vi.spyOn(Math, 'random').mockReturnValue(0)
  manager.pause('hidden'); manager.startRunMusic('one')
  for (const element of elements) element.play.mockRejectedValue(new DOMException('unsupported', 'NotSupportedError'))
  manager.resume('hidden'); await flush(); await flush(); await flush()
  expect(elements.every((element) => element.paused)).toBe(true)
  const loads = elements.reduce((sum, element) => sum + element.load.mock.calls.length, 0)
  manager.unlock(); await flush()
  expect(elements.reduce((sum, element) => sum + element.load.mock.calls.length, 0)).toBe(loads)
  for (const element of elements) element.play.mockImplementation(() => { element.paused = false; return Promise.resolve() })
  manager.startRunMusic('two'); await flush()
  expect(current().src).toBe('/music/gameplay-01.ogg')
  expect(elements.reduce((sum, element) => sum + element.load.mock.calls.length, 0)).toBeGreaterThan(loads)
})
