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

it('adds pinned enemy points and leaves old config scoring intact', () => {
  const destroyed = { normal: 1, fast: 1, big: 1, armored: 1 }
  const v2 = { ...config, version: 2, enemyPoints: { sentryTurret: 100 } }
  expect(calculateScore(v2, destroyed, 2, { sentryTurret: 1 })).toBe(310)
  expect(calculateScore({ ...v2, enemyPoints: { sentryTurret: 7 } }, destroyed, 2, { sentryTurret: 2 })).toBe(224)
  expect(calculateScore(config, destroyed, 2)).toBe(210)
})

it('adds pinned drone points only for version 3+, with omitted counters treated as zero', () => {
  const destroyed = { normal: 1, fast: 1, big: 1, armored: 1 }
  const v3 = { ...config, version: 3, enemyPoints: { sentryTurret: 100, shieldDrone: 50 } }
  expect(calculateScore(v3, destroyed, 3, { sentryTurret: 0, shieldDrone: 1 })).toBe(360)
  expect(calculateScore({ ...v3, enemyPoints: { sentryTurret: 100, shieldDrone: 7 } }, destroyed, 3,
    { sentryTurret: 1, shieldDrone: 2 })).toBe(424)
  expect(calculateScore(v3, destroyed, 3, { sentryTurret: 1 })).toBe(410)
  expect(calculateScore({ ...v3, version: 2 }, destroyed, 3, { sentryTurret: 1, shieldDrone: 2 })).toBe(410)
})
