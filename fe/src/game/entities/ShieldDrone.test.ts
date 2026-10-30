import { describe, expect, it } from 'vitest'
import { ShieldDrone } from './ShieldDrone'
import { SentryTurret } from './SentryTurret'
import { SHIELD_DRONE_CONFIG as cfg } from '@/test/enemyConfig'
import { SENTRY_TURRET_CONFIG as turretCfg } from '@/test/enemyConfig'

const viewport = { width: 400, height: 800 }
const player = { x: 200, y: 700 }
function setup(x = 200, multiplier = 1) {
  const turret = new SentryTurret(turretCfg)
  turret.spawn(x, 144, multiplier)
  const drone = new ShieldDrone(cfg)
  drone.spawn(turret, multiplier, viewport)
  return { turret, drone }
}
function enter(turret: SentryTurret, drone: ShieldDrone) {
  turret.update(turretCfg.enteringMs, player)
  drone.update(cfg.enteringMs)
}

describe('ShieldDrone', () => {
  it('protects during entry, scales HP and takes full damage itself', () => {
    const { turret, drone } = setup(200, 1.3)
    expect(drone.hp).toBe(6)
    expect(turret.isShielded).toBe(true)
    turret.takeDamage(1)
    expect(turret.hp).toBe(15.75)
    drone.takeDamage(1)
    expect(drone.hp).toBe(5)
  })

  it('uses an inclusive distance boundary, preserves fractions and restores protection on return', () => {
    const { turret, drone } = setup()
    enter(turret, drone)
    drone.position.x = turret.position.x + cfg.shieldRadius
    turret.takeDamage(1)
    expect(turret.hp).toBe(11.75)
    drone.position.x += 0.01
    turret.takeDamage(1)
    expect(turret.hp).toBe(10.75)
    drone.position.x -= 0.01
    turret.takeDamage(2)
    expect(turret.hp).toBe(10.25)
    turret.takeDamage(-10)
    expect(turret.hp).toBe(10.25)
  })

  it('enters beside the turret, follows at configured speed and handles viewport edges', () => {
    const { turret, drone } = setup(390)
    enter(turret, drone)
    expect(drone.state).toBe('active')
    expect(drone.position).toEqual({ x: 318, y: 144 })
    turret.position.x -= 40
    drone.update(100)
    expect(drone.position.x).toBe(300)
    drone.update(1000)
    expect(drone.position.x).toBe(278)
    drone.update(0, { width: 20, height: 20 })
    drone.update(10000, { width: 20, height: 20 })
    expect(drone.position).toEqual({ x: 10, y: 10 })
  })

  it('removes protection immediately on death and resets both links on reuse', () => {
    const { turret, drone } = setup()
    drone.takeDamage(100)
    expect(drone.isDead()).toBe(true)
    expect(drone.turret).toBeNull()
    expect(turret.shieldDrone).toBeNull()
    turret.takeDamage(1)
    expect(turret.hp).toBe(11)
    const next = new SentryTurret(turretCfg)
    next.spawn(100, 100, 1)
    drone.spawn(next, 1, viewport)
    expect(drone.hp).toBe(4)
    expect(drone.state).toBe('entering')
    expect(next.shieldDrone).toBe(drone)
    expect(turret.isShielded).toBe(false)
    next.spawn(200, 144, 1)
    expect(drone.state).toBe('leaving')
    expect(drone.turret).toBeNull()
  })

  it.each(['destroyed', 'leaving'] as const)('detaches when its turret is %s and leaves independently', (reason) => {
    const { turret, drone } = setup()
    enter(turret, drone)
    if (reason === 'destroyed') turret.takeDamage(1000)
    else turret.update(turretCfg.activeMs, player)
    expect(drone.state).toBe('leaving')
    expect(turret.shieldDrone).toBeNull()
    expect(drone.turret).toBeNull()
    const y = drone.position.y
    drone.update(cfg.leavingMs / 2)
    expect(drone.position.y).toBeLessThan(y)
    drone.update(cfg.leavingMs / 2)
    expect(drone.state).toBe('inactive')
    expect(drone.isDead()).toBe(false)
  })

  it('allows destruction during departure and ignores damage after death', () => {
    const { turret, drone } = setup()
    enter(turret, drone)
    turret.takeDamage(1000)
    drone.takeDamage(100)
    drone.takeDamage(1)
    drone.update(10000)
    expect(drone.state).toBe('destroyed')
    expect(drone.hp).toBe(0)
  })
})
