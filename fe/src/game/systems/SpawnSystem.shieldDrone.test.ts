import { Container } from 'pixi.js'
import { describe, expect, it, vi } from 'vitest'
import { SpawnSystem } from './SpawnSystem'
import { SHIELD_DRONE_CONFIG as cfg, ENEMY_CONFIG } from '@/test/enemyConfig'
import { SENTRY_TURRET_CONFIG as turretCfg } from '@/test/enemyConfig'

const turretRule = turretCfg
const droneRule = cfg
function setup(stage = 3, roll = 0.25, maxTurrets = 1) {
  const container = new Container()
  const destroyed = vi.fn()
  const system = new SpawnSystem({ container, getViewportSize: () => ({ width: 400, height: 800 }),
    rng: () => roll, enemies: { ...ENEMY_CONFIG, sentryTurret: { ...turretRule, maxActive: maxTurrets } },
    onEnemyDestroyed: destroyed })
  system.setTuning({ spawnEveryMs: 1000000 })
  system.setEnemyStage(stage, 1.3)
  system.update(0)
  system.update(turretRule.firstSpawnDelayMs)
  const turret = system.getEnemies().find((enemy) => enemy.type === 'sentryTurret')!
  const drone = system.getEnemies().find((enemy) => enemy.type === 'shieldDrone')
  return { system, container, destroyed, turret, drone }
}

describe('SpawnSystem shield drones', () => {
  it('pins server mechanics, bullets and Graphics for the entire configured system', () => {
    const enemies = {
      sentryTurret: { ...turretRule, minStage: 1, firstSpawnDelayMs: 0, hp: 5, radius: 20,
        enteringMs: 100, fireEveryMs: 10, width: 100, outlineWidth: 0,
        bullet: { ...turretRule.bullet, damage: 3, speed: 77, radius: 2 } },
      shieldDrone: { ...droneRule, minStage: 1, spawnChance: 1, hp: 3, radius: 9, offset: 40,
        enteringMs: 100, damageReduction: 0.5, shieldRadius: 50, shieldWidth: 0, outlineWidth: 0 },
    }
    const container = new Container()
    const system = new SpawnSystem({ container, getViewportSize: () => ({ width: 400, height: 800 }),
      rng: () => 0.5, enemies })
    // Changes to the caller's config never retune a running system or its pool.
    enemies.sentryTurret.hp = 999
    enemies.shieldDrone.damageReduction = 0.99
    system.setEnemyStage(1, 1)
    system.update(0)
    system.update(0)
    const turret = system.getEnemies().find((enemy) => enemy.type === 'sentryTurret')!
    const drone = system.getEnemies().find((enemy) => enemy.type === 'shieldDrone')!
    expect(turret.hp).toBe(5)
    expect(turret.radius).toBe(20)
    expect(drone.hp).toBe(3)
    expect(drone.radius).toBe(9)
    const turretView = container.children.find((child) => child.x === turret.position.x && child.y === turret.position.y)!
    const droneView = container.children.find((child) => child.x === drone.position.x && child.y === drone.position.y)!
    system.update(100)
    expect(turret.state).toBe('active')
    expect(drone.position.x - turret.position.x).toBe(40)
    expect(turretView.children[0].width).toBe(100)
    expect(turretView.children[1].width).toBe(100)
    expect(droneView.width).toBe(18)
    turret.takeDamage(1)
    expect(turret.hp).toBe(4.5)
    system.update(10)
    const bullet = system.getEnemyBullets()[0]
    expect(bullet.damage).toBe(3)
    expect(bullet.radius).toBe(2)
    const y = bullet.view.y
    system.update(100)
    expect(bullet.view.y - y).toBeCloseTo(7.7)
    system.destroy()
  })

  it.each([1, 2, 4])('uses the server turret first stage %s exactly', (firstStage) => {
    const system = new SpawnSystem({ container: new Container(), getViewportSize: () => ({ width: 400, height: 800 }),
      rng: () => 0.25, enemies: { ...ENEMY_CONFIG, sentryTurret: { ...turretRule, minStage: firstStage } } })
    system.setEnemyStage(firstStage - 1, 1)
    system.update(10000)
    expect(system.getEnemies()).toHaveLength(0)
    system.setEnemyStage(firstStage, 1)
    system.update(0)
    system.update(turretRule.firstSpawnDelayMs - 1)
    expect(system.getEnemies()).toHaveLength(0)
    system.update(1)
    expect(system.getEnemies().filter((enemy) => enemy.type === 'sentryTurret')).toHaveLength(1)
    system.destroy()
  })

  it.each([2, 3, 4])('uses the server drone first stage %s exactly', (firstStage) => {
    const system = new SpawnSystem({ container: new Container(), getViewportSize: () => ({ width: 400, height: 800 }),
      rng: () => 0.25, enemies: { sentryTurret: { ...turretRule, minStage: 1 }, shieldDrone: { ...droneRule, minStage: firstStage } } })
    system.setEnemyStage(firstStage - 1, 1)
    system.update(0)
    system.update(turretRule.firstSpawnDelayMs)
    expect(system.getEnemies().map((enemy) => enemy.type)).toEqual(['sentryTurret'])
    system.getEnemies()[0].takeDamage(1000)
    system.resolveDestroyedEnemies()
    system.setEnemyStage(firstStage, 1)
    system.update(turretRule.spawnEveryMs)
    expect(system.getEnemies().map((enemy) => enemy.type)).toEqual(['sentryTurret', 'shieldDrone'])
    system.destroy()
  })

  it('uses the configured turret chance and waits a full interval after a failed roll', () => {
    const rng = vi.fn(() => 0.25)
    // Keep constructor injection while changing subsequent rolls.
    const retry = new SpawnSystem({ container: new Container(), getViewportSize: () => ({ width: 400, height: 800 }),
      rng, enemies: { ...ENEMY_CONFIG, sentryTurret: { ...turretRule, spawnChance: 0.75 } } })
    retry.setEnemyStage(3, 1)
    retry.update(0)
    rng.mockReturnValue(0.75)
    retry.update(turretRule.firstSpawnDelayMs)
    expect(retry.getEnemies()).toHaveLength(0)
    rng.mockReturnValue(0.25)
    retry.update(turretRule.spawnEveryMs - 1)
    expect(retry.getEnemies()).toHaveLength(0)
    retry.update(1)
    expect(retry.getEnemies().map((enemy) => enemy.type)).toEqual(['sentryTurret', 'shieldDrone'])
    retry.destroy()
  })

  it.each([[1, 0.25, 0], [2, 0.25, 0], [3, 0.49, 1], [3, 0.5, 0], [3, 0.99, 0]])(
    'gates companions by stage %s and random roll %s', (stage, roll, expected) => {
      const { system } = setup(stage, roll)
      expect(system.getEnemies().filter((enemy) => enemy.type === 'shieldDrone')).toHaveLength(expected)
      system.destroy()
    })

  it('never adds a companion to an existing turret when stage 3 opens', () => {
    const { system, turret } = setup(2)
    system.setEnemyStage(3, 1.3)
    system.update(100)
    expect(system.getEnemies()).toEqual([turret])
    system.destroy()
  })

  it('keeps per-type caps independent and does not spawn a second drone', () => {
    const { system } = setup(3, 0.25, 2)
    system.update(turretRule.spawnEveryMs)
    expect(system.getEnemies().filter((enemy) => enemy.type === 'sentryTurret')).toHaveLength(2)
    expect(system.getEnemies().filter((enemy) => enemy.type === 'shieldDrone')).toHaveLength(1)
    system.destroy()
  })

  it('scores a destroyed drone once, removes the shield and reuses both pools cleanly', () => {
    const { system, turret, drone, destroyed } = setup()
    drone!.takeDamage(100)
    system.resolveDestroyedEnemies()
    system.resolveDestroyedEnemies()
    expect(destroyed).toHaveBeenCalledTimes(1)
    expect(destroyed).toHaveBeenCalledWith(drone)
    expect(turret.isShielded).toBe(false)
    turret.takeDamage(1000)
    system.resolveDestroyedEnemies()
    system.update(turretRule.spawnEveryMs)
    expect(system.getEnemies()).toEqual([turret, drone])
    expect(turret.shieldDrone).toBe(drone)
    expect(drone!.turret).toBe(turret)
    expect(drone!.hp).toBe(6)
    expect(destroyed).toHaveBeenCalledTimes(2)
    system.destroy()
  })

  it('detaches before recycling the turret and never attaches the orphan to a reused owner', () => {
    const { system, turret, drone, destroyed } = setup()
    system.update(turretCfg.enteringMs)
    turret.takeDamage(1000)
    system.resolveDestroyedEnemies()
    system.update(turretRule.spawnEveryMs - turretCfg.enteringMs - 1)
    expect(system.getEnemies()).toHaveLength(0)
    expect(destroyed).toHaveBeenCalledTimes(1)
    system.update(1)
    expect(system.getEnemies()[0]).toBe(turret)
    expect(drone!.state).toBe('entering')
    // This is a new, explicit spawn/association, not a reference surviving pooling.
    expect(turret.shieldDrone).toBe(drone)
    system.destroy()
  })

  it('scores both when destroyed in the same frame, including a departing drone', () => {
    const { system, turret, drone, destroyed } = setup()
    turret.takeDamage(1000)
    drone!.takeDamage(100)
    system.resolveDestroyedEnemies()
    system.resolveDestroyedEnemies()
    expect(system.getEnemies()).toHaveLength(0)
    expect(destroyed).toHaveBeenCalledTimes(2)
    expect(drone!.turret).toBeNull()
    expect(turret.shieldDrone).toBeNull()
    system.destroy()
  })

  it('clears active and pooled Graphics and references without score', () => {
    const { system, container, turret, drone, destroyed } = setup()
    // Keep a pooled drone and a live turret to exercise both cleanup paths.
    const droneView = container.children.at(-1)!
    drone!.takeDamage(100)
    system.resolveDestroyedEnemies()
    destroyed.mockClear()
    const turretView = container.children.at(-1)!
    system.clearEnemies()
    expect(droneView.destroyed).toBe(true)
    expect(turretView.destroyed).toBe(true)
    expect(system.getEnemies()).toHaveLength(0)
    expect(turret.shieldDrone).toBeNull()
    expect(drone!.turret).toBeNull()
    expect(destroyed).not.toHaveBeenCalled()
    system.destroy()
    const active = setup()
    active.system.destroy()
    expect(active.turret.shieldDrone).toBeNull()
    expect(active.drone!.turret).toBeNull()
    expect(active.destroyed).not.toHaveBeenCalled()
  })

  it('natural turret and drone departures grant no score', () => {
    const { system, drone, destroyed } = setup()
    system.update(turretCfg.enteringMs)
    system.update(turretCfg.activeMs)
    system.update(Math.max(cfg.leavingMs, turretCfg.leavingMs))
    expect(drone!.isDead()).toBe(false)
    expect(destroyed).not.toHaveBeenCalled()
    system.destroy()
  })
})
