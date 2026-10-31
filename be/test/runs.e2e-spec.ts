import { RUN_CONFIG, GAMEPLAY_CONFIG } from "../src/shared/game-config/runConfig";
import { randomUUID } from "node:crypto";
import * as request from "supertest";
import { Test } from "@nestjs/testing";
import { INestApplication } from "@nestjs/common";
import { AppModule } from "../src/app.module";
import { PrismaService } from "../src/infra/prisma/prisma.service";
import { JwtService } from "../src/infra/jwt/jwt.service";
import { RunsService } from "../src/modules/runs/runs.service";
import { SCORING_CONFIG } from "../src/shared/game-config/scoringConfig";
import type { FinishRunDto } from "../src/modules/runs/http/dto/finish-run.dto";

// These integration tests must run against a disposable, migrated PostgreSQL DB.
(process.env.DATABASE_URL ? describe : describe.skip)("runs (PostgreSQL)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let service: RunsService;
  let userId: string;
  let token: string;

  beforeAll(async () => {
    process.env.JWT_SECRET ??= "test-secret";
    process.env.PRISMA_CONNECT = "1";
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
    prisma = app.get(PrismaService);
    service = app.get(RunsService);
  });
  beforeEach(async () => {
    const user = await prisma.user.create({ data: { username: randomUUID(), passwordHash: "unused-in-token-tests", currencies: { create: { coins: 30, ore: 5, crystal: 7 } },
      weapons: { create: { weaponId: "basic_laser", unlocked: true } } } });
    userId = user.id;
    token = app.get(JwtService).signUserToken(userId);
  });
  afterEach(async () => {
    jest.restoreAllMocks();
    await prisma.user.delete({ where: { id: userId } });
  });
  afterAll(async () => { await app?.close(); });

  const post = (url: string, body: object) => request(app.getHttpServer()).post(url)
    .set("Authorization", `Bearer ${token}`).send(body);
  const get = (url: string) => request(app.getHttpServer()).get(url).set("Authorization", `Bearer ${token}`);
  async function start(age = 60_000) {
    const response = await post("/runs/start", { weaponId: "basic_laser" }).expect(201);
    await prisma.run.update({ where: { id: response.body.runId }, data: { startedAt: new Date(Date.now() - age) } });
    return response.body.runId as string;
  }
  const input = (runId: string): FinishRunDto => ({ runId, durationMs: 20_000, endedBy: "extract",
    extractionCount: 1, rewardMultiplier: 1,
    summary: { asteroidsDestroyed: 4, destroyedByType: { normal: 1, fast: 1, big: 1, armored: 1 },
      stageReached: 1, coinsCollected: 10, resourcesCollected: { ore: 2, crystal: 1 } } });
  const currencies = () => prisma.userCurrencies.findUniqueOrThrow({ where: { userId } });

  it("authenticates config and starts directly with current server settings", async () => {
    await request(app.getHttpServer()).get("/runs/config").expect(401);
    expect((await get("/runs/config").expect(200)).body).toEqual(RUN_CONFIG);
    expect(await prisma.run.count({ where: { userId } })).toBe(0);
    await post("/runs/start", { weaponId: "basic_laser" }).expect(201);
  });
  it("returns the complete gameplay snapshot and resolved catalog stats", async () => {
    const response = await post("/runs/start", { weaponId: "basic_laser" }).expect(201);
    expect(response.body.snapshot).toMatchObject({ damage: 1, fireRate: 2, maxHp: 1000,
      weaponTuning: { bulletDamage: 1, chargedDamage: 11, fireCooldownMs: 500 }, gameplayConfig: GAMEPLAY_CONFIG });
    const stored = await prisma.run.findUniqueOrThrow({ where: { id: response.body.runId } });
    expect(stored.snapshotJson).toEqual(response.body.snapshot);
  });

  it.each(["gameplayConfig", "weaponTuning", "scoringFields", "scoringConfig", "enemyConfig", "invalidTiming", "emptySnapshot", "primitiveSnapshot"])("rejects malformed snapshot %s without rewards and replays rejection", async (field) => {
    const body = input(await start());
    const stored = await prisma.run.findUniqueOrThrow({ where: { id: body.runId } });
    const snapshot = stored.snapshotJson as any;
    if (field === "scoringFields") delete snapshot.scoringConfig.enemyPoints;
    else if (field === "enemyConfig") delete snapshot.scoringConfig.enemies.mineLayer;
    else if (field === "invalidTiming") snapshot.gameplayConfig.extraction.spawnEveryMs = 0;
    else delete snapshot[field];
    await prisma.run.update({ where: { id: body.runId }, data: { snapshotJson: field === "emptySnapshot" ? {} : field === "primitiveSnapshot" ? "invalid" : snapshot } });
    const before = await currencies();
    const first = await post("/runs/finish", body).expect(201);
    expect(first.body).toMatchObject({ accepted: false, score: null, bestScore: 0,
      grantedRewards: { coins: 0, resources: { ore: 0, crystal: 0 } } });
    expect((await post("/runs/finish", body).expect(201)).body).toEqual(first.body);
    expect(await currencies()).toEqual(before);
  });

  it("uses pinned gameplay multiplier and reward caps after deployment changes", async () => {
    const gameplay = structuredClone(GAMEPLAY_CONFIG);
    Object.assign(gameplay.difficulty, { stageMultiplierStep: 0.5 });
    Object.assign(gameplay.loot.rewardCaps, { coins: 3, ore: 2, crystal: 1 });
    const deployed = jest.spyOn(service, "getConfig").mockReturnValue({ ...RUN_CONFIG, gameplay });
    const body = input(await start(100000));
    body.durationMs = 60000; body.rewardMultiplier = 1.5; body.summary.stageReached = 2;
    deployed.mockReturnValue(structuredClone(RUN_CONFIG));
    const first = await post("/runs/finish", body).expect(201);
    expect(first.body).toMatchObject({ accepted: true, score: 210,
      grantedRewards: { coins: 3, resources: { ore: 2, crystal: 1 } } });
    expect((await post("/runs/finish", body).expect(201)).body).toEqual(first.body);
    expect(await currencies()).toMatchObject({ coins: 33, ore: 7, crystal: 8 });
  });

  it("pins scoring config even when the deployed config changes", async () => {
    const runId = await start();
    const stored = await prisma.run.findUniqueOrThrow({ where: { id: runId } });
    expect((stored.snapshotJson as any).scoringConfig).toEqual(SCORING_CONFIG);
    jest.spyOn(service, "getConfig").mockReturnValue({ ...RUN_CONFIG, asteroidPoints: { normal: 999, fast: 999, big: 999, armored: 999 }, stageBonus: 900 });
    const response = await post("/runs/finish", input(runId)).expect(201);
    expect(response.body).toMatchObject({ accepted: true, score: 110, bestScore: 110 });
  });
  it("grants extraction loot once and replays canonical outcome even for a changed payload", async () => {
    const body = input(await start());
    const first = await post("/runs/finish", body).expect(201);
    expect(first.body).toEqual({ accepted: true, score: 110, bestScore: 110,
      grantedRewards: { coins: 10, resources: { ore: 2, crystal: 1 } } });
    body.summary.destroyedByType.armored = 2;
    expect((await post("/runs/finish", body).expect(201)).body).toEqual(first.body);
    expect(await currencies()).toMatchObject({ coins: 40, ore: 7, crystal: 8 });
    expect(await prisma.runResult.count({ where: { run: { userId } } })).toBe(1);
    expect((await get("/me").expect(200)).body.bestScore).toBe(110);
    expect((await get("/runs/history").expect(200)).body[0].result.score).toBe(110);
  });
  it("serializes parallel finishes of one run", async () => {
    const body = input(await start());
    const results = await Promise.all(Array.from({ length: 6 }, () => post("/runs/finish", body).expect(201)));
    for (const result of results) expect(result.body).toEqual(results[0].body);
    expect(await currencies()).toMatchObject({ coins: 40, ore: 7, crystal: 8 });
    expect(await prisma.runResult.count({ where: { run: { userId } } })).toBe(1);
  });
  it("never lowers bestScore for sequential or competing runs", async () => {
    const low = input(await start());
    const high = input(await start());
    high.summary.destroyedByType.armored = 3;
    high.summary.asteroidsDestroyed = 6;
    await Promise.all([post("/runs/finish", high).expect(201), post("/runs/finish", low).expect(201)]);
    expect((await get("/me")).body.bestScore).toBe(210);
    const later = input(await start());
    expect((await post("/runs/finish", later)).body.bestScore).toBe(210);
    expect((await post("/runs/finish", low)).body.bestScore).toBe(210);
  });
  it("awards no currencies on death but retains score and record", async () => {
    const body = input(await start()); body.endedBy = "death"; body.extractionCount = 0;
    const before = await currencies();
    expect((await post("/runs/finish", body).expect(201)).body).toEqual({ accepted: true, score: 110, bestScore: 110,
      grantedRewards: { coins: 0, resources: { ore: 0, crystal: 0 } } });
    expect(await currencies()).toEqual(before);
  });
  it.each(["duration", "stage", "total", "loot", "multiplier", "extraction"])("persists suspicious %s without loot or record", async (kind) => {
    const body = input(await start(0));
    if (kind !== "duration") await prisma.run.update({ where: { id: body.runId }, data: { startedAt: new Date(Date.now() - 60_000) } });
    if (kind === "stage") body.summary.stageReached = 5;
    if (kind === "total") body.summary.asteroidsDestroyed = 10;
    if (kind === "loot") body.summary.coinsCollected = 1000;
    if (kind === "multiplier") body.rewardMultiplier = 3;
    if (kind === "extraction") body.extractionCount = 2;
    const before = await currencies();
    const response = await post("/runs/finish", body).expect(201);
    expect(response.body).toMatchObject({ accepted: false, bestScore: 0,
      grantedRewards: { coins: 0, resources: { ore: 0, crystal: 0 } } });
    expect(await currencies()).toEqual(before);
    expect((await prisma.run.findUniqueOrThrow({ where: { id: body.runId } })).status).toBe("finished");
    expect((await post("/runs/finish", body).expect(201)).body).toEqual(response.body);
  });
  it("rejects invalid DTO and supplied score before changing state", async () => {
    const body = input(await start());
    await post("/runs/finish", { ...body, score: 9999 }).expect(400);
    await post("/runs/finish", { ...body, summary: null }).expect(400);
    expect((await prisma.run.findUniqueOrThrow({ where: { id: body.runId } })).status).toBe("started");
  });
  it("rolls back the claim, loot and result when record update fails, then allows retry", async () => {
    const body = input(await start());
    // Trigger a real database error after result creation and currency UPDATE.
    await prisma.$executeRawUnsafe(`CREATE FUNCTION score_test_reject_update() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.id = '${userId}' THEN RAISE EXCEPTION 'test rollback'; END IF; RETURN NEW; END $$`);
    await prisma.$executeRawUnsafe('CREATE TRIGGER score_test_reject_update BEFORE UPDATE ON "User" FOR EACH ROW EXECUTE FUNCTION score_test_reject_update()');
    try {
      const before = await currencies();
      await post("/runs/finish", body).expect(500);
      expect(await currencies()).toEqual(before);
      expect(await prisma.runResult.findUnique({ where: { runId: body.runId } })).toBeNull();
      expect((await prisma.run.findUniqueOrThrow({ where: { id: body.runId } })).status).toBe("started");
    } finally {
      await prisma.$executeRawUnsafe('DROP TRIGGER score_test_reject_update ON "User"');
      await prisma.$executeRawUnsafe('DROP FUNCTION score_test_reject_update()');
    }
    expect((await post("/runs/finish", body).expect(201)).body.accepted).toBe(true);
    expect(await currencies()).toMatchObject({ coins: 40, ore: 7, crystal: 8 });
  });
  it("preserves extraction caps, floor rounding and high-stage multipliers", async () => {
    const capped = input(await start(4_000_000));
    Object.assign(capped, { durationMs: 3_200_000, rewardMultiplier: 15.85 });
    capped.summary = { asteroidsDestroyed: 3000, destroyedByType: { normal: 3000, fast: 0, big: 0, armored: 0 },
      stageReached: 100, coinsCollected: 15000, resourcesCollected: { ore: 1000, crystal: 1000 } };
    expect((await post("/runs/finish", capped).expect(201)).body).toMatchObject({ accepted: true,
      grantedRewards: { coins: 10000, resources: { ore: 1000, crystal: 1000 } } });
    const rounded = input(await start());
    Object.assign(rounded, { durationMs: 50_000, rewardMultiplier: 1.15 });
    rounded.summary.stageReached = 2;
    rounded.summary.coinsCollected = 3;
    rounded.summary.resourcesCollected = { ore: 1, crystal: 1 };
    expect((await post("/runs/finish", rounded).expect(201)).body).toMatchObject({ accepted: true,
      grantedRewards: { coins: 3, resources: { ore: 1, crystal: 1 } } });
  });
  it("replays nullable scores from legacy results without recomputation or rewards", async () => {
    const runId = await start();
    await prisma.run.update({ where: { id: runId }, data: { status: "finished", finishedAt: new Date(),
      result: { create: { accepted: true, summaryJson: {}, grantedRewardsJson: { coins: 0, resources: { ore: 0, crystal: 0 } } } } } });
    const before = await currencies();
    expect((await post("/runs/finish", input(runId)).expect(201)).body).toMatchObject({ accepted: true, score: null, bestScore: 0 });
    expect((await get("/runs/history")).body[0].result.score).toBeNull();
    expect(await currencies()).toEqual(before);
  });
  it("does not expose another user's run", async () => {
    const body = input(await start());
    const other = await prisma.user.create({ data: { username: randomUUID(), passwordHash: "unused-in-token-tests" } });
    try {
      await request(app.getHttpServer()).post("/runs/finish")
        .set("Authorization", `Bearer ${app.get(JwtService).signUserToken(other.id)}`).send(body).expect(404);
    } finally { await prisma.user.delete({ where: { id: other.id } }); }
  });
  it("pins turret points/rules, preserves loot, and replays the canonical result", async () => {
    const body = input(await start());
    Object.assign(body, { durationMs: 50000, rewardMultiplier: 1.15 });
    body.summary.stageReached = 2;
    body.summary.enemiesDestroyed = { sentryTurret: 2 };
    jest.spyOn(service, "getConfig").mockReturnValue({ ...RUN_CONFIG,
      enemyPoints: { ...SCORING_CONFIG.enemyPoints, sentryTurret: 999 }, enemies: { ...SCORING_CONFIG.enemies, sentryTurret: {
        ...SCORING_CONFIG.enemies.sentryTurret, spawnEveryMs: 100000,
      } } });
    const first = await post("/runs/finish", body).expect(201);
    expect(first.body).toEqual({ accepted: true, score: 410, bestScore: 410,
      grantedRewards: { coins: 11, resources: { ore: 2, crystal: 1 } } });
    body.summary.enemiesDestroyed.sentryTurret = 99;
    expect((await post("/runs/finish", body).expect(201)).body).toEqual(first.body);
    expect((await get("/runs/history").expect(200)).body[0].result).toMatchObject({
      score: 410, summary: { enemiesDestroyed: { sentryTurret: 2 } },
    });
  });
  it("persists impossible turret counts as rejected without loot or record", async () => {
    const body = input(await start());
    body.summary.enemiesDestroyed = { sentryTurret: 999 };
    const before = await currencies();
    expect((await post("/runs/finish", body).expect(201)).body).toMatchObject({ accepted: false, bestScore: 0,
      grantedRewards: { coins: 0, resources: { ore: 0, crystal: 0 } } });
    expect(await currencies()).toEqual(before);
  });

  it("pins drone score, persists the count and replays without additional rewards", async () => {
    const body = input(await start(100_000));
    Object.assign(body, { durationMs: 80_000, rewardMultiplier: 1.3 });
    Object.assign(body.summary, { stageReached: 3, enemiesDestroyed: { sentryTurret: 0, shieldDrone: 2 } });
    jest.spyOn(service, "getConfig").mockReturnValue({ ...RUN_CONFIG,
      enemyPoints: { sentryTurret: 999, shieldDrone: 999, mineLayer: 999 } });
    const first = await post("/runs/finish", body).expect(201);
    expect(first.body).toMatchObject({ accepted: true, score: 410, bestScore: 410 });
    const after = await currencies();
    body.summary.enemiesDestroyed!.shieldDrone = 99;
    expect((await post("/runs/finish", body).expect(201)).body).toEqual(first.body);
    expect(await currencies()).toEqual(after);
    expect((await get("/runs/history").expect(200)).body[0].result).toMatchObject({
      score: 410, summary: { enemiesDestroyed: { sentryTurret: 0, shieldDrone: 2 } },
    });
  });
  it("pins Mine Layer score, persists the count and replays without additional rewards", async () => {
    const body = input(await start(120_000));
    Object.assign(body, { durationMs: 110_000, rewardMultiplier: 1.45 });
    Object.assign(body.summary, { stageReached: 4, enemiesDestroyed: { sentryTurret: 0, mineLayer: 2 } });
    jest.spyOn(service, "getConfig").mockReturnValue({ ...RUN_CONFIG,
      enemyPoints: { ...SCORING_CONFIG.enemyPoints, mineLayer: 999 } });
    const first = await post("/runs/finish", body).expect(201);
    expect(first.body).toMatchObject({ accepted: true, score: 710, bestScore: 710 });
    const after = await currencies();
    body.summary.enemiesDestroyed!.mineLayer = 99;
    expect((await post("/runs/finish", body).expect(201)).body).toEqual(first.body);
    expect(await currencies()).toEqual(after);
    expect((await get("/runs/history").expect(200)).body[0].result).toMatchObject({
      score: 710, summary: { enemiesDestroyed: { sentryTurret: 0, mineLayer: 2 } },
    });
  });


  it("returns and pins the complete enemy config, using its exact stage for validation", async () => {
    const custom = { ...RUN_CONFIG, enemies: {
      ...SCORING_CONFIG.enemies,
      sentryTurret: { ...SCORING_CONFIG.enemies.sentryTurret, minStage: 1, firstSpawnDelayMs: 0,
        hp: 3, activeColor: 0x123456, bullet: { ...SCORING_CONFIG.enemies.sentryTurret.bullet, damage: 2 } },
      shieldDrone: { ...SCORING_CONFIG.enemies.shieldDrone, minStage: 1, spawnChance: 1, damageReduction: 0.5 },
    } };
    const deployed = jest.spyOn(service, "getConfig").mockReturnValue(custom);
    const response = await post("/runs/start", { weaponId: "basic_laser" }).expect(201);
    const { gameplay, ...customScoring } = custom;
    expect(response.body.snapshot.scoringConfig).toEqual(customScoring);
    expect(response.body.snapshot.gameplayConfig).toEqual(gameplay);
    expect(response.body.snapshot.scoringConfig).not.toHaveProperty("enemySpawnRules");
    const runId = response.body.runId;
    await prisma.run.update({ where: { id: runId }, data: { startedAt: new Date(Date.now() - 60000) } });
    deployed.mockReturnValue(RUN_CONFIG);
    const stored = await prisma.run.findUniqueOrThrow({ where: { id: runId } });
    expect((stored.snapshotJson as any).scoringConfig).toEqual(customScoring);
    const body = input(runId);
    body.summary.enemiesDestroyed = { sentryTurret: 1, shieldDrone: 1 };
    expect((await post("/runs/finish", body).expect(201)).body).toMatchObject({ accepted: true, score: 260, bestScore: 260 });
  });

});
