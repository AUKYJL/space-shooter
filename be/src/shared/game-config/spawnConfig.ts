export const SPAWN_CONFIG = Object.freeze({
  minSpawnEveryMs: 60,
  edgeWeights: { top: 0.46, right: 0.22, bottom: 0.12, left: 0.2 },
  speedMultiplier: { min: 0.85, range: 0.3 }, spawnPadding: 12,
  targeting: { stageSpan: 1, maxChance: 0.22, baseChance: 0.08, stageChance: 0.12,
    playerPadding: 24, areaStart: 0.2, areaRange: 0.6 },
  mineLayerLeftChance: 0.5,
});

export type SpawnConfig = typeof SPAWN_CONFIG;
