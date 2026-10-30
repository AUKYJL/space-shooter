import { describe, expect, it } from 'vitest'
import { calculateScore } from './scoring'

const config = { version: 1, asteroidPoints: { normal: 10, fast: 20, big: 30, armored: 50 }, stageBonus: 100 }

describe('arcade scoring', () => {
  it.each([
    [{ normal: 0, fast: 0, big: 0, armored: 0 }, 1, 0],
    [{ normal: 1, fast: 0, big: 0, armored: 0 }, 1, 10],
    [{ normal: 0, fast: 1, big: 0, armored: 0 }, 1, 20],
    [{ normal: 0, fast: 0, big: 1, armored: 0 }, 1, 30],
    [{ normal: 0, fast: 0, big: 0, armored: 1 }, 1, 50],
    [{ normal: 2, fast: 3, big: 4, armored: 5 }, 3, 650],
  ])('matches server examples: %j at stage %s', (destroyed, stage, score) => {
    expect(calculateScore(config, destroyed, stage)).toBe(score)
  })
  it('uses fetched config values', () => {
    expect(calculateScore({ ...config, stageBonus: 7 }, { normal: 1, fast: 1, big: 1, armored: 1 }, 2)).toBe(117)
  })
})
