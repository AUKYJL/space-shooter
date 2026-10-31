import { ENEMY_ASSETS } from '@/test/enemyAssets'
import { act, cleanup, render, waitFor } from '@testing-library/react'
import { StrictMode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { EventBus } from '@/game/core/EventBus'
import type { RunBridgeEventMap } from '@/game/ui-bridge/gameToReact'
import { RUN_CONFIG, GAMEPLAY_CONFIG, WEAPON_TUNING } from '@/test/runConfig'
const mocks = vi.hoisted(() => ({ ensure: vi.fn(), create: vi.fn(), scene: vi.fn() }))
vi.mock('@/game/assets/assets', () => ({ ensureRunAssets: mocks.ensure }))
vi.mock('@/game/core/GameApp', () => ({ GameApp: { create: mocks.create } }))
vi.mock('@/game/scenes/RunScene', () => ({ RunScene: class { constructor(options: unknown) { mocks.scene(options) } } }))
vi.mock('@/game/assets/loadEnemyAssets', async () => {
  const { ENEMY_ASSETS } = await import('@/test/enemyAssets')
  return { loadEnemyAssets: async () => ENEMY_ASSETS }
})
vi.mock('@/game/assets/loadShipAssets', () => ({ loadShipAssets: async () => ({}) }))
vi.mock('@/game/assets/loadAsteroidAssets', () => ({ loadAsteroidAssets: async () => ({}) }))
vi.mock('@/game/assets/loadLootAssets', () => ({ loadLootAssets: async () => ({}) }))
vi.mock('@/game/assets/loadExtractionAssets', () => ({ loadExtractionAssets: async () => ({ base: {} }) }))
import { GameCanvas } from './GameCanvas'
const init = { runId: 'one', seed: 1, scoringConfigVersion: 7, scoringConfig: RUN_CONFIG,
  snapshot: { weaponId: 'basic_laser', damage: 1, fireRate: 2, maxHp: 5, scoringConfig: RUN_CONFIG, gameplayConfig: GAMEPLAY_CONFIG, weaponTuning: WEAPON_TUNING } }
function game() { return { destroy: vi.fn(), pause: vi.fn(), resume: vi.fn(), setScene: vi.fn(), getCanvas: vi.fn(), getViewportSize: vi.fn() } }
beforeEach(() => { vi.resetAllMocks(); mocks.ensure.mockResolvedValue(undefined); mocks.create.mockResolvedValue(game()) })
afterEach(cleanup)

describe('GameCanvas lifecycle', () => {
  it('waits for assets and creates one scene in StrictMode', async () => {
    let finish!: () => void
    mocks.ensure.mockReturnValue(new Promise<void>((done) => { finish = done }))
    const onReady = vi.fn()
    render(<StrictMode><GameCanvas init={init} events={new EventBus<RunBridgeEventMap>()} onReady={onReady} onError={vi.fn()} /></StrictMode>)
    expect(mocks.create).not.toHaveBeenCalled()
    await act(async () => finish())
    await waitFor(() => expect(onReady).toHaveBeenCalledOnce())
    expect(mocks.create).toHaveBeenCalledOnce()
    expect(mocks.scene).toHaveBeenCalledOnce()
    expect(mocks.scene).toHaveBeenCalledWith(expect.objectContaining({ enemyAssets: ENEMY_ASSETS }))
  })
  it('ignores completion after leaving during asset loading', async () => {
    let finish!: () => void
    mocks.ensure.mockReturnValue(new Promise<void>((done) => { finish = done }))
    const { unmount } = render(<GameCanvas init={init} events={new EventBus<RunBridgeEventMap>()} onReady={vi.fn()} onError={vi.fn()} />)
    unmount()
    await act(async () => finish())
    expect(mocks.create).not.toHaveBeenCalled()
  })
  it('destroys stale renderer initialization without affecting a newer mount', async () => {
    const old = game(), current = game()
    let finish!: () => void
    mocks.create.mockImplementationOnce(() => new Promise((done) => { finish = () => done(old) })).mockResolvedValueOnce(current)
    const events = new EventBus<RunBridgeEventMap>()
    const onReady = vi.fn(), onError = vi.fn()
    const { rerender, unmount } = render(<GameCanvas init={init} events={events} onReady={onReady} onError={onError} />)
    await waitFor(() => expect(mocks.create).toHaveBeenCalledOnce())
    rerender(<GameCanvas init={{ ...init, runId: 'two' }} events={events} onReady={onReady} onError={onError} />)
    await waitFor(() => expect(onReady).toHaveBeenCalledOnce())
    await act(async () => finish())
    expect(old.destroy).toHaveBeenCalledOnce()
    expect(current.destroy).not.toHaveBeenCalled()
    events.emit('run:pause', undefined)
    expect(current.pause).toHaveBeenCalledOnce()
    unmount()
    events.emit('run:pause', undefined)
    expect(current.pause).toHaveBeenCalledOnce()
    expect(current.destroy).toHaveBeenCalledOnce()
  })
  it('reports renderer failures and cleans up a failed scene', async () => {
    const runtime = game(), onError = vi.fn()
    runtime.setScene.mockImplementation(() => { throw new Error('scene failure') })
    mocks.create.mockResolvedValue(runtime)
    const events = new EventBus<RunBridgeEventMap>()
    const { unmount } = render(<GameCanvas init={init} events={events} onReady={vi.fn()} onError={onError} />)
    await waitFor(() => expect(onError).toHaveBeenCalledWith(expect.objectContaining({ message: 'scene failure' })))
    events.emit('run:pause', undefined)
    expect(runtime.pause).not.toHaveBeenCalled()
    unmount()
    expect(runtime.destroy).toHaveBeenCalledOnce()
  })
})
