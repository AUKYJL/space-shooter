import { Injectable } from "@nestjs/common";
import { JwtService as NestJwtService } from "@nestjs/jwt";
import { randomUUID } from "node:crypto";
import { env } from "../config/env";

export const ACCESS_TTL_SECONDS = 15 * 60;
export const REFRESH_TTL_SECONDS = 30 * 24 * 60 * 60;

type JwtPayload = { sub: string; type: "access" | "refresh"; exp: number };
export type RefreshPayload = JwtPayload & { sid: string; jti: string };

@Injectable()
export class JwtService {
  private readonly jwt = new NestJwtService();

  signUserToken(userId: string): string {
    return this.jwt.sign({ sub: userId, type: "access" }, {
      secret: env(process.env).JWT_SECRET,
      algorithm: "HS256",
      expiresIn: ACCESS_TTL_SECONDS,
    });
  }

  signRefreshToken(userId: string, sessionId: string, expiresAt: Date): string {
    return this.jwt.sign({
      sub: userId, sid: sessionId, jti: randomUUID(), type: "refresh",
      exp: Math.floor(expiresAt.getTime() / 1000),
    }, { secret: env(process.env).JWT_SECRET, algorithm: "HS256" });
  }

  verify(token: string): JwtPayload {
    return this.verifyType(token, "access");
  }

  verifyRefresh(token: string): RefreshPayload {
    const payload = this.verifyType(token, "refresh") as RefreshPayload;
    if (typeof payload.sid !== "string" || !payload.sid || typeof payload.jti !== "string" || !payload.jti) {
      throw new Error("Invalid refresh payload");
    }
    return payload;
  }

  private verifyType(token: string, type: JwtPayload["type"]): JwtPayload {
    const payload = this.jwt.verify<JwtPayload>(token, {
      secret: env(process.env).JWT_SECRET, algorithms: ["HS256"],
    });
    if (payload.type !== type || typeof payload.sub !== "string" || !payload.sub ||
        !Number.isFinite(payload.exp)) {
      throw new Error("Invalid token payload");
    }
    return payload;
  }
}
