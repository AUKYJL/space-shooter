import { Container } from 'pixi.js'
import { describe, expect, it, vi } from 'vitest'
import { SpawnSystem } from './SpawnSystem'
import type { SentryTurret } from '@/game/entities/SentryTurret'
import { SENTRY_TURRET_CONFIG as cfg, ENEMY_CONFIG } from '@/test/enemyConfig'
import { Bullet } from '@/game/entities/Bullet'

const rule = { minStage: 2, firstSpawnDelayMs: 2000, spawnEveryMs: 15000, maxActive: 1 }
function setup(spawnRule = rule) {
  const onEnemyDestroyed = vi.fn()
  const system = new SpawnSystem({ container: new Container(), getViewportSize: () => ({ width: 400, height: 800 }),
    getPlayerPosition: () => ({ x: 200, y: 700 }), rng: () => 0.5, enemies: { ...ENEMY_CONFIG, sentryTurret: { ...cfg, ...spawnRule } }, onEnemyDestroyed })
  system.setTuning({ spawnEveryMs: 1000000 })
  return { system, onEnemyDestroyed }
}
function openStage(system: SpawnSystem) {
  system.setEnemyStage(2, 1.15)
  system.update(16)
  system.update(2000)
  return system.getEnemies().find((item) => item.type === 'sentryTurret')!
}

describe('SpawnSystem enemies', () => {
  it('gates by stage and first delay, pools destruction once, and enforces actual spawn spacing', () => {
    const { system, onEnemyDestroyed } = setup()
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
    system.update(14999)
    expect(system.getEnemies()).toHaveLength(0)
    system.update(1)
    expect(system.getEnemies()[0]).toBe(enemy)
    expect(enemy.state).toBe('entering')
    expect(enemy.hp).toBe(14)
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
    const { system, onEnemyDestroyed } = setup()
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
    system.destroy()
  })

  it('caps active bullets, reuses them and clears both active objects and pools', () => {
    const { system } = setup()
    const enemy = openStage(system)
    // Exercise the pool/cap without TTL or viewport culling obscuring the assertion.
    const fire = system as unknown as { fireEnemyBullet: (enemy: SentryTurret, direction: { x: number; y: number }) => void }
    for (let i = 0; i < 20; i++) fire.fireEnemyBullet(enemy, { x: 0, y: 1 })
    expect(system.getEnemyBullets()).toHaveLength(16)
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
