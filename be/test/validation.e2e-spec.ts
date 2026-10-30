import * as request from "supertest";
import { Test } from "@nestjs/testing";
import { INestApplication } from "@nestjs/common";
import { AppModule } from "../src/app.module";
import { JwtService } from "../src/infra/jwt/jwt.service";

describe("validation", () => {
  let app: INestApplication;
  let token: string;

  beforeAll(async () => {
    process.env.DATABASE_URL ??= "postgresql://user:pass@localhost:5432/db?schema=public";
    process.env.JWT_SECRET ??= "test-secret";

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
    token = app.get(JwtService).signUserToken("test-user");
  });

  afterAll(async () => {
    await app.close();
  });

  it("rejects invalid body with 400", async () => {
    await request(app.getHttpServer())
      .patch("/loadout/weapon")
      .set("Authorization", `Bearer ${token}`)
      .send({})
      .expect(400);
  });
});
