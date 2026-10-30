import { BadRequestException } from "@nestjs/common";
import type { FinishRunDto } from "./http/dto/finish-run.dto";

import { SENTRY_TURRET_CONFIG, type SentryTurretConfig } from "./config/sentryTurretConfig";
import { SHIELD_DRONE_CONFIG, type ShieldDroneConfig } from "./config/shieldDroneConfig";
import { MINE_LAYER_CONFIG, type MineLayerConfig } from "./config/mineLayerConfig";

export const SCORING_CONFIG = Object.freeze({
  version: 6,
  asteroidPoints: Object.freeze({ normal: 10, fast: 20, big: 30, armored: 50 }),
  stageBonus: 100,
  enemyPoints: Object.freeze({ sentryTurret: 100, shieldDrone: 50, mineLayer: 150 }),
  enemies: Object.freeze({ sentryTurret: SENTRY_TURRET_CONFIG, shieldDrone: SHIELD_DRONE_CONFIG, mineLayer: MINE_LAYER_CONFIG }),
});

type EnemyConfigs = Readonly<{ sentryTurret: SentryTurretConfig; shieldDrone: ShieldDroneConfig; mineLayer?: MineLayerConfig }>;

export type ScoringConfig = {
  version: number;
  enemies?: EnemyConfigs;
  asteroidPoints: { normal: number; fast: number; big: number; armored: number };
  stageBonus: number;
  enemyPoints?: { sentryTurret: number; shieldDrone?: number; mineLayer?: number };
  // Historical v2/v3 snapshots only; v4+ spawning and validation use enemies.
  enemySpawnRules?: { sentryTurret: { minStage: number; firstSpawnDelayMs: number; spawnEveryMs: number; maxActive: number }; shieldDrone?: { minStage: number; maxActive: number; spawnChance?: number } };
};

export function calculateScore(config: ScoringConfig, destroyed: ScoringConfig["asteroidPoints"], stageReached: number, enemiesDestroyed: { sentryTurret: number; shieldDrone?: number; mineLayer?: number } = { sentryTurret: 0 }) {
  const score = destroyed.normal * config.asteroidPoints.normal
    + destroyed.fast * config.asteroidPoints.fast
    + destroyed.big * config.asteroidPoints.big
    + destroyed.armored * config.asteroidPoints.armored
    + (stageReached - 1) * config.stageBonus
    + enemiesDestroyed.sentryTurret * (config.enemyPoints?.sentryTurret ?? 0)
    + (config.version >= 3 ? (enemiesDestroyed.shieldDrone ?? 0) * (config.enemyPoints?.shieldDrone ?? 0) : 0)
    + (config.version >= 5 ? (enemiesDestroyed.mineLayer ?? 0) * (config.enemyPoints?.mineLayer ?? 0) : 0);
  if (!Number.isSafeInteger(score) || score < 0 || score > 2_147_483_647) {
    throw new BadRequestException("score out of range");
  }
  return score;
}

// Conservative bounds for the existing client runtime, not proof of gameplay.
export function getSuspicionReasons(input: FinishRunDto, startedAt: Date, now: Date, config: ScoringConfig = SCORING_CONFIG) {
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
  const turretKills = summary.enemiesDestroyed?.sentryTurret ?? 0;
  if (turretKills > 0) {
    const rule = config.version >= 4 ? config.enemies?.sentryTurret : config.enemySpawnRules?.sentryTurret;
    if (!rule || !config.enemyPoints || config.version < 2) {
      reasons.push("enemy config");
    } else {
      const earliestStageMs = rule.minStage <= 1 ? 0 : 22_000 + (rule.minStage - 2) * 32_000;
      const earliestSpawnMs = earliestStageMs + rule.firstSpawnDelayMs;
      const disabled = rule.maxActive < 1 || (config.version >= 4 && config.enemies!.sentryTurret.spawnChance <= 0);
      const maxKills = disabled || durationMs < earliestSpawnMs ? 0 : 1 + Math.floor((durationMs - earliestSpawnMs) / rule.spawnEveryMs);
      if (stageReached < rule.minStage || turretKills > maxKills) reasons.push("enemy spawn bound");
    }
  }
  const droneKills = summary.enemiesDestroyed?.shieldDrone ?? 0;
  if (droneKills > 0) {
    const droneRule = config.version >= 4 ? config.enemies?.shieldDrone : config.enemySpawnRules?.shieldDrone;
    const turretRule = config.version >= 4 ? config.enemies?.sentryTurret : config.enemySpawnRules?.sentryTurret;
    if (config.version < 3 || !droneRule || !turretRule || config.enemyPoints?.shieldDrone === undefined) {
      reasons.push("drone config");
    } else {
      const earliestStage = (stage: number) => stage <= 1 ? 0 : 22_000 + (stage - 2) * 32_000;
      // A turret timer may already be ready when the drone stage opens.
      const earliestSpawnMs = Math.max(earliestStage(droneRule.minStage),
        earliestStage(turretRule.minStage) + turretRule.firstSpawnDelayMs);
      const disabled = droneRule.maxActive < 1 || (config.version >= 4 && config.enemies!.shieldDrone.spawnChance <= 0)
        || turretRule.maxActive < 1 || (config.version >= 4 && config.enemies!.sentryTurret.spawnChance <= 0);
      const maxKills = disabled || durationMs < earliestSpawnMs
        ? 0 : 1 + Math.floor((durationMs - earliestSpawnMs) / turretRule.spawnEveryMs);
      if (stageReached < Math.max(droneRule.minStage, turretRule.minStage) || droneKills > maxKills) reasons.push("drone spawn bound");
    }
  }
  const mineLayerKills = summary.enemiesDestroyed?.mineLayer ?? 0;
  if (mineLayerKills > 0) {
    const rule = config.enemies?.mineLayer;
    if (config.version < 5 || !rule || config.enemyPoints?.mineLayer === undefined) {
      reasons.push("mine layer config");
    } else {
      const earliestStageMs = rule.minStage <= 1 ? 0 : 22_000 + (rule.minStage - 2) * 32_000;
      const earliestSpawnMs = earliestStageMs + rule.firstSpawnDelayMs;
      const maxKills = rule.maxActive < 1 || rule.spawnChance <= 0 || durationMs < earliestSpawnMs
        ? 0 : 1 + Math.floor((durationMs - earliestSpawnMs) / rule.spawnEveryMs);
      if (stageReached < rule.minStage || mineLayerKills > maxKills) reasons.push("mine layer spawn bound");
    }
  }
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
