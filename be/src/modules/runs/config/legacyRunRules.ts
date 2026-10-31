// Historical v1-v6 snapshots did not pin gameplay settings. Keep their rules stable.
export const LEGACY_RUN_RULES = {
  difficulty: { stageMultiplierStep: 0.15 }, spawn: { minSpawnEveryMs: 60 },
  extraction: { firstSpawnMs: 12000, ttlMs: 10000, spawnEveryMs: 22000,
    minDurationMs: 1000, maxDurationMs: 10800000, clockToleranceMs: 2000 },
  loot: { coinBonusExclusive: 3, resourceAmount: 1,
    drops: { normal: { coins: 3 }, fast: { coins: 2 }, big: { coins: 4 }, armored: { coins: 5 } },
    rewardCaps: { coins: 10000, ore: 1000, crystal: 1000 } },
} as const;
