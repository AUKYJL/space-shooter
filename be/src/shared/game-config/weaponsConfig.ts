import type { WeaponId } from "../ids";

export const WEAPON_CATALOG = [
  {
    id: "basic_laser",
    name: "Basic Laser",
    type: "laser",
    baseDamage: 1,
    baseFireRate: 2,
    projectileSpeed: 900,
    unlockedByDefault: true,
  },
  {
    id: "spread_shot",
    name: "Spread Shot",
    type: "spread",
    baseDamage: 2,
    baseFireRate: 1.6,
    projectileSpeed: 850,
    unlockedByDefault: false,
  },
  {
    id: "shotgun",
    name: "Shotgun",
    type: "shotgun",
    baseDamage: 3,
    baseFireRate: 1.1,
    projectileSpeed: 800,
    unlockedByDefault: false,
  },
  {
    id: "plasma",
    name: "Plasma",
    type: "plasma",
    baseDamage: 4,
    baseFireRate: 1.4,
    projectileSpeed: 780,
    unlockedByDefault: false,
  },
];

export const WEAPONS_CONFIG = Object.freeze({
  purchaseCosts: { basic_laser: null, spread_shot: 2500, shotgun: 4000, plasma: 6000 },
  minFireCooldownMs: 60, chargedDamageMultiplier: 4, chargedDamageBonus: 10,
  primary: { speed: 920, lifetimeMs: 700, radius: 4 },
  charged: { speed: 760, lifetimeMs: 900, radius: 10, cooldownMs: 900, muzzleOffset: 10, pierce: 0 },
  charge: { activationThreshold: 0.02, gains: { normal: 0.1, fast: 0.08, big: 0.16, armored: 0.22 } },
  variants: {
    basic_laser: { cooldownMultiplier: 1, minCooldownMs: 0, damageMultiplier: 1, muzzleOffset: 6,
      pierce: 0, directions: [0], pellets: 1, spread: 0, jitterMin: 1, jitterRange: 0, falloff: null },
    spread_shot: { cooldownMultiplier: 1, minCooldownMs: 0, damageMultiplier: 0.5, muzzleOffset: 6,
      pierce: 0, directions: [-0.22, 0, 0.22], pellets: 1, spread: 0, jitterMin: 1, jitterRange: 0, falloff: null },
    shotgun: { cooldownMultiplier: 1.65, minCooldownMs: 90, damageMultiplier: 1, muzzleOffset: 6,
      pierce: 0, directions: [0], pellets: 7, spread: 0.46, jitterMin: 0.85, jitterRange: 0.3,
      falloff: { startPx: 90, endPx: 460 } },
    plasma: { cooldownMultiplier: 1.9, minCooldownMs: 120, damageMultiplier: 2, muzzleOffset: 8,
      pierce: 3, directions: [0], pellets: 1, spread: 0, jitterMin: 1, jitterRange: 0, falloff: null },
  },
});

export type WeaponsConfig = typeof WEAPONS_CONFIG;
export type WeaponTuning = { bulletDamage: number; chargedDamage: number; fireCooldownMs: number };

export function resolveWeaponTuning(damage: number, fireRate: number, config: WeaponsConfig = WEAPONS_CONFIG): WeaponTuning {
  if (!Number.isFinite(damage) || damage <= 0 || !Number.isFinite(fireRate) || fireRate <= 0) {
    throw new Error("Invalid weapon catalog stats");
  }
  const bulletDamage = Math.max(1, Math.round(damage));
  return {
    bulletDamage,
    chargedDamage: Math.max(bulletDamage * config.chargedDamageMultiplier, bulletDamage + config.chargedDamageBonus),
    fireCooldownMs: Math.max(config.minFireCooldownMs, Math.round(1000 / fireRate)),
  };
}

export function getCatalogWeapon(id: WeaponId) {
  const weapon = WEAPON_CATALOG.find((item) => item.id === id);
  if (!weapon) throw new Error(`Unknown catalog weapon: ${id}`);
  return weapon;
}
