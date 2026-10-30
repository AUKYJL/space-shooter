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
