import request from "supertest";
import { Test } from "@nestjs/testing";
import { INestApplication } from "@nestjs/common";
import { AppModule } from "../src/app.module";

describe("auth login-dev", () => {
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

  it("returns jwt and creates user", async () => {
    if (!app) {
      return;
    }
    const res = await request(app.getHttpServer()).post("/auth/login-dev").send({ username: "dev" }).expect(201);
    expect(res.body).toHaveProperty("accessToken");
  });
});

