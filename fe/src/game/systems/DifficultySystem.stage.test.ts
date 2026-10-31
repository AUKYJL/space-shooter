import { GAMEPLAY_CONFIG } from '@/test/runConfig'
import { describe, expect, it } from 'vitest'

import { DifficultySystem } from '@/game/systems/DifficultySystem'

describe('DifficultySystem stage', () => {
  it('increases multiplier with stage', () => {
    const d = new DifficultySystem(GAMEPLAY_CONFIG.difficulty)
    expect(d.getStage()).toBe(1)
    const m1 = d.getStageMultiplier()
    d.advanceStage()
    const m2 = d.getStageMultiplier()
    expect(m2).toBeGreaterThan(m1)
  })
})

