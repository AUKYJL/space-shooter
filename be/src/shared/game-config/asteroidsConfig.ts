export const ASTEROIDS_CONFIG = Object.freeze({
  types: {
    normal: { radius: 18, hp: 3, speed: 60 },
    big: { radius: 30, hp: 8, speed: 50 },
    fast: { radius: 14, hp: 2, speed: 120 },
    armored: { radius: 22, hp: 10, speed: 70 },
  },
  contactDamage: 1,
});

export type AsteroidsConfig = typeof ASTEROIDS_CONFIG;
