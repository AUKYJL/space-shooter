import fixture from './runConfig.json'
import type { RunConfig } from '@/modules/runs/api/runsApi'

// Captured API payload. Test fixtures are never imported by production runtime.
export const RUN_CONFIG = fixture satisfies RunConfig
export const GAMEPLAY_CONFIG = RUN_CONFIG.gameplay
export const WEAPON_TUNING = { bulletDamage: 1, chargedDamage: 11, fireCooldownMs: 500 }
export const SCENE_TUNING = { maxHp: 10, ...WEAPON_TUNING }
export const BULLET_OPTIONS = {
  damage: 1, radius: 4, lifetimeMs: 650, pierceLeft: 0, falloff: null,
}

export const SPAWN_OPTIONS = {
  getPlayerPosition: () => ({ x: 200, y: 700 }),
  enemies: { ...RUN_CONFIG.enemies,
    sentryTurret: { ...RUN_CONFIG.enemies.sentryTurret, spawnChance: 0 },
    mineLayer: { ...RUN_CONFIG.enemies.mineLayer, spawnChance: 0 },
  },
}
