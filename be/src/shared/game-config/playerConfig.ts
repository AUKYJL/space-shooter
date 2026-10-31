export const PLAYER_CONFIG = Object.freeze({
  maxHp: 1000, radius: 18, hitboxRadius: 12, pickupRadius: 30,
  triangleHalfHeight: 20, triangleHalfWidth: 30,
  moveSpeedPxPerSec: 320, invulnerabilityMs: 450, startHeightRatio: 0.7,
});

export type PlayerConfig = typeof PLAYER_CONFIG;
