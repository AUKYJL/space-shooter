import { GAMEPLAY_CONFIG } from '@/test/runConfig'
import { describe, expect, it } from 'vitest'
import { Container } from 'pixi.js'

import { ExtractionSystem } from '@/game/systems/ExtractionSystem'
import { PlayerShip } from '@/game/entities/PlayerShip'

describe('ExtractionSystem zone extraction', () => {
  it('accumulates progress while inside zone and decays when leaving', () => {
    const player = new PlayerShip({ config: GAMEPLAY_CONFIG.player, maxHp: 3 })
    const container = new Container()
    const sys = new ExtractionSystem(GAMEPLAY_CONFIG.extraction, {
      container,
      player,
      getViewportSize: () => ({ width: 400, height: 800 }),
    })

    sys.forceSpawnForTest({ x: 200, y: 400, ttlMs: 10_000 })
    player.setPosition(200, 400)

    sys.update(1000)
    expect(sys.getExtractionState().progressMs).toBeGreaterThan(0)

    player.setPosition(0, 0)
    sys.update(500)
    expect(sys.getExtractionState().progressMs).toBeGreaterThan(0)
    sys.update(5000)
    expect(sys.getExtractionState().progressMs).toBe(0)
  })
})

