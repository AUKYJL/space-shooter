import { JwtService as NestJwtService } from "@nestjs/jwt";
import { JwtService, ACCESS_TTL_SECONDS } from "./jwt.service";

describe("JWT tokens", () => {
  const jwt = new JwtService();
  const rawJwt = new NestJwtService();
  beforeAll(() => {
    process.env.JWT_SECRET = "jwt-test-secret";
    process.env.DATABASE_URL ??= "postgresql://unused/unused";
  });

  it("issues access with an expiration and rejects refresh as access", () => {
    const access = jwt.signUserToken("user");
    const payload = rawJwt.decode(access);
    expect(payload.exp - payload.iat).toBe(ACCESS_TTL_SECONDS);
    expect(jwt.verify(access).sub).toBe("user");
    const refresh = jwt.signRefreshToken("user", "session", new Date(Date.now() + 60_000));
    expect(jwt.verifyRefresh(refresh).sid).toBe("session");
    expect(() => jwt.verify(refresh)).toThrow();
    expect(() => jwt.verifyRefresh(access)).toThrow();
  });

  it("rejects expired, legacy, wrongly signed and malformed payloads", () => {
    const sign = (body: object) => rawJwt.sign(body, { secret: process.env.JWT_SECRET });
    expect(() => jwt.verify(sign({ sub: "user", type: "access", exp: 1 }))).toThrow();
    expect(() => jwt.verify(sign({ sub: "user" }))).toThrow();
    expect(() => jwt.verify(sign({ sub: "user", type: "access" }))).toThrow();
    expect(() => jwt.verify(rawJwt.sign({ sub: "user", type: "access" }, { secret: "wrong" }))).toThrow();
    expect(() => jwt.verifyRefresh(sign({ sub: "user", type: "refresh", exp: 9999999999 }))).toThrow();
  });
});
