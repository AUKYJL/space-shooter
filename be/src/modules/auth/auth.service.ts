import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../infra/prisma/prisma.service";
import { JwtService } from "../../infra/jwt/jwt.service";
import { WEAPON_ID } from "../../common/ids";

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  async loginDev(username: string): Promise<{ accessToken: string }> {
    const existing = await this.prisma.user.findFirst({ where: { username } });
    const user =
      existing ?? (await this.prisma.user.create({ data: { username } }));

    const basicWeaponId = WEAPON_ID.BASIC_LASER;

    await this.prisma.weaponCatalog.upsert({
      where: { id: basicWeaponId },
      create: {
        id: basicWeaponId,
        name: "Basic Laser",
        type: "laser",
        baseDamage: 1,
        baseFireRate: 1,
        projectileSpeed: 900,
        unlockedByDefault: true,
      },
      update: {},
    });

    await this.prisma.userCurrencies.upsert({
      where: { userId: user.id },
      create: { userId: user.id },
      update: {},
    });

    await this.prisma.userWeapon.upsert({
      where: { userId_weaponId: { userId: user.id, weaponId: basicWeaponId } },
      create: { userId: user.id, weaponId: basicWeaponId, unlocked: true },
      update: { unlocked: true },
    });

    await this.prisma.userLoadout.upsert({
      where: { userId: user.id },
      create: { userId: user.id, selectedWeaponId: basicWeaponId },
      update: {},
    });

    return { accessToken: this.jwt.signUserToken(user.id) };
  }
}
