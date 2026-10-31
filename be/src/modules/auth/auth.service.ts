import { getCatalogWeapon } from "../../shared/game-config/weaponsConfig";
import { ConflictException, Injectable, UnauthorizedException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { createHash, randomUUID } from "node:crypto";
import { PrismaService } from "../../infra/prisma/prisma.service";
import { JwtService, REFRESH_TTL_SECONDS } from "../../infra/jwt/jwt.service";
import type { RefreshPayload } from "../../infra/jwt/jwt.service";
import { WEAPON_ID } from "../../shared/ids";
import { hashPassword, verifyPassword } from "./password";
import { CredentialsDto } from "./dto/credentials.dto";

const tokenHash = (token: string) => createHash("sha256").update(token).digest("hex");

@Injectable()
export class AuthService {
  constructor(private readonly prisma: PrismaService, private readonly jwt: JwtService) {}

  async register({ username, password }: CredentialsDto) {
    const passwordHash = await hashPassword(password);
    try {
      return await this.prisma.$transaction(async (tx) => {
        const basicWeaponId = WEAPON_ID.BASIC_LASER;
        await tx.weaponCatalog.upsert({
          where: { id: basicWeaponId },
          create: getCatalogWeapon(basicWeaponId),
          update: {},
        });
        const user = await tx.user.create({ data: {
          username, passwordHash,
          currencies: { create: {} },
          weapons: { create: { weaponId: basicWeaponId, unlocked: true } },
          loadout: { create: { selectedWeaponId: basicWeaponId } },
        } });
        return this.createSession(tx, user.id);
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        throw new ConflictException("Username already taken");
      }
      throw error;
    }
  }

  async login({ username, password }: CredentialsDto) {
    const user = await this.prisma.user.findUnique({ where: { username } });
    if (!user || !await verifyPassword(password, user.passwordHash)) {
      throw new UnauthorizedException("Invalid username or password");
    }
    return this.createSession(this.prisma, user.id);
  }

  async refresh(token: string | undefined) {
    if (!token) throw new UnauthorizedException();
    let payload: RefreshPayload;
    try {
      payload = this.jwt.verifyRefresh(token);
    } catch {
      throw new UnauthorizedException();
    }
    const expiresAt = new Date(payload.exp * 1000);
    const refreshToken = this.jwt.signRefreshToken(payload.sub, payload.sid, expiresAt);
    const result = await this.prisma.refreshSession.updateMany({
      where: {
        id: payload.sid, userId: payload.sub, tokenHash: tokenHash(token), expiresAt: { gt: new Date() },
      },
      data: { tokenHash: tokenHash(refreshToken) },
    });
    if (result.count !== 1) throw new UnauthorizedException();
    return { accessToken: this.jwt.signUserToken(payload.sub), refreshToken, expiresAt };
  }

  private async createSession(tx: Prisma.TransactionClient, userId: string) {
    const id = randomUUID();
    const expiresAt = new Date((Math.floor(Date.now() / 1000) + REFRESH_TTL_SECONDS) * 1000);
    const refreshToken = this.jwt.signRefreshToken(userId, id, expiresAt);
    await tx.refreshSession.create({ data: { id, userId, tokenHash: tokenHash(refreshToken), expiresAt } });
    return { accessToken: this.jwt.signUserToken(userId), refreshToken, expiresAt };
  }
}
