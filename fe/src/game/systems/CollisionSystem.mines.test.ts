import { describe, expect, it, vi } from 'vitest'
import { Mine } from '@/game/entities/Mine'
import { MineLayer } from '@/game/entities/MineLayer'
import { Bullet } from '@/game/entities/Bullet'
import { PlayerShip } from '@/game/entities/PlayerShip'
import { MINE_LAYER_CONFIG as cfg } from '@/test/enemyConfig'
import { CollisionSystem } from './CollisionSystem'
import type { SpawnSystem } from './SpawnSystem'
import type { ShootingSystem } from './ShootingSystem'

function setup() {
  const player = new PlayerShip({ maxHp: 5 })
  player.setPosition(200, 500)
  const mines: Mine[] = []
  const ships: MineLayer[] = []
  const bullets: Bullet[] = []
  const hostile: Bullet[] = []
  const spawns = { getMines: () => mines, getEnemies: () => ships, getAsteroids: () => [], getDangerZones: () => [],
    getHealZones: () => [], getEnemyBullets: () => hostile, despawnEnemyBullet: (b: Bullet) => b.despawn() } as unknown as SpawnSystem
  const shooting = { getBullets: () => bullets, despawnBullet: (b: Bullet) => b.despawn() } as unknown as ShootingSystem
  const damaged = vi.fn()
  const collisions = new CollisionSystem({ player, spawns, shooting, onPlayerDamaged: damaged })
  function mine(x = 200, y = 500) {
    const result = new Mine(cfg.mine)
    result.spawn({ x, y })
    mines.push(result)
    return result
  }
  function shoot(damage = 1, pierceLeft = 0, falloff?: { startPx: number; endPx: number }) {
    const b = new Bullet()
    b.spawn({ x: 200, y: 500, directionX: 1, directionY: 0, speed: 0, damage, pierceLeft, falloff })
    bullets.push(b)
    return b
  }
  function cleanup() { player.destroy(); for (const b of [...bullets, ...hostile]) b.destroy() }
  return { player, mines, ships, hostile, mine, shoot, collisions, damaged, cleanup }
}

describe('CollisionSystem mines', () => {
  it('does not hurt on spawn, detonates on armed contact once, and consumes explosions during invulnerability', () => {
    const s = setup()
    const first = s.mine()
    s.collisions.update(16)
    expect(s.player.hp).toBe(5)
    first.update(cfg.mine.activationMs - 1)
    s.collisions.update(16)
    expect(s.player.hp).toBe(5)
    first.update(1)
    s.collisions.update(16)
    expect(first.state).toBe('exploding')
    expect(s.player.hp).toBe(4)
    const second = s.mine()
    second.update(cfg.mine.activationMs)
    s.collisions.update(16)
    expect(second.state).toBe('exploding')
    expect(s.player.hp).toBe(4)
    s.collisions.update(450)
    expect(s.player.hp).toBe(4)
    expect(s.damaged).toHaveBeenCalledOnce()
    const third = s.mine()
    third.update(cfg.mine.activationMs)
    s.collisions.update(0)
    expect(s.player.hp).toBe(3)
    s.cleanup()
  })

  it.each([40, 200])('detonates on exact fuse expiry with a single blast-radius check (distance=%s)', (distance) => {
    const s = setup()
    const mine = s.mine(200 + distance)
    mine.update(cfg.mine.activationMs)
    mine.update(cfg.mine.fuseMs - 1)
    s.collisions.update(16)
    expect(mine.state).toBe('armed')
    mine.update(1)
    s.collisions.update(16)
    expect(mine.state).toBe('exploding')
    expect(s.player.hp).toBe(distance === 40 ? 4 : 5)
    s.player.setPosition(mine.position.x, mine.position.y)
    s.collisions.update(450)
    expect(s.player.hp).toBe(distance === 40 ? 4 : 5)
    s.cleanup()
  })

  it.each(['dormant', 'armed', 'expired'] as const)('lets bullets destroy %s mines before detonation', (state) => {
    const s = setup()
    const mine = s.mine()
    if (state !== 'dormant') mine.update(cfg.mine.activationMs)
    if (state === 'expired') mine.update(cfg.mine.fuseMs)
    const bullet = s.shoot()
    s.collisions.update(16)
    expect(mine.isDead()).toBe(true)
    expect(bullet.active).toBe(false)
    expect(s.player.hp).toBe(5)
    expect(s.damaged).not.toHaveBeenCalled()
    s.cleanup()
  })

  it('reuses piercing, damage falloff and per-target hit tracking for mines', () => {
    const s = setup()
    const first = s.mine()
    const second = s.mine()
    const plasma = s.shoot(1, 3)
    s.collisions.update(16)
    expect(first.isDead()).toBe(true)
    expect(second.isDead()).toBe(true)
    expect(plasma.pierceLeft).toBe(1)
    s.collisions.update(16)
    expect(plasma.pierceLeft).toBe(1)
    plasma.despawn()
    const tough = new Mine({ ...cfg.mine, hp: 10 })
    tough.spawn({ x: 200, y: 500 })
    s.mines.push(tough)
    const pellet = s.shoot(8, 0, { startPx: 0, endPx: 10 })
    pellet.spawn({ x: 180, y: 500, directionX: 1, directionY: 0, speed: 20, damage: 8,
      falloff: { startPx: 0, endPx: 10 }, lifetimeMs: 2000 })
    pellet.update(1000)
    s.collisions.update(16)
    expect(tough.hp).toBe(9)
    s.cleanup()
  })

  it('shares invulnerability with hostile bullets and excludes entering ship contact', () => {
    const s = setup()
    const ship = new MineLayer({ ...cfg, contactDamage: 2 })
    ship.spawn({ width: 400, height: 800 }, true, 1, 0.25)
    s.ships.push(ship)
    s.player.setPosition(ship.position.x, ship.position.y)
    s.collisions.update(16)
    expect(s.player.hp).toBe(5)
    const b = new Bullet()
    b.spawn({ x: ship.position.x, y: ship.position.y, directionX: 0, directionY: 0, speed: 0 })
    s.hostile.push(b)
    s.collisions.update(16)
    expect(s.player.hp).toBe(4)
    const mine = s.mine(ship.position.x, ship.position.y)
    mine.update(cfg.mine.activationMs)
    s.collisions.update(16)
    expect(s.player.hp).toBe(4)
    expect(mine.state).toBe('exploding')
    ship.update(cfg.enteringMs)
    s.player.setPosition(ship.position.x, ship.position.y)
    s.collisions.update(450)
    expect(s.player.hp).toBe(2)
    s.cleanup()
  })
})
