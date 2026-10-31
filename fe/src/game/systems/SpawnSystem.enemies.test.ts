import { DifficultySystem } from '@/game/systems/DifficultySystem'
import { GAMEPLAY_CONFIG } from '@/test/runConfig'
import { Container } from 'pixi.js'
import { describe, expect, it, vi } from 'vitest'
import { SpawnSystem } from './SpawnSystem'
import type { SentryTurret } from '@/game/entities/SentryTurret'
import { SENTRY_TURRET_CONFIG as cfg, ENEMY_CONFIG } from '@/test/enemyConfig'
import { Bullet } from '@/game/entities/Bullet'

const rule = { minStage: 2, firstSpawnDelayMs: 2000, spawnEveryMs: 15000, maxActive: 1 }
function setup(spawnRule = rule) {
  const onEnemyDestroyed = vi.fn()
  const onSfx = vi.fn()
  const system = new SpawnSystem(GAMEPLAY_CONFIG, { container: new Container(), getViewportSize: () => ({ width: 400, height: 800 }),
    getPlayerPosition: () => ({ x: 200, y: 700 }), rng: () => 0.5, enemies: { ...ENEMY_CONFIG, sentryTurret: { ...cfg, ...spawnRule } }, onEnemyDestroyed, onSfx })
  system.setTuning({ ...new DifficultySystem(GAMEPLAY_CONFIG.difficulty).getSpawnTuning(), spawnEveryMs: 1000000 })
  return { system, onEnemyDestroyed, onSfx }
}
function openStage(system: SpawnSystem) {
  system.setEnemyStage(2, 1.15)
  system.update(16)
  system.update(2000)
  return system.getEnemies().find((item) => item.type === 'sentryTurret')!
}

describe('SpawnSystem enemies', () => {
  it('gates by stage and first delay, pools destruction once, and enforces actual spawn spacing', () => {
    const { system, onEnemyDestroyed, onSfx } = setup()
    system.update(50000)
    expect(system.getEnemies()).toHaveLength(0)
    system.setEnemyStage(2, 1.15)
    system.update(16)
    system.update(1999)
    expect(system.getEnemies()).toHaveLength(0)
    system.update(1)
    const enemy = system.getEnemies()[0]
    expect(enemy.hp).toBe(14)
    expect(enemy.position).toEqual({ x: 200, y: -32 })
    enemy.takeDamage(100)
    system.resolveDestroyedEnemies()
    system.resolveDestroyedEnemies()
    expect(onEnemyDestroyed).toHaveBeenCalledTimes(1)
    expect(onSfx.mock.calls.filter(([id]) => id === 'enemy_destroy')).toHaveLength(1)
    system.update(14999)
    expect(system.getEnemies()).toHaveLength(0)
    system.update(1)
    expect(system.getEnemies()[0]).toBe(enemy)
    expect(enemy.state).toBe('entering')
    expect(enemy.hp).toBe(14)
    system.destroy()
  })

  it('plays deploy and lock once each, with fire only on actual shots', () => {
    const { system, onSfx } = setup()
    openStage(system)
    expect(onSfx.mock.calls).toEqual([['turret_deploy']])
    system.update(cfg.enteringMs)
    system.update(0)
    expect(onSfx.mock.calls.filter(([id]) => id === 'turret_lock')).toHaveLength(1)
    system.update(cfg.fireEveryMs)
    expect(onSfx.mock.calls.filter(([id]) => id === 'turret_fire')).toHaveLength(1)
    system.destroy()
  })

  it('keeps the active enemy cap even with a shorter configured interval', () => {
    const { system } = setup({ ...rule, spawnEveryMs: 10 })
    const enemy = openStage(system)
    for (let i = 0; i < 20; i++) system.update(10)
    expect(system.getEnemies()).toEqual([enemy])
    system.destroy()
  })

  it('has no catch-up spawns, departures give no score and bullets outlive the owner', () => {
    const { system, onEnemyDestroyed, onSfx } = setup()
    const enemy = openStage(system)
    system.update(3000)
    const bullet = system.getEnemyBullets()[0]
    expect(bullet).toBeInstanceOf(Bullet)
    const originalX = bullet.view.position.x
    enemy.takeDamage(100)
    system.resolveDestroyedEnemies()
    expect(system.getEnemyBullets()).toContain(bullet)
    system.update(100)
    expect(bullet.view.position.x).toBeCloseTo(originalX)
    expect(bullet.view.position.y).toBeCloseTo(166)
    system.update(100000)
    expect(system.getEnemyBullets()).toHaveLength(0)
    expect(system.getEnemies()).toHaveLength(1)
    system.setEnemyStage(1, 1) // Observe departure without spawning a replacement.
    system.update(cfg.enteringMs + cfg.activeMs + cfg.leavingMs)
    expect(system.getEnemies()).toHaveLength(0)
    expect(onEnemyDestroyed).toHaveBeenCalledTimes(1)
    expect(onSfx.mock.calls.filter(([id]) => id === 'enemy_destroy')).toHaveLength(1)
    system.destroy()
  })

  it('caps active bullets, reuses them and clears both active objects and pools', () => {
    const { system, onSfx } = setup()
    const enemy = openStage(system)
    // Exercise the pool/cap without TTL or viewport culling obscuring the assertion.
    const fire = system as unknown as { fireEnemyBullet: (enemy: SentryTurret, direction: { x: number; y: number }) => void }
    for (let i = 0; i < 20; i++) fire.fireEnemyBullet(enemy, { x: 0, y: 1 })
    expect(system.getEnemyBullets()).toHaveLength(16)
    expect(onSfx.mock.calls.filter(([id]) => id === 'turret_fire')).toHaveLength(16)
    const bullet = system.getEnemyBullets()[0]
    system.despawnEnemyBullet(bullet)
    fire.fireEnemyBullet(enemy, { x: 1, y: 0 })
    expect(system.getEnemyBullets()).toContain(bullet)
    system.clearEnemies()
    expect(system.getEnemies()).toHaveLength(0)
    expect(system.getEnemyBullets()).toHaveLength(0)
    expect(bullet.view.destroyed).toBe(true)
    system.destroy()
  })
})
