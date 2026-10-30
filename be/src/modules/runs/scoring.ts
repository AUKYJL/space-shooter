import { BadRequestException } from "@nestjs/common";
import type { FinishRunDto } from "./http/dto/finish-run.dto";

export const SCORING_CONFIG = Object.freeze({
  version: 1,
  asteroidPoints: Object.freeze({ normal: 10, fast: 20, big: 30, armored: 50 }),
  stageBonus: 100,
});

export type ScoringConfig = {
  version: number;
  asteroidPoints: { normal: number; fast: number; big: number; armored: number };
  stageBonus: number;
};

export function calculateScore(config: ScoringConfig, destroyed: ScoringConfig["asteroidPoints"], stageReached: number) {
  const score = destroyed.normal * config.asteroidPoints.normal
    + destroyed.fast * config.asteroidPoints.fast
    + destroyed.big * config.asteroidPoints.big
    + destroyed.armored * config.asteroidPoints.armored
    + (stageReached - 1) * config.stageBonus;
  if (!Number.isSafeInteger(score) || score < 0 || score > 2_147_483_647) {
    throw new BadRequestException("score out of range");
  }
  return score;
}

// Conservative bounds for the existing client runtime, not proof of gameplay.
export function getSuspicionReasons(input: FinishRunDto, startedAt: Date, now: Date) {
  const reasons: string[] = [];
  const { durationMs, endedBy, extractionCount, rewardMultiplier, summary } = input;
  const { destroyedByType: d, stageReached, asteroidsDestroyed: total } = summary;
  if (durationMs < 1_000 || durationMs > 10_800_000 || durationMs > now.getTime() - startedAt.getTime() + 2_000) {
    reasons.push("duration");
  }
  if (total !== d.normal + d.fast + d.big + d.armored
    || (summary.largeAsteroidsDestroyed !== undefined && summary.largeAsteroidsDestroyed !== d.big)
    || (summary.armoredAsteroidsDestroyed !== undefined && summary.armoredAsteroidsDestroyed !== d.armored)
    || (summary.rareAsteroidsDestroyed !== undefined && summary.rareAsteroidsDestroyed !== d.fast)) {
    reasons.push("destroyed totals");
  }
  if (total > 1 + Math.floor(durationMs / 60)) reasons.push("spawn bound");
  const maxStage = durationMs < 22_000 ? 1 : 2 + Math.floor((durationMs - 22_000) / 32_000);
  if (stageReached > maxStage) reasons.push("stage timing");
  if (Math.abs(rewardMultiplier - (1 + (stageReached - 1) * 0.15)) > 0.000001) {
    reasons.push("multiplier");
  }
  if (extractionCount !== (endedBy === "extract" ? 1 : 0)
    || (endedBy === "extract" && durationMs < 12_000 + (stageReached - 1) * 32_000)) {
    reasons.push("extraction");
  }
  // Every asteroid drops at most one ore and crystal, and base coins + [0, 2].
  if (summary.coinsCollected > d.normal * 5 + d.fast * 4 + d.big * 6 + d.armored * 7
    || summary.resourcesCollected.ore > total || summary.resourcesCollected.crystal > total) {
    reasons.push("loot bound");
  }
  return reasons;
}
