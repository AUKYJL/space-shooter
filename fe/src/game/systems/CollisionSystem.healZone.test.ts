import { GAMEPLAY_CONFIG } from '@/test/runConfig'
import { describe, expect, it } from 'vitest'

import { HealZone } from '@/game/entities/HealZone'
import { PlayerShip } from '@/game/entities/PlayerShip'
import { CollisionSystem } from '@/game/systems/CollisionSystem'
import type { ShootingSystem } from '@/game/systems/ShootingSystem'
import type { SpawnSystem } from '@/game/systems/SpawnSystem'

describe('CollisionSystem heal zone', () => {
  it('heals 1 hp per second while inside (no overheal)', () => {
    const player = new PlayerShip({ config: GAMEPLAY_CONFIG.player, maxHp: 5 })
    player.hp = 3
    player.setPosition(100, 100)

    const zone = new HealZone(GAMEPLAY_CONFIG.zones.heal)
    zone.spawn({ x: 100, y: 100, ttlMs: 5_000, radius: 60 })

    const shooting = {
      getBullets: () => [],
      despawnBullet: () => {},
    } as unknown as ShootingSystem

    const spawns = {
      getAsteroids: () => [],
      getDangerZones: () => [],
      getHealZones: () => [zone],
    } as unknown as SpawnSystem

    const collisions = new CollisionSystem(GAMEPLAY_CONFIG.player.invulnerabilityMs, { player, shooting, spawns })

    collisions.update(999)
    expect(player.hp).toBe(3)

    collisions.update(1)
    expect(player.hp).toBe(4)

    collisions.update(2000)
    expect(player.hp).toBe(5)

    collisions.update(2000)
    expect(player.hp).toBe(5)
  })
})
