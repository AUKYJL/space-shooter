import type { AsteroidType } from '@/game/entities/Asteroid'
import type { WeaponId } from '@/shared/lib/weapons'

// API contracts only. Gameplay values are supplied by the backend's run snapshot.
export type PlayerConfig = {
  maxHp: number; radius: number; hitboxRadius: number; pickupRadius: number
  triangleHalfHeight: number; triangleHalfWidth: number; moveSpeedPxPerSec: number
  invulnerabilityMs: number; startHeightRatio: number
}
export type AsteroidConfig = { radius: number; hp: number; speed: number }
export type AsteroidsConfig = { types: Record<AsteroidType, AsteroidConfig>; contactDamage: number }
export type WeaponVariant = {
  cooldownMultiplier: number; minCooldownMs: number; damageMultiplier: number; muzzleOffset: number
  pierce: number; directions: number[]; pellets: number; spread: number; jitterMin: number; jitterRange: number
  falloff: { startPx: number; endPx: number } | null
}
export type WeaponsConfig = {
  purchaseCosts: Record<WeaponId, number | null>
  minFireCooldownMs: number; chargedDamageMultiplier: number; chargedDamageBonus: number
  primary: { speed: number; lifetimeMs: number; radius: number }
  charged: { speed: number; lifetimeMs: number; radius: number; cooldownMs: number; muzzleOffset: number; pierce: number }
  charge: { activationThreshold: number; gains: Record<AsteroidType, number> }
  variants: Record<WeaponId, WeaponVariant>
}
export type WeaponTuning = { bulletDamage: number; chargedDamage: number; fireCooldownMs: number }
export type DifficultyConfig = {
  rampMs: number; stageMultiplierStep: number; compositionStageSpan: number
  spawnEveryMs: { start: number; end: number }; maxActive: { start: number; end: number }
  maxActiveStageMultiplier: number
  composition: Record<AsteroidType, { start: number; end: number; stageEnd: number }>
}
export type SpawnConfig = {
  minSpawnEveryMs: number
  edgeWeights: { top: number; right: number; bottom: number; left: number }
  speedMultiplier: { min: number; range: number }; spawnPadding: number
  targeting: { stageSpan: number; maxChance: number; baseChance: number; stageChance: number
    playerPadding: number; areaStart: number; areaRange: number }
  mineLayerLeftChance: number
}
export type ExtractionConfig = {
  firstSpawnMs: number; spawnEveryMs: number; ttlMs: number; requiredMs: number; radius: number; spawnPadding: number
  minDurationMs: number; maxDurationMs: number; clockToleranceMs: number
}
export type LootConfig = {
  lifetimeMs: number; radius: number; scatter: number; coinBonusExclusive: number; resourceAmount: number
  drops: Record<AsteroidType, { coins: number; ironChance: number; crystalChance: number; goldChance: number }>
  rewardCaps: { coins: number; ore: number; crystal: number }
}
export type ZoneConfig = {
  radius: number; ttlMs: number; tickMs: number; amount: number; firstSpawnMs: number
  spawnEveryMs: number; spawnJitterMs: number; maxActive: number; spawnChance: number; spawnPadding: number
}
export type ZonesConfig = { danger: ZoneConfig; heal: ZoneConfig }
export type GameplayConfig = {
  player: PlayerConfig; weapons: WeaponsConfig; asteroids: AsteroidsConfig; difficulty: DifficultyConfig
  spawn: SpawnConfig; extraction: ExtractionConfig; loot: LootConfig; zones: ZonesConfig
}
