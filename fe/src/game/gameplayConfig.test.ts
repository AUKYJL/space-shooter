import { Container } from 'pixi.js'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { GAMEPLAY_CONFIG, WEAPON_TUNING } from '@/test/runConfig'
import { PlayerShip } from './entities/PlayerShip'
import { Asteroid } from './entities/Asteroid'
import { DifficultySystem } from './systems/DifficultySystem'
import { ShootingSystem } from './systems/ShootingSystem'
import { ExtractionSystem } from './systems/ExtractionSystem'
import { rollDrops } from './systems/LootSystem'
import type { InputSystem } from './systems/InputSystem'
import type { WeaponId } from '@/shared/lib/weapons'

afterEach(() => vi.restoreAllMocks())

describe('snapshot-driven runtime balance', () => {
  it('preserves difficulty endpoints, stage multipliers and asteroid stats', () => {
    const difficulty = new DifficultySystem(GAMEPLAY_CONFIG.difficulty)
    expect(difficulty.getSpawnTuning()).toEqual({ spawnEveryMs: 420, maxActive: 26, stageMultiplier: 1,
      typeWeights: { normal: 0.7, fast: 0.16, big: 0.1, armored: 0.04 } })
    difficulty.update(240000); difficulty.advanceStage()
    expect(difficulty.getSpawnTuning().spawnEveryMs).toBeCloseTo(200)
    expect(difficulty.getSpawnTuning().maxActive).toBeCloseTo(50.6)
    expect(difficulty.getStageMultiplier()).toBe(1.15)
    const config = structuredClone(GAMEPLAY_CONFIG.asteroids)
    config.types.normal.hp = 19
    const asteroid = new Asteroid(config)
    asteroid.spawn({ type: 'normal', x: 0, y: 0, velocityX: 60, velocityY: 0, stageMultiplier: 1.15 })
    expect(asteroid.hp).toBe(22)
    expect(asteroid.radius).toBe(18)
    asteroid.update(1000)
    expect(asteroid.position.x).toBe(60)
    asteroid.destroy()
  })

  it.each(['basic_laser', 'spread_shot', 'shotgun', 'plasma'] as const)('retains %s shot characteristics', (weaponId: WeaponId) => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5)
    const player = new PlayerShip({ config: GAMEPLAY_CONFIG.player, maxHp: 1000 })
    player.setPosition(200, 700)
    const shooting = new ShootingSystem(GAMEPLAY_CONFIG.weapons, { player, weaponId,
      input: { getFireState: () => ({ isFiring: true }) } as InputSystem,
      getViewportSize: () => ({ width: 400, height: 800 }), bulletsContainer: new Container(),
      cooldownMs: WEAPON_TUNING.fireCooldownMs, bulletDamage: 3, chargedDamage: 13 })
    shooting.update(0)
    const expected = { basic_laser: [1, 3, 0], spread_shot: [3, 2, 0], shotgun: [7, 3, 0], plasma: [1, 6, 3] }[weaponId]
    expect(shooting.getBullets()).toHaveLength(expected[0])
    expect(shooting.getBullets()[0]).toMatchObject({ radius: 4, damage: expected[1], pierceLeft: expected[2] })
    const center = shooting.getBullets()[Math.floor(expected[0] / 2)]
    const y = center.view.position.y
    center.update(100)
    expect(center.view.position.y).toBeCloseTo(y - 92)
    shooting.fireChargedShot()
    const charged = shooting.getBullets().at(-1)!
    expect(charged).toMatchObject({ radius: 10, damage: 13, pierceLeft: 0 })
    const chargedY = charged.view.position.y
    charged.update(100)
    expect(charged.view.position.y).toBeCloseTo(chargedY - 76)
    shooting.destroy(); player.destroy()
  })

  it('preserves extraction cadence and uses the configured hold time', () => {
    const player = new PlayerShip({ config: GAMEPLAY_CONFIG.player, maxHp: 1000 })
    player.setPosition(-1000, -1000)
    const system = new ExtractionSystem(GAMEPLAY_CONFIG.extraction, { player,
      container: new Container(), getViewportSize: () => ({ width: 400, height: 800 }) })
    system.update(11999); expect(system.getExtractionState().available).toBe(false)
    system.update(1); expect(system.getExtractionState()).toMatchObject({ available: true, baseTtlRemainingMs: 10000, requiredMs: 3000 })
    system.update(10000); expect(system.consumeBaseExpired()).toBe(true)
    system.update(21999); expect(system.getExtractionState().available).toBe(false)
    system.update(1); expect(system.getExtractionState().available).toBe(true)
    system.destroy(); player.destroy()
  })

  it('keeps loot amounts and the four probability rolls in their original order', () => {
    const random = vi.spyOn(Math, 'random').mockReturnValueOnce(0.999).mockReturnValueOnce(0.34)
      .mockReturnValueOnce(0.14).mockReturnValueOnce(0.11)
    expect(rollDrops('big', GAMEPLAY_CONFIG.loot)).toEqual([
      { type: 'coins', amount: 6 }, { type: 'iron', amount: 1 }, { type: 'crystal', amount: 1 }, { type: 'gold', amount: 1 },
    ])
    expect(random).toHaveBeenCalledTimes(4)
  })
})
