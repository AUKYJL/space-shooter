import type { StationId } from '@/shared/lib/stations'
import type { WeaponId } from '@/shared/lib/weapons'

export type UpgradeId = 'hp' | 'damage' | 'fire_rate'

export type UpgradeDef = {
  id: UpgradeId
  title: string
  description: string
  maxLevel: number
  baseCost: number
  costGrowth: number
}

export const UPGRADE_DEFS: UpgradeDef[] = [
  {
    id: 'hp',
    title: 'Hull Reinforcement',
    description: 'Increase max HP.',
    maxLevel: 10,
    baseCost: 250,
    costGrowth: 1.45,
  },
  {
    id: 'damage',
    title: 'Weapon Damage',
    description: 'Increase bullet damage.',
    maxLevel: 10,
    baseCost: 300,
    costGrowth: 1.5,
  },
  {
    id: 'fire_rate',
    title: 'Fire Rate',
    description: 'Shoot faster (lower cooldown).',
    maxLevel: 10,
    baseCost: 280,
    costGrowth: 1.48,
  },
]

export function getUpgradeCost(def: UpgradeDef, currentLevel: number) {
  const level = Math.max(0, Math.min(def.maxLevel, currentLevel))
  if (level >= def.maxLevel) return null
  return Math.round(def.baseCost * Math.pow(def.costGrowth, level))
}

export function getNextStationSlotCost(currentUnlockedSlotCount: number) {
  const n = Math.max(0, Math.floor(currentUnlockedSlotCount))
  const base = 500
  const growth = 1.75
  return Math.round(base * Math.pow(growth, n))
}

export function getStationPurchaseCost(stationId: StationId) {
  switch (stationId) {
    case 'coin_station':
      return 2500
    case 'ore_station':
      return 3000
    case 'crystal_station':
      return 3500
    default: {
      const exhaustiveCheck: never = stationId
      return exhaustiveCheck
    }
  }
}

export function getWeaponPurchaseCost(weaponId: WeaponId) {
  switch (weaponId) {
    case 'basic_laser':
      return null
    case 'spread_shot':
      return 2500
    case 'shotgun':
      return 4000
    case 'plasma':
      return 6000
    default: {
      const exhaustiveCheck: never = weaponId
      return exhaustiveCheck
    }
  }
}

export type RunTuning = {
  maxHp: number
  fireCooldownMs: number
  bulletDamage: number
  chargedDamage: number
}

export function getRunTuningFromUpgrades(levels: Record<UpgradeId, number>): RunTuning {
  const hpLevel = levels.hp ?? 0
  const damageLevel = levels.damage ?? 0
  const fireRateLevel = levels.fire_rate ?? 0

  const maxHp = 10 + hpLevel * 2
  const bulletDamage = Math.max(1, Math.round(1 + damageLevel * 0.5))
  const chargedDamage = Math.max(bulletDamage * 4, 8 + damageLevel * 2)

  const baseCooldownMs = 200
  const cooldownMultiplier = Math.pow(0.92, fireRateLevel)
  const fireCooldownMs = Math.max(80, Math.round(baseCooldownMs * cooldownMultiplier))

  return { maxHp, fireCooldownMs, bulletDamage, chargedDamage }
}
