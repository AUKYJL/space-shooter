import { GAMEPLAY_CONFIG, RUN_CONFIG, isGameplayConfig, isScoringConfig } from "./runConfig";
import { WEAPON_CATALOG, getCatalogWeapon, resolveWeaponTuning } from "./weaponsConfig";
import { getSuspicionReasons } from "../../modules/runs/scoring";
import type { FinishRunDto } from "../../modules/runs/http/dto/finish-run.dto";

describe("gameplay configuration", () => {
  it("exposes gameplay and independent catalog projectile metadata", () => {
    expect(GAMEPLAY_CONFIG.player.maxHp).toBe(1000);
    expect(GAMEPLAY_CONFIG.weapons.primary.speed).toBe(920);
    expect(getCatalogWeapon("basic_laser").baseFireRate).toBe(2);
    expect(WEAPON_CATALOG.map((w) => w.projectileSpeed)).toEqual([900, 850, 800, 780]);
  });
  it("resolves existing upgraded shot values with unchanged rounding", () => {
    expect(resolveWeaponTuning(1, 2)).toEqual({ bulletDamage: 1, chargedDamage: 11, fireCooldownMs: 500 });
    expect(resolveWeaponTuning(3.5, 1.6)).toEqual({ bulletDamage: 4, chargedDamage: 16, fireCooldownMs: 625 });
    expect(resolveWeaponTuning(2, 100)).toEqual({ bulletDamage: 2, chargedDamage: 12, fireCooldownMs: 60 });
    expect(() => resolveWeaponTuning(1, 0)).toThrow("Invalid weapon catalog stats");
  });
  it("rejects missing and malformed snapshots", () => {
    expect(isGameplayConfig(GAMEPLAY_CONFIG)).toBe(true);
    expect(isGameplayConfig(undefined)).toBe(false);
    const malformed = structuredClone(GAMEPLAY_CONFIG);
    malformed.zones.heal.tickMs = 0;
    expect(isGameplayConfig(malformed)).toBe(false);
    expect(isGameplayConfig({ ...GAMEPLAY_CONFIG, loot: {} })).toBe(false);
  });
  it("requires complete enemy configuration and points", () => {
    expect(isScoringConfig(RUN_CONFIG)).toBe(true);
    for (const type of ["sentryTurret", "shieldDrone", "mineLayer"]) {
      for (const field of ["enemies", "enemyPoints"] as const) {
        const config = structuredClone(RUN_CONFIG);
        delete (config[field] as Record<string, unknown>)[type];
        expect(isScoringConfig(config)).toBe(false);
      }
    }
  });
  it("uses pinned multiplier, extraction, spawn and loot rules instead of deployment settings", () => {
    const gameplay = structuredClone(GAMEPLAY_CONFIG);
    Object.assign(gameplay.extraction, { firstSpawnMs: 1000, ttlMs: 1000, spawnEveryMs: 2000 });
    Object.assign(gameplay.difficulty, { stageMultiplierStep: 0.5 });
    gameplay.loot.drops.normal.coins = 20;
    const input: FinishRunDto = { runId: "test", durationMs: 7000, endedBy: "extract", extractionCount: 1, rewardMultiplier: 2,
      summary: { destroyedByType: { normal: 1, fast: 0, big: 0, armored: 0 }, asteroidsDestroyed: 1,
        stageReached: 3, coinsCollected: 22, resourcesCollected: { ore: 1, crystal: 1 } } };
    expect(getSuspicionReasons(input, new Date(0), new Date(7000), RUN_CONFIG, gameplay)).toEqual([]);
    expect(getSuspicionReasons(input, new Date(0), new Date(7000), RUN_CONFIG, GAMEPLAY_CONFIG)).toEqual(expect.arrayContaining(["stage timing", "multiplier", "extraction", "loot bound"]));
  });
});
