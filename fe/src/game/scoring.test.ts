import { RUN_CONFIG } from '@/test/runConfig'
import { describe, expect, it } from 'vitest'
import { calculateScore } from './scoring'

const config = RUN_CONFIG

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

it('uses pinned enemy points and treats omitted counters as zero', () => {
  const destroyed = { normal: 1, fast: 1, big: 1, armored: 1 }
  expect(calculateScore(config, destroyed, 2, { sentryTurret: 1 })).toBe(310)
  expect(calculateScore({ ...config, enemyPoints: { ...config.enemyPoints, sentryTurret: 7 } }, destroyed, 2, { sentryTurret: 2 })).toBe(224)
  expect(calculateScore(config, destroyed, 3, { sentryTurret: 1, shieldDrone: 2, mineLayer: 2 })).toBe(810)
})

it('rejects missing points and unsupported configs instead of substituting zero', () => {
  const destroyed = { normal: 0, fast: 0, big: 0, armored: 0 }
  expect(() => calculateScore({ ...config, version: 6 }, destroyed, 1)).toThrow('Invalid scoring configuration')
  expect(() => calculateScore({ ...config, enemyPoints: undefined }, destroyed, 1)).toThrow('Invalid scoring configuration')
})
