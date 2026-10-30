import { calculateScore, getSuspicionReasons, SCORING_CONFIG } from "./scoring";
import { FinishRunDto } from "./http/dto/finish-run.dto";
import { plainToInstance } from "class-transformer";
import { validateSync } from "class-validator";

const valid = (): FinishRunDto => ({
  runId: "94d9f61f-25fa-40c4-b271-b2471281d5a4", durationMs: 20_000, endedBy: "extract",
  extractionCount: 1, rewardMultiplier: 1,
  summary: { asteroidsDestroyed: 4, destroyedByType: { normal: 1, fast: 1, big: 1, armored: 1 },
    stageReached: 1, coinsCollected: 10, resourcesCollected: { ore: 2, crystal: 1 } },
});
const now = new Date(1_000_000);
const reasons = (input: FinishRunDto, elapsed = 60_000) => getSuspicionReasons(input, new Date(+now - elapsed), now);

describe("arcade scoring", () => {
  it.each([
    [{ normal: 0, fast: 0, big: 0, armored: 0 }, 1, 0],
    [{ normal: 1, fast: 0, big: 0, armored: 0 }, 1, 10],
    [{ normal: 0, fast: 1, big: 0, armored: 0 }, 1, 20],
    [{ normal: 0, fast: 0, big: 1, armored: 0 }, 1, 30],
    [{ normal: 0, fast: 0, big: 0, armored: 1 }, 1, 50],
    [{ normal: 2, fast: 3, big: 4, armored: 5 }, 3, 650],
  ])("uses the scoring config: %j at stage %s", (destroyed, stage, score) => {
    expect(calculateScore(SCORING_CONFIG, destroyed, stage)).toBe(score);
  });
  it("rejects score overflow", () => {
    expect(() => calculateScore(SCORING_CONFIG, { normal: 2_147_483_647, fast: 0, big: 0, armored: 0 }, 1)).toThrow();
  });
  it("uses pinned values rather than global defaults", () => {
    expect(calculateScore({ ...SCORING_CONFIG, stageBonus: 7 }, valid().summary.destroyedByType, 2)).toBe(117);
  });
});

describe("run sanity checks", () => {
  it("allows real timing, pauses and multiplier above 10", () => {
    expect(reasons(valid())).toEqual([]);
    expect(reasons(valid(), 100_000)).toEqual([]);
    const input = valid();
    Object.assign(input, { durationMs: 22_000 + 60 * 32_000, endedBy: "death", extractionCount: 0, rewardMultiplier: 10.15 });
    input.summary.stageReached = 62;
    expect(reasons(input, input.durationMs)).toEqual([]);
  });
  it.each([
    ["duration", (x: FinishRunDto) => { x.durationMs = 999; }],
    ["duration", (x: FinishRunDto) => { x.durationMs = 10_800_001; }],
    ["duration", (x: FinishRunDto) => { x.durationMs = 62_001; }],
    ["destroyed totals", (x: FinishRunDto) => { x.summary.asteroidsDestroyed++; }],
    ["destroyed totals", (x: FinishRunDto) => { x.summary.rareAsteroidsDestroyed = 0; }],
    ["stage timing", (x: FinishRunDto) => { x.summary.stageReached = 2; }],
    ["spawn bound", (x: FinishRunDto) => { x.summary.asteroidsDestroyed = 999; }],
    ["multiplier", (x: FinishRunDto) => { x.rewardMultiplier = 2; }],
    ["extraction", (x: FinishRunDto) => { x.extractionCount = 2; }],
    ["extraction", (x: FinishRunDto) => { x.durationMs = 11_999; }],
    ["loot bound", (x: FinishRunDto) => { x.summary.coinsCollected = 23; }],
    ["loot bound", (x: FinishRunDto) => { x.summary.resourcesCollected.ore = 5; }],
    ["loot bound", (x: FinishRunDto) => { x.summary.resourcesCollected.crystal = 5; }],
  ])("flags %s", (reason, mutate) => {
    const input = valid(); mutate(input);
    expect(reasons(input)).toContain(reason);
  });
  it("checks exact stage and elapsed-time boundaries", () => {
    const input = valid();
    Object.assign(input, { endedBy: "death", extractionCount: 0, rewardMultiplier: 1.15, durationMs: 22_000 });
    input.summary.stageReached = 2;
    expect(reasons(input, 20_000)).toEqual([]);
    input.durationMs--;
    expect(reasons(input)).toContain("stage timing");
    input.durationMs = 54_000; input.summary.stageReached = 3; input.rewardMultiplier = 1.3;
    expect(reasons(input)).toEqual([]);
  });
});

describe("finish DTO", () => {
  const errors = (input: unknown) => validateSync(plainToInstance(FinishRunDto, input), { whitelist: true, forbidNonWhitelisted: true });
  it("accepts complete input", () => expect(errors(valid())).toEqual([]));
  it.each([
    (x: any) => { delete x.summary; },
    (x: any) => { x.summary = null; },
    (x: any) => { delete x.summary.destroyedByType; },
    (x: any) => { x.summary.resourcesCollected = []; },
    (x: any) => { x.summary.destroyedByType.fast = -1; },
    (x: any) => { x.summary.destroyedByType.normal = 0.5; },
    (x: any) => { x.summary.stageReached = 0; },
    (x: any) => { x.summary.coinsCollected = Number.MAX_SAFE_INTEGER; },
    (x: any) => { x.rewardMultiplier = Infinity; },
    (x: any) => { x.endedBy = "quit"; },
    (x: any) => { x.score = 9999; },
  ])("rejects malformed data %#", (mutate) => {
    const input = valid(); mutate(input); expect(errors(input).length).toBeGreaterThan(0);
  });
});

describe("sentry turret scoring", () => {
  const withEnemies = (count = 1): FinishRunDto => {
    const input = valid();
    Object.assign(input, { durationMs: 24_000, endedBy: "death", extractionCount: 0, rewardMultiplier: 1.15 });
    Object.assign(input.summary, { stageReached: 2, enemiesDestroyed: { sentryTurret: count } });
    return input;
  };
  it("adds enemy points independently of asteroid counts and preserves version 1", () => {
    const input = withEnemies();
    expect(calculateScore(SCORING_CONFIG, input.summary.destroyedByType, 2, input.summary.enemiesDestroyed)).toBe(310);
    const v1 = { version: 1, asteroidPoints: SCORING_CONFIG.asteroidPoints, stageBonus: 100 };
    expect(calculateScore(v1, input.summary.destroyedByType, 2)).toBe(210);
    expect(getSuspicionReasons(input, new Date(+now - 60000), now, v1)).toContain("enemy config");
    input.summary.enemiesDestroyed = undefined;
    expect(getSuspicionReasons(input, new Date(+now - 60000), now, v1)).toEqual([]);
  });
  it("uses pinned point values and rejects enemy score overflow", () => {
    const pinned = { ...SCORING_CONFIG, enemyPoints: { sentryTurret: 7 } };
    expect(calculateScore(pinned, valid().summary.destroyedByType, 2, { sentryTurret: 2 })).toBe(224);
    expect(() => calculateScore(SCORING_CONFIG, valid().summary.destroyedByType, 2, { sentryTurret: 2_147_483_647 })).toThrow();
  });
  it("checks first spawn and repeat interval boundaries", () => {
    const input = withEnemies();
    expect(reasons(input)).toEqual([]);
    input.durationMs--;
    expect(reasons(input)).toContain("enemy spawn bound");
    input.durationMs = 38999;
    input.summary.enemiesDestroyed!.sentryTurret = 2;
    expect(reasons(input)).toContain("enemy spawn bound");
    input.durationMs++;
    expect(reasons(input)).toEqual([]);
    input.summary.stageReached = 1;
    expect(reasons(input)).toContain("enemy spawn bound");
  });
  it("uses pinned spawn rules rather than the deployed interval", () => {
    const config = { ...SCORING_CONFIG, enemies: { ...SCORING_CONFIG.enemies, sentryTurret: {
      ...SCORING_CONFIG.enemies.sentryTurret, firstSpawnDelayMs: 4000, spawnEveryMs: 20000,
    } } };
    const input = withEnemies();
    const check = () => getSuspicionReasons(input, new Date(+now - 60000), now, config);
    expect(check()).toContain("enemy spawn bound");
    input.durationMs = 26000;
    expect(check()).toEqual([]);
    input.summary.enemiesDestroyed!.sentryTurret = 2;
    input.durationMs = 45999;
    expect(check()).toContain("enemy spawn bound");
    input.durationMs++;
    expect(check()).toEqual([]);
  });
  it("validates optional counters strictly, including null and unknown enemy types", () => {
    const errors = (input: unknown) => validateSync(plainToInstance(FinishRunDto, input), { whitelist: true, forbidNonWhitelisted: true });
    expect(errors(withEnemies())).toEqual([]);
    expect(errors(valid())).toEqual([]);
    for (const value of [null, [], {}, { sentryTurret: null }, { sentryTurret: -1 }, { sentryTurret: 0.5 },
      { sentryTurret: "1" }, { sentryTurret: Infinity }, { sentryTurret: 2_147_483_648 }, { sentryTurret: 0, boss: 1 }]) {
      const input = withEnemies();
      (input.summary as any).enemiesDestroyed = value;
      expect(errors(input).length).toBeGreaterThan(0);
    }
  });
});

describe("shield drone scoring", () => {
  const withDrones = (count = 1): FinishRunDto => {
    const input = valid();
    Object.assign(input, { durationMs: 54_000, endedBy: "death", extractionCount: 0, rewardMultiplier: 1.3 });
    Object.assign(input.summary, { stageReached: 3, enemiesDestroyed: { sentryTurret: 0, shieldDrone: count } });
    return input;
  };
  it("adds pinned drone points independently of turret kills and preserves old formulas", () => {
    const input = withDrones();
    expect(calculateScore(SCORING_CONFIG, input.summary.destroyedByType, 3, input.summary.enemiesDestroyed)).toBe(360);
    const pinned = { ...SCORING_CONFIG, enemyPoints: { sentryTurret: 100, shieldDrone: 7 } };
    expect(calculateScore(pinned, input.summary.destroyedByType, 3, { sentryTurret: 1, shieldDrone: 2 })).toBe(424);
    expect(calculateScore(SCORING_CONFIG, input.summary.destroyedByType, 3, { sentryTurret: 1 })).toBe(410);
    for (const version of [1, 2]) {
      const old = { ...SCORING_CONFIG, version };
      expect(calculateScore(old, input.summary.destroyedByType, 3, input.summary.enemiesDestroyed)).toBe(310);
      expect(getSuspicionReasons(input, new Date(0), now, old)).toContain("drone config");
    }
  });
  it("checks stage and repeat boundaries without imposing a probabilistic quota", () => {
    const input = withDrones();
    expect(reasons(input)).toEqual([]);
    input.durationMs--;
    expect(reasons(input)).toContain("drone spawn bound");
    input.durationMs = 68_999;
    input.summary.enemiesDestroyed!.shieldDrone = 2;
    expect(reasons(input, 100_000)).toContain("drone spawn bound");
    input.durationMs++;
    expect(reasons(input, 100_000)).toEqual([]);
    input.summary.stageReached = 2;
    expect(reasons(input, 100_000)).toContain("drone spawn bound");
  });
  it("uses pinned spawn rules, not current deployment values", () => {
    const input = withDrones();
    input.durationMs = 101_000;
    input.summary.stageReached = 4;
    input.rewardMultiplier = 1.45;
    input.summary.enemiesDestroyed!.shieldDrone = 2;
    const config = { ...SCORING_CONFIG, enemies: { ...SCORING_CONFIG.enemies, sentryTurret: {
      ...SCORING_CONFIG.enemies.sentryTurret, spawnEveryMs: 20_000,
    }, shieldDrone: { ...SCORING_CONFIG.enemies.shieldDrone, minStage: 4 } } };
    const check = () => getSuspicionReasons(input, new Date(0), now, config);
    expect(check()).toContain("drone spawn bound");
    input.durationMs = 106_000;
    expect(check()).toEqual([]);
  });
  it("rejects positive counts without drone config or possible spawning", () => {
    const input = withDrones();
    const noRule = { ...SCORING_CONFIG, enemies: undefined };
    expect(getSuspicionReasons(input, new Date(0), now, noRule)).toContain("drone config");
    const impossible = { ...SCORING_CONFIG, enemies: { ...SCORING_CONFIG.enemies,
      shieldDrone: { ...SCORING_CONFIG.enemies.shieldDrone, maxActive: 0 } } };
    expect(getSuspicionReasons(input, new Date(0), now, impossible)).toContain("drone spawn bound");
  });
  it("rejects drone score overflow", () => {
    expect(() => calculateScore(SCORING_CONFIG, valid().summary.destroyedByType, 3,
      { sentryTurret: 0, shieldDrone: 2_147_483_647 })).toThrow("score out of range");
  });
  it("accepts omitted/zero counts and strictly validates supplied counts", () => {
    const errors = (input: unknown) => validateSync(plainToInstance(FinishRunDto, input), { whitelist: true, forbidNonWhitelisted: true });
    expect(errors(withDrones())).toEqual([]);
    expect(errors(withDrones(0))).toEqual([]);
    expect(errors(valid())).toEqual([]);
    for (const shieldDrone of [null, -1, 0.5, "1", Infinity, 2_147_483_648]) {
      const input = withDrones();
      Object.assign(input.summary.enemiesDestroyed!, { shieldDrone });
      expect(errors(input).length).toBeGreaterThan(0);
    }
  });
});

describe('server enemy config v4', () => {
  it.each([2, 3])('finishes a historical version %s snapshot using its own spawn rules', (version) => {
    const config = { version, asteroidPoints: SCORING_CONFIG.asteroidPoints, stageBonus: 100,
      enemyPoints: { sentryTurret: 100, shieldDrone: 50 }, enemySpawnRules: {
        sentryTurret: { minStage: 2, firstSpawnDelayMs: 2000, spawnEveryMs: 15000, maxActive: 1 },
        shieldDrone: { minStage: 3, maxActive: 1 },
      } };
    const input = valid();
    Object.assign(input, { durationMs: 60000, endedBy: 'death', extractionCount: 0, rewardMultiplier: 1.3 });
    Object.assign(input.summary, { stageReached: 3, enemiesDestroyed: { sentryTurret: 1, shieldDrone: version === 3 ? 1 : 0 } });
    expect(getSuspicionReasons(input, new Date(0), now, config)).toEqual([]);
    expect(calculateScore(config, input.summary.destroyedByType, 3, input.summary.enemiesDestroyed)).toBe(version === 3 ? 460 : 410);
  });
  it('uses only the v4 enemy stage, ignoring contradictory historical fields', () => {
    const config = { ...SCORING_CONFIG, enemies: { ...SCORING_CONFIG.enemies,
      sentryTurret: { ...SCORING_CONFIG.enemies.sentryTurret, minStage: 1, firstSpawnDelayMs: 0 },
      shieldDrone: { ...SCORING_CONFIG.enemies.shieldDrone, minStage: 1 },
    }, enemySpawnRules: { sentryTurret: { minStage: 99, firstSpawnDelayMs: 99999, spawnEveryMs: 99999, maxActive: 0 } } };
    const input = valid();
    input.summary.enemiesDestroyed = { sentryTurret: 1, shieldDrone: 1 };
    expect(getSuspicionReasons(input, new Date(0), now, config)).toEqual([]);
  });
  it.each(['sentryTurret', 'shieldDrone'] as const)('rejects kills when the server disables %s spawning', (type) => {
    const config = { ...SCORING_CONFIG, enemies: { ...SCORING_CONFIG.enemies,
      [type]: { ...SCORING_CONFIG.enemies[type], spawnChance: 0 },
    } };
    const input = valid();
    Object.assign(input, { durationMs: 60000, endedBy: 'death', extractionCount: 0, rewardMultiplier: 1.3 });
    Object.assign(input.summary, { stageReached: 3, enemiesDestroyed: { sentryTurret: 1, shieldDrone: 1 } });
    const reasons = getSuspicionReasons(input, new Date(0), now, config);
    expect(reasons).toContain(type === 'sentryTurret' ? 'enemy spawn bound' : 'drone spawn bound');
  });
});
