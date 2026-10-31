import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { GAMEPLAY_CONFIG, RUN_CONFIG, isGameplayConfig } from "./runConfig";
import { WEAPON_CATALOG, getCatalogWeapon, resolveWeaponTuning } from "../../../shared/game-config/weaponsConfig";
import { getSuspicionReasons } from "../scoring";
import type { FinishRunDto } from "../http/dto/finish-run.dto";

describe("gameplay configuration", () => {
  it("preserves the captured API balance and independent catalog projectile metadata", () => {
    // Contract fixture is consumed only by frontend tests, never production.
    const fixture = JSON.parse(readFileSync(resolve(__dirname, "../../../../../fe/src/test/runConfig.json"), "utf8"));
    expect(RUN_CONFIG).toEqual(fixture);
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
    expect(getSuspicionReasons(input, new Date(0), new Date(7000), RUN_CONFIG)).toEqual(["missing gameplay snapshot"]);
  });
});
