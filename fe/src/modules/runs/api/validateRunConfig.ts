import type { RunConfig, ScoringConfig, StartRunResponse } from './runsApi'
import type { GameplayConfig } from '@/game/core/gameplayConfig'

const asteroidTypes = ['normal', 'fast', 'big', 'armored'] as const
const weaponIds = ['basic_laser', 'spread_shot', 'shotgun', 'plasma'] as const
function invalid(path: string): never { throw new Error(`Invalid run configuration: ${path}`) }
function object(value: unknown, path: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) invalid(path)
  return value as Record<string, unknown>
}
function number(value: unknown, path: string, min = 0, max = Infinity) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) invalid(path)
  return value
}
function fields(value: unknown, path: string, positive: string, nonnegative = '', probabilities = '') {
  const obj = object(value, path)
  for (const key of positive.split(' ').filter(Boolean)) {
    if (number(obj[key], `${path}.${key}`) <= 0) invalid(`${path}.${key}`)
  }
  for (const key of nonnegative.split(' ').filter(Boolean)) number(obj[key], `${path}.${key}`)
  for (const key of probabilities.split(' ').filter(Boolean)) number(obj[key], `${path}.${key}`, 0, 1)
  return obj
}
function weights(value: unknown, path: string, keys: readonly string[]) {
  const obj = object(value, path)
  if (keys.reduce((sum, key) => sum + number(obj[key], `${path}.${key}`), 0) <= 0) invalid(path)
}

export function validateGameplayConfig(value: unknown): asserts value is GameplayConfig {
  const g = object(value, 'gameplay')
  fields(g.player, 'player', 'maxHp radius hitboxRadius pickupRadius triangleHalfHeight triangleHalfWidth moveSpeedPxPerSec', 'invulnerabilityMs', 'startHeightRatio')
  const w = fields(g.weapons, 'weapons', 'minFireCooldownMs', 'chargedDamageMultiplier chargedDamageBonus')
  fields(w.primary, 'weapons.primary', 'speed lifetimeMs radius')
  fields(w.charged, 'weapons.charged', 'speed lifetimeMs radius cooldownMs', 'muzzleOffset pierce')
  const charge = fields(w.charge, 'charge', '', '', 'activationThreshold')
  fields(charge.gains, 'charge.gains', '', '', asteroidTypes.join(' '))
  const variants = object(w.variants, 'variants')
  const costs = object(w.purchaseCosts, 'purchaseCosts')
  for (const id of weaponIds) {
    if (costs[id] !== null) number(costs[id], `purchaseCosts.${id}`)
    const v = fields(variants[id], `variants.${id}`, 'cooldownMultiplier damageMultiplier pellets jitterMin', 'minCooldownMs muzzleOffset pierce spread jitterRange')
    if (!Number.isInteger(v.pellets) || !Number.isInteger(v.pierce)) invalid(`variants.${id}`)
    if (!Array.isArray(v.directions) || !v.directions.length) invalid(`variants.${id}.directions`)
    if (id === 'spread_shot' && v.directions.length !== 3) invalid(`variants.${id}.directions`)
    for (const direction of v.directions) number(direction, 'direction', -Infinity)
    if (v.falloff !== null) {
      const falloff = fields(v.falloff, 'falloff', 'endPx', 'startPx')
      if ((falloff.endPx as number) <= (falloff.startPx as number)) invalid('falloff')
    }
  }
  const a = fields(g.asteroids, 'asteroids', '', 'contactDamage')
  const types = object(a.types, 'asteroids.types')
  for (const type of asteroidTypes) fields(types[type], `asteroids.${type}`, 'radius hp speed')
  const d = fields(g.difficulty, 'difficulty', 'rampMs compositionStageSpan maxActiveStageMultiplier', 'stageMultiplierStep')
  fields(d.spawnEveryMs, 'difficulty.spawnEveryMs', 'start end')
  fields(d.maxActive, 'difficulty.maxActive', 'start end')
  const composition = object(d.composition, 'composition')
  let startWeight = 0, endWeight = 0
  for (const type of asteroidTypes) {
    const rule = fields(composition[type], `composition.${type}`, 'stageEnd', 'start end')
    startWeight += rule.start as number; endWeight += rule.end as number
  }
  if (startWeight <= 0 || endWeight <= 0) invalid('composition')
  const s = fields(g.spawn, 'spawn', 'minSpawnEveryMs', 'spawnPadding', 'mineLayerLeftChance')
  weights(s.edgeWeights, 'edgeWeights', ['top', 'right', 'bottom', 'left'])
  fields(s.speedMultiplier, 'speedMultiplier', 'min', 'range')
  const target = fields(s.targeting, 'targeting', 'stageSpan', 'playerPadding', 'maxChance baseChance stageChance areaStart areaRange')
  if ((target.areaStart as number) + (target.areaRange as number) > 1) invalid('targeting.areaRange')
  const e = fields(g.extraction, 'extraction', 'spawnEveryMs ttlMs requiredMs radius maxDurationMs', 'firstSpawnMs spawnPadding minDurationMs clockToleranceMs')
  if ((e.minDurationMs as number) > (e.maxDurationMs as number)) invalid('extraction.maxDurationMs')
  const l = fields(g.loot, 'loot', 'lifetimeMs radius coinBonusExclusive', 'scatter resourceAmount')
  if (!Number.isInteger(l.coinBonusExclusive) || !Number.isInteger(l.resourceAmount)) invalid('loot.amounts')
  const drops = object(l.drops, 'loot.drops')
  for (const type of asteroidTypes) {
    const rule = fields(drops[type], `loot.${type}`, '', 'coins', 'ironChance crystalChance goldChance')
    if (!Number.isInteger(rule.coins)) invalid(`loot.${type}.coins`)
  }
  fields(l.rewardCaps, 'loot.rewardCaps', '', 'coins ore crystal')
  const zones = object(g.zones, 'zones')
  for (const type of ['danger', 'heal']) {
    const zone = fields(zones[type], `zones.${type}`, 'radius ttlMs tickMs spawnEveryMs', 'amount firstSpawnMs spawnJitterMs maxActive spawnPadding', 'spawnChance')
    if (!Number.isInteger(zone.maxActive)) invalid(`zones.${type}.maxActive`)
  }
}

function validateScoring(value: unknown): asserts value is ScoringConfig {
  const c = object(value, 'scoring')
  if (c.version !== 7) invalid('unsupported version')
  fields(c.asteroidPoints, 'asteroidPoints', '', asteroidTypes.join(' '))
  number(c.stageBonus, 'stageBonus')
  fields(c.enemyPoints, 'enemyPoints', '', 'sentryTurret shieldDrone mineLayer')
  const enemies = object(c.enemies, 'enemies')
  const turret = fields(enemies.sentryTurret, 'sentryTurret', 'minStage spawnEveryMs hp radius width height enteringMs activeMs leavingMs fireEveryMs',
    'firstSpawnDelayMs maxActive cannonRadius barrelLength barrelWidth edgeMargin activeColor enteringColor leavingColor cannonColor outlineColor outlineWidth contactDamage', 'spawnChance stopHeightRatio')
  fields(turret.hpBar, 'hpBar', 'height', 'offset backgroundColor color')
  fields(turret.bullet, 'enemyBullet', 'speed radius lifetimeMs', 'damage maxActive color pierce')
  fields(enemies.shieldDrone, 'shieldDrone', 'minStage hp radius shieldRadius enteringMs followSpeed leavingMs',
    'maxActive offset color outlineColor outlineWidth shieldWidth contactDamage', 'spawnChance damageReduction shieldAlpha')
  const mineLayer = fields(enemies.mineLayer, 'mineLayer', 'minStage spawnEveryMs hp radius width height enteringMs activeMs leavingMs dropEveryMs',
    'firstSpawnDelayMs maxActive contactDamage mineCount firstDropDelayMs color outlineColor outlineWidth', 'spawnChance minHeightRatio maxHeightRatio entryRatio exitRatio')
  if ((mineLayer.minHeightRatio as number) > (mineLayer.maxHeightRatio as number)) invalid('mineLayer.height')
  fields(mineLayer.mine, 'mine', 'hp radius activationMs fuseMs blastRadius explosionMs blinkEveryMs',
    'damage maxActive color explosionColor outlineWidth', 'dormantAlpha blinkAlpha explosionAlpha')
}

export function validateRunConfig(value: unknown): asserts value is RunConfig {
  validateScoring(value)
  validateGameplayConfig((value as RunConfig).gameplay)
}

export function validateRunStart(value: unknown): asserts value is StartRunResponse {
  const result = object(value, 'start')
  const snapshot = object(result.snapshot, 'snapshot')
  validateScoring(snapshot.scoringConfig)
  if (result.scoringConfigVersion !== (snapshot.scoringConfig as ScoringConfig).version) invalid('snapshot version')
  validateGameplayConfig(snapshot.gameplayConfig)
  if (!weaponIds.includes(snapshot.weaponId as typeof weaponIds[number])) invalid('weaponId')
  fields(snapshot, 'snapshot', 'damage fireRate maxHp')
  fields(snapshot.weaponTuning, 'weaponTuning', 'bulletDamage chargedDamage fireCooldownMs')
}
