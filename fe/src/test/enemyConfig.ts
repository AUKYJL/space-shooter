// Explicit server-response fixtures for tests; never imported by production code.
import type { SentryTurretConfig, ShieldDroneConfig } from '@/game/core/enemyConfig'

export const SENTRY_TURRET_CONFIG: SentryTurretConfig = {
  minStage: 2,
  spawnChance: 1,
  firstSpawnDelayMs: 2000,
  spawnEveryMs: 15000,
  maxActive: 1,
  hp: 12,
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
}

export const SHIELD_DRONE_CONFIG: ShieldDroneConfig = {
  minStage: 3,
  spawnChance: 0.5,
  maxActive: 1,
  hp: 4,
  radius: 14,
  offset: 72,
  shieldRadius: 120,
  damageReduction: 0.75,
  enteringMs: 1200,
  followSpeed: 180,
  leavingMs: 900,
  color: 0x66ccff,
  outlineColor: 0xddeeff,
  outlineWidth: 2,
  shieldAlpha: 0.25,
  shieldWidth: 3,
}

export const ENEMY_CONFIG = { sentryTurret: SENTRY_TURRET_CONFIG, shieldDrone: SHIELD_DRONE_CONFIG }
