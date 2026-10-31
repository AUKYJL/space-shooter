export const DIFFICULTY_CONFIG = Object.freeze({
  rampMs: 4 * 60 * 1000, stageMultiplierStep: 0.15, compositionStageSpan: 6,
  spawnEveryMs: { start: 720, end: 430 }, maxActive: { start: 15, end: 35 },
  maxActiveStageMultiplier: 1.35,
  composition: {
    normal: { start: 0.7, end: 0.45, stageEnd: 0.72 },
    fast: { start: 0.16, end: 0.24, stageEnd: 1.05 },
    big: { start: 0.1, end: 0.18, stageEnd: 1.45 },
    armored: { start: 0.04, end: 0.13, stageEnd: 1.8 },
  },
});

export type DifficultyConfig = typeof DIFFICULTY_CONFIG;
