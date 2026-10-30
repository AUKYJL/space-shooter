import { describe, expect, it } from 'vitest'

import { DangerZone } from '@/game/entities/DangerZone'
import { PlayerShip } from '@/game/entities/PlayerShip'
import { CollisionSystem } from '@/game/systems/CollisionSystem'
import type { ShootingSystem } from '@/game/systems/ShootingSystem'
import type { SpawnSystem } from '@/game/systems/SpawnSystem'

describe('CollisionSystem danger zone', () => {
  it('applies 1 damage per second while inside (dt accumulation)', () => {
    const player = new PlayerShip({ maxHp: 5 })
    player.setPosition(100, 100)

    const zone = new DangerZone()
    zone.spawn({ x: 100, y: 100, ttlMs: 10_000, radius: 60 })

    const shooting = {
      getBullets: () => [],
      despawnBullet: () => {},
    } as unknown as ShootingSystem

    const spawns = {
      getAsteroids: () => [],
      getDangerZones: () => [zone],
      getHealZones: () => [],
    } as unknown as SpawnSystem

    const collisions = new CollisionSystem({ player, shooting, spawns })

    collisions.update(400)
    collisions.update(400)
    expect(player.hp).toBe(5)

    collisions.update(250)
    expect(player.hp).toBe(4)
  })
})
