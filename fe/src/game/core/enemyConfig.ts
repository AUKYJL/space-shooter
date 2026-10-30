// Server response types only; no frontend enemy tuning defaults.
export type SentryTurretConfig = Readonly<{
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
  bullet: Readonly<{ speed: number; radius: number; damage: number; lifetimeMs: number; maxActive: number; color: number }>
}>

export type ShieldDroneConfig = Readonly<{
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

export type EnemyConfigs = Readonly<{ sentryTurret: SentryTurretConfig; shieldDrone: ShieldDroneConfig }>
