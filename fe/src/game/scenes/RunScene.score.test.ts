import { GAMEPLAY_CONFIG, RUN_CONFIG, SCENE_TUNING } from '@/test/runConfig'
import { Container } from 'pixi.js'
import { describe, expect, it, vi } from 'vitest'
import { RunScene } from './RunScene'
import { EventBus } from '@/game/core/EventBus'
import type { RunBridgeEventMap, RunHudState, RunSummary } from '@/game/ui-bridge/gameToReact'

const makeConfig = () => ({ ...RUN_CONFIG, version: 7, asteroidPoints: { normal: 10, fast: 20, big: 30, armored: 50 }, stageBonus: 100 })
function setup(config = makeConfig()) {
  const events = new EventBus<RunBridgeEventMap>()
  const scene = new RunScene({ gameplayConfig: GAMEPLAY_CONFIG, weaponId: 'basic_laser', tuning: SCENE_TUNING, canvas: document.createElement('canvas'), getViewportSize: () => ({ width: 400, height: 800 }), events, scoringConfig: config })
  scene.mount(new Container())
  const state = scene as unknown as {
    spawns: { onAsteroidDestroyed: (asteroid: { type: string; view: { position: { x: number; y: number } } }) => void }
    extraction: { consumeBaseExpired: () => boolean; consumeExtracted: () => boolean }
    player: { hp: number }
  }
  const destroyAsteroid = (type: string) => state.spawns.onAsteroidDestroyed({ type, view: { position: { x: 0, y: 0 } } })
  return { scene, events, state, destroyAsteroid }
}

describe('RunScene score', () => {
  it('emits score via HUD, counts a stage only once and pins config', () => {
    const config = makeConfig()
    const { scene, state, events, destroyAsteroid } = setup(config)
    let hud: RunHudState | undefined
    events.on('run:hud-update', (value) => { hud = value })
    scene.update(16)
    expect(hud?.score).toBe(0)
    for (const type of ['normal', 'fast', 'big', 'armored']) destroyAsteroid(type)
    config.asteroidPoints.armored = 500
    vi.spyOn(state.extraction, 'consumeBaseExpired').mockReturnValueOnce(true)
    scene.update(100)
    expect(hud).toMatchObject({ score: 210, stage: 2 })
    scene.update(100)
    expect(hud?.score).toBe(210)
    scene.destroy()
  })
  it.each(['death', 'extract'] as const)('retains score at %s and emits finish once', (endedBy) => {
    const { scene, events, state, destroyAsteroid } = setup()
    const results: RunSummary[] = []
    events.on('run:finished', (summary) => results.push(summary))
    destroyAsteroid('armored')
    if (endedBy === 'death') state.player.hp = 0
    else vi.spyOn(state.extraction, 'consumeExtracted').mockReturnValueOnce(true)
    scene.update(16); scene.update(16)
    expect(results).toHaveLength(1)
    expect(results[0]).toMatchObject({ score: 50, stageReached: 1, endedBy })
    if (endedBy === 'death') expect(results[0].banked).toEqual({ coins: 0, iron: 0, gold: 0, crystal: 0 })
    scene.destroy()
  })
  it('starts a new scene with zero score and counters', () => {
    const previous = setup(); previous.destroyAsteroid('big'); previous.scene.destroy()
    const next = setup()
    const listener = vi.fn(); next.events.on('run:hud-update', listener)
    next.scene.update(16)
    expect(listener).toHaveBeenCalledWith(expect.objectContaining({ score: 0, stage: 1, coins: 0 }))
    next.scene.destroy()
  })
})
