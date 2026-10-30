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

export const SENTRY_TURRET_CONFIG: SentryTurretConfig = Object.freeze({
  minStage: 2,
  spawnChance: 1,
  firstSpawnDelayMs: 2000,
  spawnEveryMs: 15000,
  maxActive: 1,
  hp: 6,
  radius: 32,
  width: 64,
  height: 32,
  cannonRadius: 10,
  barrelLength: 22,
  barrelWidth: 6,
  edgeMargin: 40,
  stopHeightRatio: 0.18,
  enteringMs: 1200,
  activeMs: 30_000,
  leavingMs: 900,
  fireEveryMs: 1200,
  activeColor: 0xff6655,
  enteringColor: 0xffc857,
  leavingColor: 0x7b8aab,
  cannonColor: 0xddeeff,
  outlineColor: 0xeeeeff,
  outlineWidth: 2,
  hpBar: Object.freeze({ offset: 9, height: 4, backgroundColor: 0x222233, color: 0x66ff99 }),
  bullet: Object.freeze({ speed: 220, radius: 4, damage: 1, lifetimeMs: 4000, maxActive: 16, color: 0xff6655 }),
})
