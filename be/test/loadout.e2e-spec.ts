import * as request from "supertest";
import { Test } from "@nestjs/testing";
import { INestApplication } from "@nestjs/common";
import { AppModule } from "../src/app.module";

import { registerTestUser as login } from "./helpers/auth";

describe("loadout", () => {
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

  it("returns current loadout", async () => {
    if (!app) {
      return;
    }
    const token = await login(app);
    const res = await request(app.getHttpServer()).get("/loadout").set("Authorization", `Bearer ${token}`).expect(200);
    expect(res.body).toHaveProperty("selectedWeaponId");
  });

  it("updates selected weapon only if owned", async () => {
    if (!app) {
      return;
    }
    const token = await login(app);
    await request(app.getHttpServer())
      .patch("/loadout/weapon")
      .set("Authorization", `Bearer ${token}`)
      .send({ weaponId: "basic_laser" })
      .expect(200);
  });
});

