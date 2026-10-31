export const EXTRACTION_CONFIG = Object.freeze({
  firstSpawnMs: 12000, spawnEveryMs: 22000, ttlMs: 10000, requiredMs: 3000,
  radius: 26, spawnPadding: 40,
  minDurationMs: 1000, maxDurationMs: 10800000, clockToleranceMs: 2000,
});

export type ExtractionConfig = typeof EXTRACTION_CONFIG;
