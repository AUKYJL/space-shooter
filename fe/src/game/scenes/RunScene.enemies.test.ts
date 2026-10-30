import { ENEMY_CONFIG } from '@/test/enemyConfig'
import { Container } from 'pixi.js'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { RunScene } from './RunScene'
import { EventBus } from '@/game/core/EventBus'
import type { RunBridgeEventMap, RunSummary } from '@/game/ui-bridge/gameToReact'
import type { SpawnSystem } from '@/game/systems/SpawnSystem'
import type { ShootingSystem } from '@/game/systems/ShootingSystem'
import type { DifficultySystem } from '@/game/systems/DifficultySystem'
import type { PlayerShip } from '@/game/entities/PlayerShip'
import type { ScoringConfig } from '@/modules/runs/api/runsApi'
import { Bullet } from '@/game/entities/Bullet'

const config = { version: 4, asteroidPoints: { normal: 10, fast: 20, big: 30, armored: 50 }, stageBonus: 100,
  enemyPoints: { sentryTurret: 100 },
  enemies: ENEMY_CONFIG }
const droneConfig = { ...config, enemyPoints: { sentryTurret: 100, shieldDrone: 50 },
  enemies: { ...ENEMY_CONFIG, shieldDrone: { ...ENEMY_CONFIG.shieldDrone, spawnChance: 1 } } }
function setup(selectedConfig: ScoringConfig = config, stage = 2) {
  const events = new EventBus<RunBridgeEventMap>()
  const scene = new RunScene({ canvas: document.createElement('canvas'), events, scoringConfig: selectedConfig,
    getViewportSize: () => ({ width: 400, height: 800 }) })
  scene.mount(new Container())
  const state = scene as unknown as { spawns: SpawnSystem; difficulty: DifficultySystem; player: PlayerShip; shooting: ShootingSystem }
  vi.spyOn(state.spawns, 'getAsteroids').mockReturnValue([])
  for (let i = 1; i < stage; i++) state.difficulty.advanceStage()
  scene.update(16)
  scene.update(2000)
  const enemy = state.spawns.getEnemies()[0]
  return { scene, state, events, enemy }
}

describe('RunScene enemies', () => {
  afterEach(() => vi.restoreAllMocks())
  it('reports drone score to HUD and finish, freezes on pause, and clears active links on finish', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.25)
    const { scene, state, events, enemy } = setup(droneConfig, 3)
    const drone = state.spawns.getEnemies().find((item) => item.type === 'shieldDrone')!
    scene.update(1200)
    const position = { ...drone.position }
    events.emit('run:pause', undefined)
    scene.update(10000)
    expect(drone.position).toEqual(position)
    events.emit('run:resume', undefined)
    const hud = vi.fn()
    events.on('run:hud-update', hud)
    drone.takeDamage(100)
    scene.update(100)
    expect(hud).toHaveBeenLastCalledWith(expect.objectContaining({ score: 250,
      enemiesDestroyed: { sentryTurret: 0, shieldDrone: 1 } }))
    const result = vi.fn()
    events.on('run:finished', result)
    state.player.hp = 0
    scene.update(0)
    expect(result).toHaveBeenCalledOnce()
    expect(result).toHaveBeenCalledWith(expect.objectContaining({ score: 250,
      enemiesDestroyed: { sentryTurret: 0, shieldDrone: 1 } }))
    expect(state.spawns.getEnemies()).toHaveLength(0)
    expect(drone.turret).toBeNull()
    expect(enemy.type === 'sentryTurret' && enemy.shieldDrone).toBeNull()
    scene.destroy()
  })

  it('does not reconstruct enemy defaults for legacy snapshots', () => {
    const { scene, state } = setup({ ...droneConfig, version: 2 }, 3)
    expect(state.spawns.getEnemies()).toHaveLength(0)
    scene.destroy()
  })

  it('counts a lethal hit exactly once before the death result, with no loot or charge', () => {
    const { scene, state, events, enemy } = setup()
    const results: RunSummary[] = []
    events.on('run:finished', (summary) => results.push(summary))
    const bullet = new Bullet()
    bullet.spawn({ x: enemy.position.x, y: enemy.position.y, directionX: 0, directionY: 0, speed: 0, damage: 100 })
    vi.spyOn(state.shooting, 'getBullets').mockReturnValue([bullet])
    // A hostile projectile provides the lethal player damage in the same collision pass.
    state.player.hp = 1
    const hostile = new Bullet()
    hostile.spawn({ x: state.player.view.position.x, y: state.player.view.position.y,
      directionX: 0, directionY: 0, speed: 0 })
    state.spawns.getEnemyBullets().push(hostile)
    scene.update(0)
    scene.update(16)
    expect(results).toHaveLength(1)
    expect(results[0]).toMatchObject({ score: 200, endedBy: 'death', enemiesDestroyed: { sentryTurret: 1 },
      destroyed: { normal: 0, fast: 0, big: 0, armored: 0 },
      collected: { coins: 0, iron: 0, gold: 0, crystal: 0 } })
    expect(state.spawns.getEnemies()).toHaveLength(0)
    expect(state.spawns.getEnemyBullets()).toHaveLength(0)
    bullet.destroy()
    scene.destroy()
  })

  it('freezes enemies, bullets and spawn timers while paused, then resumes and resets on restart', () => {
    const { scene, state, events, enemy } = setup()
    scene.update(3000)
    const bullet = state.spawns.getEnemyBullets()[0]
    const position = { x: bullet.view.position.x, y: bullet.view.position.y }
    const y = enemy.position.y
    events.emit('run:pause', undefined)
    scene.update(20000)
    expect(enemy.position.y).toBe(y)
    expect(bullet.view.position.x).toBe(position.x)
    expect(bullet.view.position.y).toBe(position.y)
    expect(state.spawns.getEnemies()[0]).toBe(enemy)
    events.emit('run:resume', undefined)
    scene.update(100)
    expect(bullet.view.position.y).not.toBe(position.y)
    scene.destroy()
    expect(bullet.view.destroyed).toBe(true)
    const next = setup()
    next.state.player.hp = 0
    const result = vi.fn()
    next.events.on('run:finished', result)
    next.scene.update(0)
    expect(result).toHaveBeenCalledWith(expect.objectContaining({ enemiesDestroyed: { sentryTurret: 0, shieldDrone: 0 }, score: 100 }))
    next.scene.destroy()
  })
})
