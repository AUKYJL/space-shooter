import { ENEMY_ASSETS } from '@/test/enemyAssets'
import { Container } from 'pixi.js'
import { describe, expect, it, vi } from 'vitest'
import { GAMEPLAY_CONFIG, RUN_CONFIG, SCENE_TUNING, BULLET_OPTIONS } from '@/test/runConfig'
import { ENEMY_CONFIG } from '@/test/enemyConfig'
import { EventBus } from '@/game/core/EventBus'
import { PlayerShip } from '@/game/entities/PlayerShip'
import { Bullet } from '@/game/entities/Bullet'
import { ShootingSystem } from './ShootingSystem'
import type { InputSystem } from './InputSystem'
import { ChargeSystem } from './ChargeSystem'
import { LootSystem } from './LootSystem'
import type { LootType } from '@/game/entities/LootDrop'
import { ExtractionSystem } from './ExtractionSystem'
import { SpawnSystem } from './SpawnSystem'
import { CollisionSystem } from './CollisionSystem'
import { RunScene } from '@/game/scenes/RunScene'
import { audioManager } from '@/game/audio/AudioManager'
import type { RunBridgeEventMap } from '@/game/ui-bridge/gameToReact'

const viewport = () => ({ width: 400, height: 800 })

describe('gameplay SFX transitions', () => {
  it('plays one alternating laser per shotgun volley and charge fire only for a spawned shot', () => {
    const player = new PlayerShip({ config: GAMEPLAY_CONFIG.player, maxHp: 5 })
    const onSfx = vi.fn()
    player.setPosition(200, 700)
    const system = new ShootingSystem(GAMEPLAY_CONFIG.weapons, {
      player, input: { getFireState: () => ({ isFiring: true }) } as InputSystem,
      getViewportSize: viewport, bulletsContainer: new Container(), weaponId: 'shotgun',
      cooldownMs: 100, bulletDamage: 1, chargedDamage: 8, onSfx,
    })
    system.update(0)
    expect(system.getBullets()).toHaveLength(GAMEPLAY_CONFIG.weapons.variants.shotgun.pellets)
    system.fireChargedShot()
    system.fireChargedShot()
    system.update(1000)
    expect(onSfx.mock.calls).toEqual([['laser_shot_01'], ['charge_fire'], ['laser_shot_02']])
    system.destroy(); player.destroy()
  })

  it('signals charge start/readiness on transitions using the actual activation threshold', () => {
    const events = new EventBus<RunBridgeEventMap>()
    const shooting = { fireChargedShot: vi.fn() } as unknown as ShootingSystem
    const onSfx = vi.fn()
    const system = new ChargeSystem({ activationThreshold: 0.5, gains: { normal: 0.25, fast: 0.25, big: 0.25, armored: 0.25 } }, { events, shooting, onSfx })
    system.mount()
    events.emit('charge:activate', undefined)
    expect(shooting.fireChargedShot).not.toHaveBeenCalled()
    for (let i = 0; i < 6; i++) system.onAsteroidDestroyed('normal')
    expect(onSfx.mock.calls).toEqual([['charge_up'], ['charge_ready']])
    events.emit('charge:activate', undefined)
    expect(shooting.fireChargedShot).toHaveBeenCalledOnce()
    system.onAsteroidDestroyed('normal')
    expect(onSfx).toHaveBeenLastCalledWith('charge_up')
    system.destroy()
  })

  it('signals normal and rare loot only when collected, not expired', () => {
    const player = new PlayerShip({ config: GAMEPLAY_CONFIG.player, maxHp: 5 })
    player.setPosition(100, 100)
    const onSfx = vi.fn()
    const system = new LootSystem(GAMEPLAY_CONFIG.loot, { player, container: new Container(), onSfx })
    const spawn = (system as unknown as { spawnOne: (args: { type: LootType; amount: number; x: number; y: number }) => void }).spawnOne.bind(system)
    for (const type of ['coins', 'iron', 'gold', 'crystal'] as const) spawn({ type, amount: 1, x: 100, y: 100 })
    system.update(0)
    expect(onSfx.mock.calls).toEqual([['rare_pickup'], ['rare_pickup'], ['loot_pickup'], ['loot_pickup']])
    spawn({ type: 'coins', amount: 1, x: 300, y: 600 })
    system.update(GAMEPLAY_CONFIG.loot.lifetimeMs + 1)
    expect(onSfx).toHaveBeenCalledTimes(4)
    system.destroy(); player.destroy()
  })

  it('plays extraction open once per base appearance', () => {
    const player = new PlayerShip({ config: GAMEPLAY_CONFIG.player, maxHp: 5 })
    const onSfx = vi.fn()
    const system = new ExtractionSystem(GAMEPLAY_CONFIG.extraction, { player, container: new Container(), getViewportSize: viewport, onSfx })
    system.update(GAMEPLAY_CONFIG.extraction.firstSpawnMs)
    system.update(0)
    expect(onSfx.mock.calls).toEqual([['extraction_open']])
    system.destroy(); player.destroy()
  })

  it.each(['normal', 'fast', 'big', 'armored'] as const)('distinguishes asteroid hit and destruction (%s), ignoring misses', (type) => {
    const onSfx = vi.fn()
    const system = new SpawnSystem(GAMEPLAY_CONFIG, { enemyAssets: ENEMY_ASSETS, container: new Container(), getViewportSize: viewport,
      getPlayerPosition: () => ({ x: 200, y: 700 }), enemies: ENEMY_CONFIG, rng: () => 0.5, onSfx })
    system.setTuning({ maxActive: 1, spawnEveryMs: 100000, typeWeights: { normal: 0, fast: 0, big: 0, armored: 0, [type]: 1 }, stageMultiplier: 1 })
    system.update(0)
    const asteroid = system.getAsteroids()[0]
    const player = new PlayerShip({ config: GAMEPLAY_CONFIG.player, maxHp: 5 })
    player.setPosition(200, 700)
    const bullet = new Bullet()
    bullet.spawn({ ...BULLET_OPTIONS, x: 10000, y: 10000, damage: 0.25, directionX: 0, directionY: 0, speed: 0 })
    const shooting = { getBullets: () => [bullet], despawnBullet: () => bullet.despawn() } as unknown as ShootingSystem
    const collisions = new CollisionSystem(500, { player, spawns: system, shooting, onSfx })
    collisions.update(0)
    expect(onSfx).not.toHaveBeenCalled()
    bullet.view.position.copyFrom(asteroid.position)
    collisions.update(0)
    expect(onSfx).toHaveBeenLastCalledWith('asteroid_hit')
    asteroid.takeDamage(100000)
    system.update(0)
    system.update(0)
    expect(onSfx.mock.calls).toEqual([['asteroid_hit'], [type === 'big' || type === 'armored' ? 'asteroid_explosion' : 'asteroid_break']])
    system.destroy(); player.destroy(); bullet.destroy()
  })

  it('signals the existing stage transition once without advancing while paused', () => {
    const play = vi.spyOn(audioManager, 'playSfx').mockImplementation(() => {})
    const events = new EventBus<RunBridgeEventMap>()
    const scene = new RunScene({ enemyAssets: ENEMY_ASSETS, gameplayConfig: GAMEPLAY_CONFIG, scoringConfig: RUN_CONFIG, weaponId: 'basic_laser', tuning: SCENE_TUNING,
      events, canvas: document.createElement('canvas'), getViewportSize: viewport })
    scene.mount(new Container())
    const extraction = (scene as unknown as { extraction: ExtractionSystem }).extraction
    extraction.forceSpawnForTest({ x: 10, y: 10, ttlMs: 1 })
    events.emit('run:pause', undefined)
    scene.update(1)
    expect(play).not.toHaveBeenCalled()
    events.emit('run:resume', undefined)
    scene.update(1)
    scene.update(0)
    expect(play.mock.calls.filter(([id]) => id === 'stage_up')).toHaveLength(1)
    scene.destroy(); play.mockRestore()
  })
})
