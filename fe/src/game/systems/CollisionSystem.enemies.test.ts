import { ENEMY_ASSETS } from '@/test/enemyAssets'
import { GAMEPLAY_CONFIG, BULLET_OPTIONS } from '@/test/runConfig'
import { ENEMY_CONFIG } from '@/test/enemyConfig'
import { Container } from 'pixi.js'
import { describe, expect, it, vi } from 'vitest'
import { Bullet } from '@/game/entities/Bullet'
import { Asteroid } from '@/game/entities/Asteroid'
import { PlayerShip } from '@/game/entities/PlayerShip'
import { SpawnSystem } from './SpawnSystem'
import { CollisionSystem } from './CollisionSystem'
import type { ShootingSystem } from './ShootingSystem'

function setup() {
  const player = new PlayerShip({ config: GAMEPLAY_CONFIG.player, maxHp: 5 })
  player.setPosition(200, 700)
  const spawns = new SpawnSystem(GAMEPLAY_CONFIG, { enemyAssets: ENEMY_ASSETS, getPlayerPosition: () => ({ x: 200, y: 700 }), container: new Container(), getViewportSize: () => ({ width: 400, height: 800 }),
    rng: () => 0.5, enemies: ENEMY_CONFIG })
  spawns.setEnemyStage(2, 1)
  spawns.update(16); spawns.update(2000)
  const enemy = spawns.getEnemies().find((item) => item.type === 'sentryTurret')!
  enemy.update(1200, { x: 200, y: 700 })
  const bullets: Bullet[] = []
  const shooting = { getBullets: () => bullets, despawnBullet: (b: Bullet) => b.despawn() } as unknown as ShootingSystem
  const camera = vi.fn()
  const collisions = new CollisionSystem(GAMEPLAY_CONFIG.player.invulnerabilityMs, { player, shooting, spawns, onPlayerDamaged: camera })
  function shoot(damage: number, pierceLeft = 0, falloff?: { startPx: number; endPx: number }) {
    const bullet = new Bullet()
    bullet.spawn({ ...BULLET_OPTIONS, x: enemy.position.x, y: enemy.position.y, directionX: 0, directionY: 0,
      speed: 0, damage, pierceLeft, falloff: falloff ?? null })
    bullets.push(bullet)
    return bullet
  }
  return { player, spawns, enemy, bullets, collisions, shoot, camera }
}

describe('CollisionSystem enemies', () => {
  it('applies normal and charged damage, skips dead enemies and respects piercing hit tracking', () => {
    const s = setup()
    const primary = s.shoot(1)
    s.collisions.update(16)
    expect(s.enemy.hp).toBe(11)
    expect(primary.active).toBe(false)
    const plasma = s.shoot(2, 3)
    s.collisions.update(16)
    s.collisions.update(16)
    expect(s.enemy.hp).toBe(9)
    expect(plasma.pierceLeft).toBe(2)
    const charged = s.shoot(20, 2)
    s.collisions.update(16)
    expect(s.enemy.isDead()).toBe(true)
    const afterDeath = s.shoot(1)
    s.collisions.update(16)
    expect(afterDeath.active).toBe(true)
    expect(charged.pierceLeft).toBe(1)
    s.spawns.destroy()
  })

  it('shares piercing across asteroid/enemy targets and preserves damage falloff', () => {
    const s = setup()
    const asteroid = new Asteroid(GAMEPLAY_CONFIG.asteroids)
    asteroid.spawn({ stageMultiplier: 1, type: 'normal', x: s.enemy.position.x, y: s.enemy.position.y, velocityX: 0, velocityY: 0 })
    vi.spyOn(s.spawns, 'getAsteroids').mockReturnValue([asteroid])
    const plasma = s.shoot(1, 3)
    s.collisions.update(16)
    expect(asteroid.hp).toBe(2)
    expect(s.enemy.hp).toBe(11)
    expect(plasma.pierceLeft).toBe(1)
    s.collisions.update(16)
    expect(s.enemy.hp).toBe(11)
    vi.spyOn(s.spawns, 'getAsteroids').mockReturnValue([])
    const pellet = s.shoot(8, 0, { startPx: 0, endPx: 10 })
    pellet.spawn({ ...BULLET_OPTIONS, x: s.enemy.position.x - 20, y: s.enemy.position.y, directionX: 1, directionY: 0,
      speed: 20, damage: 8, falloff: { startPx: 0, endPx: 10 }, lifetimeMs: 2000 })
    pellet.update(1000)
    s.collisions.update(16)
    expect(s.enemy.hp).toBe(10)
    asteroid.destroy()
    s.spawns.destroy()
  })

  it('shares contact/projectile invulnerability and consumes hits during invulnerability', () => {
    const s = setup()
    s.player.setPosition(s.enemy.position.x, s.enemy.position.y)
    s.collisions.update(16)
    expect(s.player.hp).toBe(4)
    // Actual enemy bullets generated through the normal firing path.
    s.spawns.update(1800)
    const shot = s.spawns.getEnemyBullets()[0]
    shot.view.position.copyFrom(s.player.view.position)
    s.collisions.update(16)
    expect(s.player.hp).toBe(4)
    expect(s.spawns.getEnemyBullets()).toHaveLength(0)
    s.player.setPosition(200, 700)
    s.spawns.update(1800)
    const next = s.spawns.getEnemyBullets()[0]
    next.view.position.copyFrom(s.player.view.position)
    s.collisions.update(450)
    expect(s.player.hp).toBe(3)
    expect(s.camera).toHaveBeenCalledTimes(2)
    expect(s.spawns.getEnemyBullets()).toHaveLength(0)
    s.spawns.destroy()
  })
})
