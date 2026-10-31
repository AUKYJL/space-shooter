import type { GameplayConfig } from "../../shared/game-config/runConfig";
import { BadRequestException } from "@nestjs/common";
import type { FinishRunDto } from "./http/dto/finish-run.dto";

import type { ScoringConfig } from "../../shared/game-config/scoringConfig";

export function calculateScore(config: ScoringConfig, destroyed: ScoringConfig["asteroidPoints"], stageReached: number, enemiesDestroyed: { sentryTurret: number; shieldDrone?: number; mineLayer?: number } = { sentryTurret: 0 }) {
  const score = destroyed.normal * config.asteroidPoints.normal
    + destroyed.fast * config.asteroidPoints.fast
    + destroyed.big * config.asteroidPoints.big
    + destroyed.armored * config.asteroidPoints.armored
    + (stageReached - 1) * config.stageBonus
    + enemiesDestroyed.sentryTurret * config.enemyPoints.sentryTurret
    + (enemiesDestroyed.shieldDrone ?? 0) * config.enemyPoints.shieldDrone
    + (enemiesDestroyed.mineLayer ?? 0) * config.enemyPoints.mineLayer;
  if (!Number.isSafeInteger(score) || score < 0 || score > 2_147_483_647) {
    throw new BadRequestException("score out of range");
  }
  return score;
}

// Conservative bounds for the existing client runtime, not proof of gameplay.
export function getSuspicionReasons(input: FinishRunDto, startedAt: Date, now: Date, config: ScoringConfig, gameplay: GameplayConfig) {
  const reasons: string[] = [];
  const rules = gameplay;
  const extraction = rules.extraction;
  const firstStageMs = extraction.firstSpawnMs + extraction.ttlMs;
  const stageCycleMs = extraction.spawnEveryMs + extraction.ttlMs;
  const earliestStage = (stage: number) => stage <= 1 ? 0 : firstStageMs + (stage - 2) * stageCycleMs;
  const { durationMs, endedBy, extractionCount, rewardMultiplier, summary } = input;
  const { destroyedByType: d, stageReached, asteroidsDestroyed: total } = summary;
  if (durationMs < extraction.minDurationMs || durationMs > extraction.maxDurationMs || durationMs > now.getTime() - startedAt.getTime() + extraction.clockToleranceMs) {
    reasons.push("duration");
  }
  if (total !== d.normal + d.fast + d.big + d.armored
    || (summary.largeAsteroidsDestroyed !== undefined && summary.largeAsteroidsDestroyed !== d.big)
    || (summary.armoredAsteroidsDestroyed !== undefined && summary.armoredAsteroidsDestroyed !== d.armored)
    || (summary.rareAsteroidsDestroyed !== undefined && summary.rareAsteroidsDestroyed !== d.fast)) {
    reasons.push("destroyed totals");
  }
  if (total > 1 + Math.floor(durationMs / rules.spawn.minSpawnEveryMs)) reasons.push("spawn bound");
  const turretKills = summary.enemiesDestroyed?.sentryTurret ?? 0;
  if (turretKills > 0) {
    const rule = config.enemies.sentryTurret;
    const earliestStageMs = earliestStage(rule.minStage);
    const earliestSpawnMs = earliestStageMs + rule.firstSpawnDelayMs;
    const disabled = rule.maxActive < 1 || rule.spawnChance <= 0;
    const maxKills = disabled || durationMs < earliestSpawnMs ? 0 : 1 + Math.floor((durationMs - earliestSpawnMs) / rule.spawnEveryMs);
    if (stageReached < rule.minStage || turretKills > maxKills) reasons.push("enemy spawn bound");
  }
  const droneKills = summary.enemiesDestroyed?.shieldDrone ?? 0;
  if (droneKills > 0) {
    const droneRule = config.enemies.shieldDrone;
    const turretRule = config.enemies.sentryTurret;
    // A turret timer may already be ready when the drone stage opens.
    const earliestSpawnMs = Math.max(earliestStage(droneRule.minStage),
      earliestStage(turretRule.minStage) + turretRule.firstSpawnDelayMs);
    const disabled = droneRule.maxActive < 1 || droneRule.spawnChance <= 0
      || turretRule.maxActive < 1 || turretRule.spawnChance <= 0;
    const maxKills = disabled || durationMs < earliestSpawnMs
      ? 0 : 1 + Math.floor((durationMs - earliestSpawnMs) / turretRule.spawnEveryMs);
    if (stageReached < Math.max(droneRule.minStage, turretRule.minStage) || droneKills > maxKills) reasons.push("drone spawn bound");
  }
  const mineLayerKills = summary.enemiesDestroyed?.mineLayer ?? 0;
  if (mineLayerKills > 0) {
    const rule = config.enemies.mineLayer;
    const earliestStageMs = earliestStage(rule.minStage);
    const earliestSpawnMs = earliestStageMs + rule.firstSpawnDelayMs;
    const maxKills = rule.maxActive < 1 || rule.spawnChance <= 0 || durationMs < earliestSpawnMs
      ? 0 : 1 + Math.floor((durationMs - earliestSpawnMs) / rule.spawnEveryMs);
    if (stageReached < rule.minStage || mineLayerKills > maxKills) reasons.push("mine layer spawn bound");
  }
  const maxStage = durationMs < firstStageMs ? 1 : 2 + Math.floor((durationMs - firstStageMs) / stageCycleMs);
  if (stageReached > maxStage) reasons.push("stage timing");
  if (Math.abs(rewardMultiplier - (1 + (stageReached - 1) * rules.difficulty.stageMultiplierStep)) > 0.000001) {
    reasons.push("multiplier");
  }
  if (extractionCount !== (endedBy === "extract" ? 1 : 0)
    || (endedBy === "extract" && durationMs < extraction.firstSpawnMs + (stageReached - 1) * stageCycleMs)) {
    reasons.push("extraction");
  }
  // Every asteroid drops at most one ore and crystal, and base coins + [0, 2].
  if (summary.coinsCollected > (["normal", "fast", "big", "armored"] as const).reduce((sum, type) => sum + d[type] * (rules.loot.drops[type].coins + rules.loot.coinBonusExclusive - 1), 0)
    || summary.resourcesCollected.ore > total * rules.loot.resourceAmount || summary.resourcesCollected.crystal > total * rules.loot.resourceAmount) {
    reasons.push("loot bound");
  }
  return reasons;
}
