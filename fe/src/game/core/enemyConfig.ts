// Server response types only; no frontend enemy tuning defaults.
export type SentryTurretConfig = Readonly<{
  contactDamage: number
  minStage: number
  spawnChance: number
  firstSpawnDelayMs: number
  spawnEveryMs: number
  maxActive: number
  hp: number
  radius: number
  width: number
  height: number
  cannonRadius: number
  barrelLength: number
  barrelWidth: number
  edgeMargin: number
  stopHeightRatio: number
  enteringMs: number
  activeMs: number
  leavingMs: number
  fireEveryMs: number
  activeColor: number
  enteringColor: number
  leavingColor: number
  cannonColor: number
  outlineColor: number
  outlineWidth: number
  hpBar: Readonly<{ offset: number; height: number; backgroundColor: number; color: number }>
  bullet: Readonly<{ pierce: number; speed: number; radius: number; damage: number; lifetimeMs: number; maxActive: number; color: number }>
}>

export type ShieldDroneConfig = Readonly<{
  contactDamage: number
  minStage: number
  spawnChance: number
  maxActive: number
  hp: number
  radius: number
  offset: number
  shieldRadius: number
  damageReduction: number
  enteringMs: number
  followSpeed: number
  leavingMs: number
  color: number
  outlineColor: number
  outlineWidth: number
  shieldAlpha: number
  shieldWidth: number
}>

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
  minHeightRatio: number
  maxHeightRatio: number
}>


export type EnemyConfigs = Readonly<{ sentryTurret: SentryTurretConfig; shieldDrone: ShieldDroneConfig; mineLayer: MineLayerConfig }>
