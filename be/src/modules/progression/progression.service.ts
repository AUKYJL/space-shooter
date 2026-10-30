import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../infra/prisma/prisma.service";
import { type UpgradeId } from "../../common/ids";

@Injectable()
export class ProgressionService {
  constructor(private readonly prisma: PrismaService) {}

  async getProgression(userId: string) {
    const loadout = await this.prisma.userLoadout.findUnique({
      where: { userId },
      select: { selectedWeaponId: true },
    });
    if (!loadout) {
      throw new NotFoundException("Loadout not found");
    }

    const ownedWeaponIds = await this.prisma.userWeapon
      .findMany({ where: { userId, unlocked: true }, select: { weaponId: true } })
      .then((rows) => rows.map((r) => r.weaponId));

    const upgrades = await this.prisma.userUpgrade
      .findMany({ where: { userId }, select: { upgradeId: true }, orderBy: { purchasedAt: "asc" } })
      .then((rows) => rows.map((r) => r.upgradeId));

    return {
      loadout,
      ownedWeaponIds,
      upgrades,
    };
  }

  async getUpgrades(userId: string) {
    const [catalog, owned] = await Promise.all([
      this.prisma.upgradeCatalog.findMany({ orderBy: { id: "asc" } }),
      this.prisma.userUpgrade.findMany({ where: { userId }, select: { upgradeId: true, purchasedAt: true } }),
    ]);

    const byId = new Map(owned.map((u) => [u.upgradeId, u]));
    return catalog.map((u) => ({
      ...u,
      purchasedAt: byId.get(u.id)?.purchasedAt ?? null,
      purchased: byId.has(u.id),
    }));
  }

  async buyUpgrade(userId: string, upgradeId: UpgradeId) {
    const upgrade = await this.prisma.upgradeCatalog.findUnique({ where: { id: upgradeId } });
    if (!upgrade) {
      throw new NotFoundException("Upgrade not found");
    }

    return await this.prisma.$transaction(async (tx) => {
      const already = await tx.userUpgrade.findUnique({
        where: { userId_upgradeId: { userId, upgradeId } },
        select: { id: true },
      });
      if (already) {
        throw new BadRequestException("Upgrade already purchased");
      }

      const currencies = await tx.userCurrencies.findUnique({ where: { userId } });
      if (!currencies) {
        throw new NotFoundException("User currencies not found");
      }
      if (currencies.coins < upgrade.costCoins) {
        throw new ForbiddenException("Not enough coins");
      }

      if (upgrade.costCoins > 0) {
        await tx.userCurrencies.update({ where: { userId }, data: { coins: { decrement: upgrade.costCoins } } });
      }

      await tx.userUpgrade.create({ data: { userId, upgradeId } });

      return { ok: true };
    });
  }
}
