export const LOOT_CONFIG = Object.freeze({
  lifetimeMs: 8000, radius: 7, scatter: 12,
  coinBonusExclusive: 3, resourceAmount: 1,
  drops: {
    normal: { coins: 3, ironChance: 0.2, crystalChance: 0.08, goldChance: 0.06 },
    fast: { coins: 2, ironChance: 0.2, crystalChance: 0.08, goldChance: 0.06 },
    big: { coins: 4, ironChance: 0.35, crystalChance: 0.15, goldChance: 0.12 },
    armored: { coins: 5, ironChance: 0.5, crystalChance: 0.25, goldChance: 0.18 },
  },
  rewardCaps: { coins: 10000, ore: 1000, crystal: 1000 },
});

export type LootConfig = typeof LOOT_CONFIG;
