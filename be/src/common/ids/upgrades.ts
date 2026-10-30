export const UPGRADE_ID = {
  HP_1: "hp_1",
  DAMAGE_1: "damage_1",
  FIRE_RATE_1: "fire_rate_1",
} as const;

export type UpgradeId = (typeof UPGRADE_ID)[keyof typeof UPGRADE_ID];

export const ALL_UPGRADE_IDS = Object.values(UPGRADE_ID) as UpgradeId[];
