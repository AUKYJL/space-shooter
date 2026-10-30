import { describe, expect, it } from 'vitest'
import { Container } from 'pixi.js'

import { LootSystem } from '@/game/systems/LootSystem'
import { PlayerShip } from '@/game/entities/PlayerShip'

describe('LootSystem lifetime', () => {
  it('despawns loot after lifetime', () => {
    const player = new PlayerShip({ maxHp: 3 })
    const container = new Container()
    const loot = new LootSystem({ player, container })

    ;(loot as unknown as { spawnOne: (args: { type: 'coins'; amount: number; x: number; y: number }) => void }).spawnOne({
      type: 'coins',
      amount: 1,
      x: 100,
      y: 100,
    })
    expect(container.children.length).toBe(1)

    loot.update(8001)
    expect(container.children.length).toBe(0)
  })
})
