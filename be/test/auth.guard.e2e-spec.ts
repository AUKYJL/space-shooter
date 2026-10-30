import * as request from "supertest";
import { Test } from "@nestjs/testing";
import { INestApplication } from "@nestjs/common";
import { AppModule } from "../src/app.module";

describe("auth", () => {
  let app: INestApplication;
  beforeAll(async () => {
    process.env.DATABASE_URL ??= "postgresql://user:pass@localhost:5432/db?schema=public";
    process.env.JWT_SECRET ??= "test-secret";

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
  });
  afterAll(async () => app.close());

  it("GET /me requires auth", async () => {
    await request(app.getHttpServer()).get("/me").expect(401);
  });
});

