import request from "supertest";
import { Test } from "@nestjs/testing";
import { INestApplication } from "@nestjs/common";
import { AppModule } from "../src/app.module";

async function login(app: INestApplication) {
  const res = await request(app.getHttpServer()).post("/auth/login-dev").send({ username: "dev" });
  return res.body.accessToken as string;
}

describe("runs", () => {
  let app: INestApplication | undefined;

  beforeAll(async () => {
    if (!process.env.DATABASE_URL) {
      return;
    }
    process.env.JWT_SECRET ??= "test-secret";
    process.env.PRISMA_CONNECT = "1";

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app?.close();
  });

  it("start returns runId + snapshot", async () => {
    if (!app) {
      return;
    }
    const token = await login(app);
    const res = await request(app.getHttpServer())
      .post("/runs/start")
      .set("Authorization", `Bearer ${token}`)
      .send({ weaponId: "basic_laser" })
      .expect(201);
    expect(res.body).toHaveProperty("runId");
    expect(res.body).toHaveProperty("seed");
    expect(res.body).toHaveProperty("snapshot");
  });

  it("finish grants rewards and updates currencies", async () => {
    if (!app) {
      return;
    }
    const token = await login(app);
    const start = await request(app.getHttpServer())
      .post("/runs/start")
      .set("Authorization", `Bearer ${token}`)
      .send({ weaponId: "basic_laser" });

    const runId = start.body.runId as string;
    const finish = await request(app.getHttpServer())
      .post("/runs/finish")
      .set("Authorization", `Bearer ${token}`)
      .send({
        runId,
        durationMs: 60_000,
        endedBy: "death",
        extractionCount: 0,
        rewardMultiplier: 1.0,
        summary: { asteroidsDestroyed: 1, coinsCollected: 10, resourcesCollected: { ore: 0, crystal: 0 } },
      })
      .expect(201);

    expect(finish.body).toHaveProperty("accepted", true);
    expect(finish.body).toHaveProperty("grantedRewards");
  });
});

