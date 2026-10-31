import { GAMEPLAY_CONFIG } from '@/test/runConfig'
import { describe, expect, it, vi } from 'vitest'

import { DangerZone } from '@/game/entities/DangerZone'
import { PlayerShip } from '@/game/entities/PlayerShip'
import { CollisionSystem } from '@/game/systems/CollisionSystem'
import type { ShootingSystem } from '@/game/systems/ShootingSystem'
import type { SpawnSystem } from '@/game/systems/SpawnSystem'

describe('CollisionSystem danger zone', () => {
  it('applies 1 damage per second while inside (dt accumulation)', () => {
    const player = new PlayerShip({ config: GAMEPLAY_CONFIG.player, maxHp: 5 })
    player.setPosition(100, 100)

    const zone = new DangerZone(GAMEPLAY_CONFIG.zones.danger)
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

    const onSfx = vi.fn()
    const collisions = new CollisionSystem(GAMEPLAY_CONFIG.player.invulnerabilityMs, { player, shooting, spawns, onSfx })

    collisions.update(400)
    collisions.update(400)
    expect(player.hp).toBe(5)

    collisions.update(250)
    expect(player.hp).toBe(4)
    expect(onSfx.mock.calls).toEqual([['hazard_damage']])
  })
})
