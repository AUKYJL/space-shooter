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

export const SHIELD_DRONE_CONFIG: ShieldDroneConfig = Object.freeze({
  minStage: 2,
  spawnChance: 1,
  maxActive: 1,
  hp: 4,
  radius: 14,
  offset: 72,
  shieldRadius: 120,
  damageReduction: 0.2,
  enteringMs: 1200,
  followSpeed: 180,
  leavingMs: 900,
  color: 0x66ccff,
  outlineColor: 0xddeeff,
  outlineWidth: 2,
  shieldAlpha: 0.25,
  shieldWidth: 3,
})
