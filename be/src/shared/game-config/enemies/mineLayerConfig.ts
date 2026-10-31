export type MineConfig = Readonly<{
  hp: number
  radius: number
  activationMs: number
  fuseMs: number
  damage: number
  blastRadius: number
  explosionMs: number
  blinkEveryMs: number
  maxActive: number
  color: number
  dormantAlpha: number
  blinkAlpha: number
  explosionColor: number
  explosionAlpha: number
  outlineWidth: number
}>

export type MineLayerConfig = Readonly<{
  minStage: number
  spawnChance: number
  firstSpawnDelayMs: number
  spawnEveryMs: number
  maxActive: number
  hp: number
  radius: number
  contactDamage: number
  width: number
  height: number
  minHeightRatio: number
  maxHeightRatio: number
  entryRatio: number
  exitRatio: number
  enteringMs: number
  activeMs: number
  leavingMs: number
  mineCount: number
  firstDropDelayMs: number
  dropEveryMs: number
  color: number
  outlineColor: number
  outlineWidth: number
  mine: MineConfig
}>

export const MINE_LAYER_CONFIG: MineLayerConfig = Object.freeze({
  minStage: 3,
  spawnChance: 1,
  firstSpawnDelayMs: 2000,
  spawnEveryMs: 18000,
  maxActive: 1,
  hp: 8,
  radius: 20,
  contactDamage: 1,
  width: 40,
  height: 28,
  // Fractions of field height, measured from the top (0 = top, 1 = bottom).
  minHeightRatio: 0.2,
  maxHeightRatio: 0.8,
  entryRatio: 0.15,
  exitRatio: 0.85,
  enteringMs: 1000,
  activeMs: 4000,
  leavingMs: 1000,
  mineCount: 4,
  firstDropDelayMs: 500,
  dropEveryMs: 1000,
  color: 0xffaa44,
  outlineColor: 0xeeeeff,
  outlineWidth: 2,
  mine: Object.freeze({ hp: 1, radius: 10, activationMs: 1200, fuseMs: 5000,
    damage: 1, blastRadius: 64, explosionMs: 300, blinkEveryMs: 200, maxActive: 16,
    color: 0xff3333, dormantAlpha: 0.4, blinkAlpha: 0.3,
    explosionColor: 0xff6655, explosionAlpha: 0.7, outlineWidth: 2 }),
})
