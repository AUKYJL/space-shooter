import { ENEMY_ASSETS } from '@/test/enemyAssets'
import { GAMEPLAY_CONFIG, BULLET_OPTIONS } from '@/test/runConfig'
import { ENEMY_CONFIG } from '@/test/enemyConfig'
import { Container } from 'pixi.js'
import { describe, expect, it, vi } from 'vitest'
import { SpawnSystem } from './SpawnSystem'
import { CollisionSystem } from './CollisionSystem'
import { Bullet } from '@/game/entities/Bullet'
import { PlayerShip } from '@/game/entities/PlayerShip'
import { SentryTurretView } from '@/game/views/SentryTurretView'
import type { ShootingSystem } from './ShootingSystem'

function setup() {
  const player = new PlayerShip({ config: GAMEPLAY_CONFIG.player, maxHp: 5 })
  player.setPosition(200, 700)
  const spawns = new SpawnSystem(GAMEPLAY_CONFIG, { enemyAssets: ENEMY_ASSETS, getPlayerPosition: () => ({ x: 200, y: 700 }), container: new Container(), getViewportSize: () => ({ width: 400, height: 800 }),
    rng: () => 0.25, enemies: ENEMY_CONFIG })
  vi.spyOn(spawns, 'getAsteroids').mockReturnValue([])
  spawns.setEnemyStage(3, 1)
  spawns.update(0)
  spawns.update(2000)
  spawns.update(1200)
  const turret = spawns.getEnemies().find((enemy) => enemy.type === 'sentryTurret')!
  const drone = spawns.getEnemies().find((enemy) => enemy.type === 'shieldDrone')!
  const bullets: Bullet[] = []
  const shooting = { getBullets: () => bullets, despawnBullet: (bullet: Bullet) => bullet.despawn() } as unknown as ShootingSystem
  const onSfx = vi.fn()
  const collisions = new CollisionSystem(GAMEPLAY_CONFIG.player.invulnerabilityMs, { player, shooting, spawns, onSfx })
  function shoot(target: { position: { x: number; y: number } }, damage: number, pierceLeft = 0) {
    const bullet = new Bullet()
    bullet.spawn({ ...BULLET_OPTIONS, ...target.position, directionX: 0, directionY: 0, speed: 0, damage, pierceLeft })
    bullets.push(bullet)
    return bullet
  }
  function destroy() {
    bullets.forEach((bullet) => bullet.destroy())
    spawns.destroy()
    player.destroy()
  }
  return { player, spawns, turret, drone, collisions, shoot, destroy, onSfx }
}

describe('CollisionSystem shield drones', () => {
  it('reduces normal and charged hits without changing piercing or drone damage', () => {
    const s = setup()
    s.shoot(s.turret, 1)
    s.collisions.update(0)
    expect(s.turret.hp).toBe(11.75)
    const charged = s.shoot(s.turret, 8, 3)
    s.collisions.update(0)
    s.collisions.update(0)
    expect(s.turret.hp).toBe(9.75)
    expect(charged.pierceLeft).toBe(2)
    s.shoot(s.drone, 1)
    s.collisions.update(0)
    expect(s.drone.hp).toBe(3)
    expect(s.onSfx.mock.calls).toEqual([['shield_hit'], ['shield_hit']])
    s.destroy()
  })

  it('removes protection between hits in the same pass and hides the ring after resolution', () => {
    const s = setup()
    const view = new SentryTurretView(s.turret.config, s.drone.config, ENEMY_ASSETS)
    view.sync(s.turret)
    expect(view.shield.visible).toBe(true)
    // CollisionSystem processes bullets in reverse order: kill the drone first.
    s.shoot(s.turret, 4)
    s.shoot(s.drone, 100)
    s.collisions.update(0)
    expect(s.turret.hp).toBe(8)
    expect(s.turret.isShielded).toBe(false)
    expect(s.onSfx.mock.calls).toEqual([['shield_break']])
    s.spawns.resolveDestroyedEnemies()
    view.sync(s.turret)
    expect(view.shield.visible).toBe(false)
    view.destroy()
    s.destroy()
  })

  it('uses existing contact damage and invulnerability for the drone', () => {
    const s = setup()
    s.player.setPosition(s.drone.position.x, s.drone.position.y)
    s.collisions.update(0)
    s.collisions.update(16)
    expect(s.player.hp).toBe(4)
    expect(s.drone.hp).toBe(4)
    s.destroy()
  })
})
