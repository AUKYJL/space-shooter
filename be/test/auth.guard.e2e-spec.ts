import * as request from "supertest";
import { Test } from "@nestjs/testing";
import { INestApplication } from "@nestjs/common";
import { JwtService as NestJwtService } from "@nestjs/jwt";
import { AppModule } from "../src/app.module";
import { PrismaService } from "../src/infra/prisma/prisma.service";
import { JwtService } from "../src/infra/jwt/jwt.service";
import { UsersService } from "../src/modules/users/users.service";

describe("auth", () => {
  let app: INestApplication;
  let jwt: JwtService;
  const findUnique = jest.fn();
  const getProfile = jest.fn();
  beforeAll(async () => {
    process.env.DATABASE_URL ??= "postgresql://user:pass@localhost:5432/db?schema=public";
    process.env.JWT_SECRET ??= "test-secret";

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService).useValue({ user: { findUnique } })
      .overrideProvider(UsersService).useValue({ getProfile })
      .compile();
    app = moduleRef.createNestApplication();
    app.useLogger(false);
    await app.init();
    jwt = app.get(JwtService);
  });
  afterAll(async () => app.close());
  beforeEach(() => {
    findUnique.mockReset();
    getProfile.mockReset();
  });

  it("GET /me requires auth", async () => {
    await request(app.getHttpServer()).get("/me").expect(401);
    expect(findUnique).not.toHaveBeenCalled();
  });

  it("rejects invalid, expired and refresh tokens before querying the user", async () => {
    const expired = new NestJwtService().sign({ sub: "user", type: "access", exp: 1 }, {
      secret: process.env.JWT_SECRET,
    });
    const refresh = jwt.signRefreshToken("user", "session", new Date(Date.now() + 60_000));
    for (const token of ["invalid", expired, refresh]) {
      await request(app.getHttpServer()).get("/me").set("Authorization", `Bearer ${token}`).expect(401);
    }
    expect(findUnique).not.toHaveBeenCalled();
    expect(getProfile).not.toHaveBeenCalled();
  });

  it("rejects a valid token for a missing user before calling the controller", async () => {
    findUnique.mockResolvedValue(null);
    await request(app.getHttpServer()).get("/me")
      .set("Authorization", `Bearer ${jwt.signUserToken("deleted-user")}`).expect(401);
    expect(findUnique).toHaveBeenCalledWith({ where: { id: "deleted-user" }, select: { id: true } });
    expect(getProfile).not.toHaveBeenCalled();
  });

  it("passes the existing user to the controller", async () => {
    findUnique.mockResolvedValue({ id: "user" });
    getProfile.mockResolvedValue({ id: "user", username: "test" });
    await request(app.getHttpServer()).get("/me")
      .set("Authorization", `Bearer ${jwt.signUserToken("user")}`).expect(200, { id: "user", username: "test" });
    expect(getProfile).toHaveBeenCalledWith("user");
  });

  it("allows public endpoints without checking JWT or the database", async () => {
    await request(app.getHttpServer()).get("/health").expect(200);
    await request(app.getHttpServer()).get("/health").set("Authorization", "Bearer invalid").expect(200);
    expect(findUnique).not.toHaveBeenCalled();
  });

  it("keeps database failures as server errors", async () => {
    findUnique.mockRejectedValue(new Error("Database unavailable"));
    await request(app.getHttpServer()).get("/me")
      .set("Authorization", `Bearer ${jwt.signUserToken("user")}`).expect(500);
    expect(getProfile).not.toHaveBeenCalled();
  });
});

