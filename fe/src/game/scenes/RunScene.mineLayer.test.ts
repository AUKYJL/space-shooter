import { GAMEPLAY_CONFIG, SCENE_TUNING } from '@/test/runConfig'
import { Container } from 'pixi.js'
import { describe, expect, it, vi } from 'vitest'
import { RunScene } from './RunScene'
import { EventBus } from '@/game/core/EventBus'
import type { RunBridgeEventMap } from '@/game/ui-bridge/gameToReact'
import type { SpawnSystem } from '@/game/systems/SpawnSystem'
import type { DifficultySystem } from '@/game/systems/DifficultySystem'
import type { PlayerShip } from '@/game/entities/PlayerShip'
import { ENEMY_CONFIG } from '@/test/enemyConfig'

function setup(version = 7) {
  const config = { version, asteroidPoints: { normal: 10, fast: 20, big: 30, armored: 50 }, stageBonus: 100,
    enemyPoints: { sentryTurret: 100, shieldDrone: 50, mineLayer: 150 },
    enemies: { ...ENEMY_CONFIG, sentryTurret: { ...ENEMY_CONFIG.sentryTurret, spawnChance: 0 } } }
  const events = new EventBus<RunBridgeEventMap>()
  const scene = new RunScene({ gameplayConfig: GAMEPLAY_CONFIG, weaponId: 'basic_laser', tuning: SCENE_TUNING, canvas: document.createElement('canvas'), events, scoringConfig: config,
    getViewportSize: () => ({ width: 400, height: 800 }) })
  scene.mount(new Container())
  const state = scene as unknown as { spawns: SpawnSystem; difficulty: DifficultySystem; player: PlayerShip }
  vi.spyOn(state.spawns, 'getAsteroids').mockReturnValue([])
  for (let i = 1; i < 4; i++) state.difficulty.advanceStage()
  scene.update(16)
  scene.update(2000)
  return { scene, state, events }
}

describe('RunScene MineLayer', () => {
  it.each(['death', 'extract', 'destroy'] as const)('freezes on pause, scores to HUD/summary once and clears on %s', (ending) => {
    const { scene, state, events } = setup()
    const ship = state.spawns.getEnemies().find((enemy) => enemy.type === 'mineLayer')!
    scene.update(1000)
    scene.update(500)
    const mine = state.spawns.getMines()[0]
    events.emit('run:pause', undefined)
    const position = { ...ship.position }
    scene.update(100000)
    expect(ship.position).toEqual(position)
    expect(mine.state).toBe('dormant')
    events.emit('run:resume', undefined)
    scene.update(1199)
    expect(mine.state).toBe('dormant')
    scene.update(1)
    expect(mine.state).toBe('armed')
    const hud = vi.fn()
    events.on('run:hud-update', hud)
    ship.takeDamage(100)
    scene.update(100)
    scene.update(100)
    expect(hud).toHaveBeenLastCalledWith(expect.objectContaining({ score: 450,
      charge: 0, coins: 0, enemiesDestroyed: { sentryTurret: 0, shieldDrone: 0, mineLayer: 1 } }))
    expect(state.spawns.getMines()).toContain(mine)
    const result = vi.fn()
    events.on('run:finished', result)
    if (ending === 'destroy') scene.destroy()
    else {
      if (ending === 'death') state.player.hp = 0
      else {
        const extraction = (scene as unknown as { extraction: { consumeExtracted: () => boolean } }).extraction
        vi.spyOn(extraction, 'consumeExtracted').mockReturnValueOnce(true)
      }
      scene.update(0)
      scene.update(16)
      expect(result).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ score: 450,
        enemiesDestroyed: { sentryTurret: 0, shieldDrone: 0, mineLayer: 1 } }))
      scene.destroy()
    }
    expect(state.spawns.getMines()).toHaveLength(0)
    expect(state.spawns.getEnemies()).toHaveLength(0)
    expect(mine.visible).toBe(false)
  })

  it('rejects an older snapshot even if its enemy config is present', () => {
    expect(() => setup(4)).toThrow('Unsupported run configuration')
  })
})
