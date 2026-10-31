export const WEAPON_ID = {
  BASIC_LASER: "basic_laser",
  SPREAD_SHOT: "spread_shot",
  SHOTGUN: "shotgun",
  PLASMA: "plasma",
} as const;

export type WeaponId = (typeof WEAPON_ID)[keyof typeof WEAPON_ID];

export const ALL_WEAPON_IDS = Object.values(WEAPON_ID) as WeaponId[];
