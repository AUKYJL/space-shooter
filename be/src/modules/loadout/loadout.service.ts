import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../infra/prisma/prisma.service";
import { WEAPON_ID, type WeaponId } from "../../shared/ids";

@Injectable()
export class LoadoutService {
  constructor(private readonly prisma: PrismaService) {}

  async getLoadout(userId: string) {
    const existing = await this.prisma.userLoadout.findUnique({ where: { userId } });
    if (existing) {
      return existing;
    }

    const fallbackWeapon = await this.prisma.userWeapon.findFirst({
      where: { userId, unlocked: true },
      select: { weaponId: true },
      orderBy: { weaponId: "asc" },
    });
    const selectedWeaponId = (fallbackWeapon?.weaponId ?? WEAPON_ID.BASIC_LASER) as WeaponId;

    try {
      return await this.prisma.userLoadout.create({ data: { userId, selectedWeaponId } });
    } catch {
      throw new NotFoundException("User not found");
    }
  }

  async setSelectedWeapon(userId: string, weaponId: WeaponId) {
    const owned = await this.prisma.userWeapon.findUnique({
      where: { userId_weaponId: { userId, weaponId } },
      select: { unlocked: true },
    });
    if (!owned) {
      throw new BadRequestException("Weapon not found for user");
    }
    if (!owned.unlocked) {
      throw new ForbiddenException("Weapon not unlocked");
    }

    const loadout = await this.prisma.userLoadout.upsert({
      where: { userId },
      create: { userId, selectedWeaponId: weaponId },
      update: { selectedWeaponId: weaponId },
    });
    return loadout;
  }
}
