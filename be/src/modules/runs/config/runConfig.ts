import { SCORING_CONFIG, type ScoringConfig } from "../scoring";
import { ASTEROIDS_CONFIG } from "../../../shared/game-config/asteroidsConfig";
import { SPAWN_CONFIG } from "../../../shared/game-config/spawnConfig";
import { WEAPONS_CONFIG } from "../../../shared/game-config/weaponsConfig";
import { DIFFICULTY_CONFIG } from "../../../shared/game-config/difficultyConfig";
import { EXTRACTION_CONFIG } from "../../../shared/game-config/extractionConfig";
import { ZONES_CONFIG } from "../../../shared/game-config/zonesConfig";
import { LOOT_CONFIG } from "../../../shared/game-config/lootConfig";
import { PLAYER_CONFIG } from "../../../shared/game-config/playerConfig";
export const GAMEPLAY_CONFIG = Object.freeze({
  player: PLAYER_CONFIG,
  weapons: WEAPONS_CONFIG,
  asteroids: ASTEROIDS_CONFIG,
  difficulty: DIFFICULTY_CONFIG,
  spawn: SPAWN_CONFIG,
  extraction: EXTRACTION_CONFIG,
  loot: LOOT_CONFIG,
  zones: ZONES_CONFIG,
});
export type GameplayConfig = typeof GAMEPLAY_CONFIG;
export type RunConfig = ScoringConfig & { gameplay: GameplayConfig };
export const RUN_CONFIG = Object.freeze({ ...SCORING_CONFIG, gameplay: GAMEPLAY_CONFIG });

// JSON snapshots can outlive deployments. Validate required shape before calculation.
function matchesConfig(actual: unknown, template: unknown): boolean {
  if (template === null) return actual === null;
  if (typeof template === "number") return typeof actual === "number" && Number.isFinite(actual) && actual >= 0;
  if (!actual || typeof actual !== "object" || Array.isArray(actual) !== Array.isArray(template)) return false;
  return Object.entries(template as object).every(([key, child]) => matchesConfig((actual as Record<string, unknown>)[key], child));
}

export function isScoringConfig(value: unknown): value is typeof SCORING_CONFIG {
  if (!matchesConfig(value, SCORING_CONFIG)) return false;
  const config = value as typeof SCORING_CONFIG;
  return Number.isInteger(config.version) && config.version >= 7
    && Object.values(config.enemies).every((enemy) => enemy.minStage >= 1 && enemy.spawnChance <= 1)
    && config.enemies.sentryTurret.spawnEveryMs > 0 && config.enemies.mineLayer.spawnEveryMs > 0;
}

export function isGameplayConfig(value: unknown): value is GameplayConfig {
  const candidate = value as GameplayConfig | undefined;
  if (!candidate?.weapons?.variants) return false;
  const copy = structuredClone(candidate);
  for (const variant of Object.values(copy.weapons.variants)) {
    if (!variant || !Array.isArray(variant.directions) || !variant.directions.length || !variant.directions.every(Number.isFinite)) return false;
    variant.directions = variant.directions.map(Math.abs);
  }
  if (!matchesConfig(copy, GAMEPLAY_CONFIG)) return false;
  const { extraction, spawn, difficulty, weapons, loot, zones, player, asteroids } = candidate;
  return extraction.spawnEveryMs > 0 && extraction.ttlMs > 0 && extraction.requiredMs > 0
    && extraction.maxDurationMs >= extraction.minDurationMs
    && spawn.minSpawnEveryMs > 0 && spawn.targeting.stageSpan > 0 && difficulty.rampMs > 0 && difficulty.compositionStageSpan > 0
    && Object.values(spawn.edgeWeights).reduce((sum, weight) => sum + weight, 0) > 0
    && ["start", "end"].every((key) => Object.values(difficulty.composition).reduce((sum, weights) => sum + weights[key as "start" | "end"], 0) > 0)
    && weapons.minFireCooldownMs > 0 && weapons.primary.lifetimeMs > 0 && weapons.charged.cooldownMs > 0
    && Object.values(weapons.variants).every((variant) => Number.isInteger(variant.pellets) && variant.pellets > 0
      && Number.isInteger(variant.pierce) && variant.cooldownMultiplier > 0
      && (!variant.falloff || variant.falloff.endPx > variant.falloff.startPx))
    && weapons.variants.spread_shot.directions.length === 3
    && Number.isInteger(loot.coinBonusExclusive) && loot.coinBonusExclusive >= 1 && Number.isInteger(loot.resourceAmount) && player.maxHp > 0
    && Object.values(loot.drops).every((drop) => Number.isInteger(drop.coins)
      && drop.ironChance <= 1 && drop.crystalChance <= 1 && drop.goldChance <= 1)
    && Object.values(asteroids.types).every((type) => type.hp > 0 && type.radius > 0)
    && Object.values(zones).every((zone) => zone.tickMs > 0 && zone.spawnEveryMs > 0 && zone.spawnChance <= 1);
}
