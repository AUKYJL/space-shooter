import * as request from "supertest";
import { Test } from "@nestjs/testing";
import { INestApplication } from "@nestjs/common";
import { AppModule } from "../src/app.module";

import { registerTestUser as login } from "./helpers/auth";

describe("me endpoints", () => {
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

  it("returns profile", async () => {
    if (!app) {
      return;
    }
    const token = await login(app);
    const res = await request(app.getHttpServer()).get("/me").set("Authorization", `Bearer ${token}`).expect(200);
    expect(res.body).toHaveProperty("id");
    expect(res.body).toHaveProperty("username");
  });

  it("returns currencies", async () => {
    if (!app) {
      return;
    }
    const token = await login(app);
    const res = await request(app.getHttpServer())
      .get("/me/currencies")
      .set("Authorization", `Bearer ${token}`)
      .expect(200);
    expect(res.body).toHaveProperty("coins");
    expect(res.body).toHaveProperty("ore");
  });

  it("returns progression", async () => {
    if (!app) {
      return;
    }
    const token = await login(app);
    const res = await request(app.getHttpServer())
      .get("/me/progression")
      .set("Authorization", `Bearer ${token}`)
      .expect(200);
    expect(res.body).toHaveProperty("loadout");
    expect(res.body).toHaveProperty("ownedWeaponIds");
  });
});

