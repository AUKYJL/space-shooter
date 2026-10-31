import { GAMEPLAY_CONFIG, BULLET_OPTIONS } from '@/test/runConfig'
import { describe, expect, it } from 'vitest'

import { Asteroid } from '@/game/entities/Asteroid'

describe('Asteroid stage scaling', () => {
  it('scales hp with multiplier', () => {
    const a = new Asteroid(GAMEPLAY_CONFIG.asteroids)
    a.spawn({ ...BULLET_OPTIONS, type: 'normal', x: 0, y: 0, velocityX: 0, velocityY: 0, stageMultiplier: 2 })
    expect(a.maxHp).toBeGreaterThan(3)
  })
})

