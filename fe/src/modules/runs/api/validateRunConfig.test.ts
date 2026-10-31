import { describe, expect, it } from 'vitest'
import { RUN_CONFIG, GAMEPLAY_CONFIG, WEAPON_TUNING } from '@/test/runConfig'
import { validateRunConfig, validateRunStart } from './validateRunConfig'

function start() {
  return structuredClone({ runId: 'run', seed: 1, scoringConfigVersion: 7,
    snapshot: { weaponId: 'basic_laser', damage: 1, fireRate: 2, maxHp: 1000,
      scoringConfig: RUN_CONFIG, gameplayConfig: GAMEPLAY_CONFIG, weaponTuning: WEAPON_TUNING } })
}
function paths(value: unknown, prefix: string[] = []): string[][] {
  if (value === null || typeof value !== 'object') return [prefix]
  return Object.entries(value).flatMap(([key, child]) => paths(child, [...prefix, key]))
}
function remove(value: unknown, path: string[]) {
  let current = value as Record<string, unknown>
  for (const key of path.slice(0, -1)) current = current[key] as Record<string, unknown>
  delete current[path.at(-1)!]
}

describe('server gameplay contract', () => {
  it('accepts the captured API and complete start snapshot', () => {
    expect(() => validateRunConfig(RUN_CONFIG)).not.toThrow()
    expect(() => validateRunStart(start())).not.toThrow()
  })
  it('requires every configuration field, including enemy and zero-valued settings', () => {
    for (const path of paths(RUN_CONFIG)) {
      const copy = structuredClone(RUN_CONFIG)
      remove(copy, path)
      expect(() => validateRunConfig(copy), path.join('.')).toThrow('Invalid run configuration')
    }
  })
  it.each([NaN, Infinity, -1])('rejects invalid numeric tuning %s', (value) => {
    const copy = start()
    copy.snapshot.gameplayConfig.player.maxHp = value
    expect(() => validateRunStart(copy)).toThrow('Invalid run configuration')
  })
  it('rejects zero periods, invalid probabilities, falloff and empty weights', () => {
    const cases = [
      (c: ReturnType<typeof start>) => { c.snapshot.gameplayConfig.zones.heal.tickMs = 0 },
      (c: ReturnType<typeof start>) => { c.snapshot.gameplayConfig.loot.drops.big.ironChance = 2 },
      (c: ReturnType<typeof start>) => { c.snapshot.gameplayConfig.weapons.variants.shotgun.falloff.endPx = 1 },
      (c: ReturnType<typeof start>) => { c.snapshot.gameplayConfig.spawn.edgeWeights = { top: 0, right: 0, bottom: 0, left: 0 } },
      (c: ReturnType<typeof start>) => { c.snapshot.gameplayConfig.weapons.variants.shotgun.pellets = 1.5 },
    ]
    for (const mutate of cases) {
      const copy = start(); mutate(copy)
      expect(() => validateRunStart(copy)).toThrow('Invalid run configuration')
    }
  })
  it('rejects unsupported versions, inconsistent snapshots and unknown weapons', () => {
    const legacy = start(); legacy.snapshot.scoringConfig.version = 6
    expect(() => validateRunStart(legacy)).toThrow('unsupported version')
    const mismatch = start(); mismatch.scoringConfigVersion = 8
    expect(() => validateRunStart(mismatch)).toThrow('snapshot version')
    const unknown = start(); unknown.snapshot.weaponId = 'unknown'
    expect(() => validateRunStart(unknown)).toThrow('weaponId')
  })
  it('requires the start gameplay and resolved weapon values without GET substitution', () => {
    for (const path of [['gameplayConfig'], ['weaponTuning'], ['weaponTuning', 'fireCooldownMs']]) {
      const copy = start(); remove(copy.snapshot, path)
      expect(() => validateRunStart(copy)).toThrow('Invalid run configuration')
    }
  })
})
