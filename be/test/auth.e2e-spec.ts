import * as request from "supertest";
import { randomUUID } from "node:crypto";
import { Test } from "@nestjs/testing";
import { INestApplication } from "@nestjs/common";
import { AppModule } from "../src/app.module";
import { PrismaService } from "../src/infra/prisma/prisma.service";
import { JwtService } from "../src/infra/jwt/jwt.service";

const describeWithDb = process.env.DATABASE_URL ? describe : describe.skip;

describeWithDb("username/password auth", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let failSession = false;
  const prefix = `auth-${randomUUID()}-`;
  const credentials = () => ({ username: `${prefix}${randomUUID()}`, password: "x" });
  const cookie = (res: request.Response): string => res.headers["set-cookie"][0].split(";")[0];
  const register = (body = credentials()) => request(app.getHttpServer()).post("/auth/register").send(body);

  beforeAll(async () => {
    process.env.JWT_SECRET ??= "test-secret";
    process.env.PRISMA_CONNECT = "1";
    const module = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = module.createNestApplication();
    app.enableCors({ origin: "http://localhost:5173", credentials: true });
    await app.init();
    prisma = app.get(PrismaService);
    prisma.$use(async (params, next) => {
      if (failSession && params.model === "RefreshSession" && params.action === "create") {
        throw new Error("Simulated session write failure");
      }
      return next(params);
    });
  });
  afterAll(async () => {
    await prisma?.user.deleteMany({ where: { username: { startsWith: prefix } } });
    await app?.close();
  });

  it("registers with a short password and creates starter resources", async () => {
    const body = credentials();
    const res = await register({ ...body, username: ` ${body.username.toUpperCase()} ` }).expect(201);
    expect(Object.keys(res.body)).toEqual(["accessToken"]);
    expect(res.headers["set-cookie"][0]).toMatch(/Path=\/refresh/);
    expect(res.headers["set-cookie"][0]).toMatch(/HttpOnly/);
    expect(res.headers["set-cookie"][0]).toMatch(/SameSite=Lax/);
    const user = await prisma.user.findUniqueOrThrow({
      where: { username: body.username }, include: { currencies: true, loadout: true, weapons: true, refreshSessions: true },
    });
    expect(user.passwordHash).toMatch(/^scrypt:/);
    expect(user.currencies?.coins).toBe(0);
    expect(user.loadout?.selectedWeaponId).toBe("basic_laser");
    expect(user.weapons).toEqual(expect.arrayContaining([expect.objectContaining({ weaponId: "basic_laser", unlocked: true })]));
    expect(user.refreshSessions[0].tokenHash).not.toContain(cookie(res).split("=")[1]);
    await request(app.getHttpServer()).get("/me").set("Authorization", `Bearer ${res.body.accessToken}`).expect(200);
  });

  it("rejects access and refresh tokens after the user is deleted", async () => {
    const res = await register().expect(201);
    const userId = app.get(JwtService).verify(res.body.accessToken).sub;
    await prisma.user.delete({ where: { id: userId } });

    await request(app.getHttpServer()).get("/me")
      .set("Authorization", `Bearer ${res.body.accessToken}`).expect(401);
    const failed = await request(app.getHttpServer()).post("/refresh")
      .set("Cookie", cookie(res)).expect(401);
    expect(failed.headers["set-cookie"][0]).toMatch(/Expires=Thu, 01 Jan 1970/);
  });

  it("rejects duplicate normalized usernames and invalid input", async () => {
    const body = credentials();
    await register(body).expect(201);
    await register({ ...body, username: ` ${body.username.toUpperCase()} ` }).expect(409);
    for (const invalid of [{ username: " ", password: "x" }, { username: "a", password: "" },
      { username: 1, password: "x" }, { username: "a" }, { ...body, telegramId: "123" }]) {
      await request(app.getHttpServer()).post("/auth/register").send(invalid).expect(400);
    }
  });

  it("logs in without resetting progress and preserves password whitespace/case", async () => {
    const body = { ...credentials(), password: " X " };
    const res = await register(body).expect(201);
    const userId = app.get(JwtService).verify(res.body.accessToken).sub;
    await prisma.userCurrencies.update({ where: { userId }, data: { coins: 42 } });
    await request(app.getHttpServer()).post("/auth/login").send({ ...body, username: body.username.toUpperCase() }).expect(200);
    expect((await prisma.userCurrencies.findUniqueOrThrow({ where: { userId } })).coins).toBe(42);
    for (const invalid of [{ ...body, password: "X" }, { ...body, password: " x " }, { ...body, username: `${body.username}-missing` }]) {
      const failure = await request(app.getHttpServer()).post("/auth/login").send(invalid).expect(401);
      expect(failure.body.message).toBe("Invalid username or password");
    }
    expect(await prisma.refreshSession.count({ where: { userId } })).toBe(2);
  });

  it("rotates refresh with fixed expiry, rejects replay and rejects refresh as Bearer", async () => {
    const res = await register().expect(201);
    const oldCookie = cookie(res);
    const jwt = app.get(JwtService);
    const oldPayload = jwt.verifyRefresh(oldCookie.split("=")[1]);
    await request(app.getHttpServer()).get("/me").set("Authorization", `Bearer ${oldCookie.split("=")[1]}`).expect(401);
    const refreshed = await request(app.getHttpServer()).post("/refresh").set("Cookie", oldCookie).expect(200);
    expect(cookie(refreshed)).not.toBe(oldCookie);
    expect(jwt.verifyRefresh(cookie(refreshed).split("=")[1]).exp).toBe(oldPayload.exp);
    expect(jwt.verify(refreshed.body.accessToken).sub).toBe(oldPayload.sub);
    await request(app.getHttpServer()).post("/refresh").set("Cookie", oldCookie).expect(401);
    await request(app.getHttpServer()).post("/refresh").set("Cookie", cookie(refreshed)).expect(200);
  });

  it("accepts only one concurrent rotation of the same token", async () => {
    const res = await register().expect(201);
    const replies = await Promise.all([1, 2].map(() => request(app.getHttpServer()).post("/refresh").set("Cookie", cookie(res))));
    expect(replies.map((reply) => reply.status).sort()).toEqual([200, 401]);
  });

  it("clears invalid cookies and rejects access, expired and missing refresh tokens", async () => {
    const res = await register().expect(201);
    const payload = app.get(JwtService).verifyRefresh(cookie(res).split("=")[1]);
    const expired = app.get(JwtService).signRefreshToken(payload.sub, payload.sid, new Date(1000));
    for (const value of ["", "refreshToken=bad", `refreshToken=${res.body.accessToken}`, `refreshToken=${expired}`]) {
      const failed = await request(app.getHttpServer()).post("/refresh").set("Cookie", value).expect(401);
      expect(failed.headers["set-cookie"][0]).toMatch(/Path=\/refresh/);
      expect(failed.headers["set-cookie"][0]).toMatch(/Expires=Thu, 01 Jan 1970/);
    }
    await prisma.refreshSession.update({ where: { id: payload.sid }, data: { expiresAt: new Date(1000) } });
    await request(app.getHttpServer()).post("/refresh").set("Cookie", cookie(res)).expect(401);
  });

  it("rolls back registration if creating the session fails", async () => {
    const body = credentials();
    failSession = true;
    try { await register(body).expect(500); } finally { failSession = false; }
    expect(await prisma.user.findUnique({ where: { username: body.username } })).toBeNull();
  });

  it("sets production Secure cookies and explicit credentialed CORS", async () => {
    const previous = process.env.NODE_ENV;
    process.env.NODE_ENV = "production";
    try {
      const res = await register().set("Origin", "http://localhost:5173").expect(201);
      expect(res.headers["set-cookie"][0]).toMatch(/; Secure/);
      expect(res.headers["access-control-allow-origin"]).toBe("http://localhost:5173");
      expect(res.headers["access-control-allow-credentials"]).toBe("true");
    } finally { process.env.NODE_ENV = previous; }
  });
});
