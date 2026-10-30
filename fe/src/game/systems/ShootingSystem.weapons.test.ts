import { describe, expect, it } from 'vitest'

import { WEAPON_CATALOG } from '@/shared/lib/weapons'
import { damageAtDistance, getWeaponPrimaryBulletSpec } from '@/game/systems/ShootingSystem'

describe('weapon catalog', () => {
  it('includes plasma and shotgun', () => {
    const ids = new Set(WEAPON_CATALOG.map((w) => w.id))
    expect(ids.has('shotgun')).toBe(true)
    expect(ids.has('plasma')).toBe(true)
  })
})

describe('shotgun falloff', () => {
  it('decreases damage with distance and bottoms at 1', () => {
    expect(damageAtDistance(6, 0)).toBe(6)
    expect(damageAtDistance(6, 180)).toBeLessThan(6)
    expect(damageAtDistance(6, 1000)).toBe(1)
  })
})

describe('plasma piercing', () => {
  it('enables piercing for plasma', () => {
    expect(getWeaponPrimaryBulletSpec('plasma').pierceLeft).toBeGreaterThan(0)
  })
})
