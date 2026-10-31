export const ZONES_CONFIG = Object.freeze({
  danger: { radius: 54, ttlMs: 10000, tickMs: 1000, amount: 1,
    firstSpawnMs: 4500, spawnEveryMs: 4500, spawnJitterMs: 3500,
    maxActive: 2, spawnChance: 0.35, spawnPadding: 90 },
  heal: { radius: 46, ttlMs: 5000, tickMs: 1000, amount: 1,
    firstSpawnMs: 7200, spawnEveryMs: 7200, spawnJitterMs: 4200,
    maxActive: 1, spawnChance: 0.22, spawnPadding: 90 },
});

export type ZonesConfig = typeof ZONES_CONFIG;
