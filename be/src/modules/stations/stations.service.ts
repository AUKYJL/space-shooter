import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../infra/prisma/prisma.service";
import { type StationId } from "../../shared/ids";

const MAX_SLOTS = 3;

function slotUnlockCostCoins(nextSlotIndex: number) {
  if (nextSlotIndex <= 0) {
    return 0;
  }
  return 1000 * (nextSlotIndex + 1);
}

@Injectable()
export class StationsService {
  constructor(private readonly prisma: PrismaService) {}

  async getUnlocks(userId: string) {
    return await this.prisma.userStationUnlock.findMany({
      where: { userId },
      orderBy: { stationId: "asc" },
      select: { stationId: true },
    });
  }

  async unlockStation(userId: string, stationId: StationId) {
    const station = await this.prisma.stationCatalog.findUnique({
      where: { id: stationId },
      select: { id: true, unlockCostJson: true },
    });
    if (!station) {
      throw new NotFoundException("Station not found");
    }

    const cost = station.unlockCostJson as unknown as {
      coins?: number;
      donateCoins?: number;
      ore?: number;
      crystal?: number;
    };

    return await this.prisma.$transaction(async (tx) => {
      const already = await tx.userStationUnlock.findUnique({
        where: { userId_stationId: { userId, stationId } },
        select: { id: true },
      });
      if (already) {
        throw new BadRequestException("Station already unlocked");
      }

      const currencies = await tx.userCurrencies.findUnique({ where: { userId } });
      if (!currencies) {
        throw new NotFoundException("User currencies not found");
      }

      const coins = cost?.coins ?? 0;
      const donateCoins = cost?.donateCoins ?? 0;
      const ore = cost?.ore ?? 0;
      const crystal = cost?.crystal ?? 0;

      if (coins < 0 || donateCoins < 0 || ore < 0 || crystal < 0) {
        throw new BadRequestException("Invalid station unlock cost");
      }

      if (currencies.coins < coins) {
        throw new ForbiddenException("Not enough coins");
      }
      if (currencies.donateCoins < donateCoins) {
        throw new ForbiddenException("Not enough donateCoins");
      }
      if (currencies.ore < ore) {
        throw new ForbiddenException("Not enough ore");
      }
      if (currencies.crystal < crystal) {
        throw new ForbiddenException("Not enough crystal");
      }

      const hasAnyCost = coins > 0 || donateCoins > 0 || ore > 0 || crystal > 0;
      if (hasAnyCost) {
        await tx.userCurrencies.update({
          where: { userId },
          data: {
            ...(coins > 0 ? { coins: { decrement: coins } } : {}),
            ...(donateCoins > 0 ? { donateCoins: { decrement: donateCoins } } : {}),
            ...(ore > 0 ? { ore: { decrement: ore } } : {}),
            ...(crystal > 0 ? { crystal: { decrement: crystal } } : {}),
          },
        });
      }

      return await tx.userStationUnlock.create({ data: { userId, stationId } });
    });
  }

  async getCatalog() {
    return await this.prisma.stationCatalog.findMany({ orderBy: { id: "asc" } });
  }

  async getSlots(userId: string) {
    const slots = await this.prisma.userStationSlot.findMany({
      where: { userId },
      orderBy: { slotIndex: "asc" },
    });

    if (slots.length > 0) {
      return slots;
    }

    const created = await this.prisma.userStationSlot.create({ data: { userId, slotIndex: 0 } });
    return [created];
  }

  async unlockSlot(userId: string) {
    const existing = await this.prisma.userStationSlot.findMany({
      where: { userId },
      orderBy: { slotIndex: "desc" },
      take: 1,
      select: { slotIndex: true },
    });

    const nextSlotIndex = existing.length ? existing[0].slotIndex + 1 : 0;
    if (nextSlotIndex >= MAX_SLOTS) {
      throw new BadRequestException("Max slots reached");
    }

    const costCoins = slotUnlockCostCoins(nextSlotIndex);

    return await this.prisma.$transaction(async (tx) => {
      const currencies = await tx.userCurrencies.findUnique({ where: { userId }, select: { coins: true } });
      if (!currencies) {
        throw new NotFoundException("User currencies not found");
      }
      if (currencies.coins < costCoins) {
        throw new ForbiddenException("Not enough coins");
      }

      if (costCoins > 0) {
        await tx.userCurrencies.update({ where: { userId }, data: { coins: { decrement: costCoins } } });
      }

      return await tx.userStationSlot.create({ data: { userId, slotIndex: nextSlotIndex } });
    });
  }

  async assignStation(userId: string, slotId: string, stationId: StationId) {
    const slot = await this.prisma.userStationSlot.findFirst({ where: { id: slotId, userId } });
    if (!slot) {
      throw new NotFoundException("Slot not found");
    }

    const unlocked = await this.prisma.userStationUnlock.findUnique({
      where: { userId_stationId: { userId, stationId } },
      select: { id: true },
    });
    if (!unlocked) {
      throw new ForbiddenException("Station not unlocked");
    }

    const alreadyAssigned = await this.prisma.userStationSlot.findFirst({
      where: { userId, assignedStationId: stationId, NOT: { id: slotId } },
      select: { id: true },
    });
    if (alreadyAssigned) {
      throw new BadRequestException("Station already assigned");
    }

    return await this.prisma.userStationSlot.update({
      where: { id: slotId },
      data: { assignedStationId: stationId, startedAt: null, endsAt: null, lastCollectedAt: slot.lastCollectedAt ?? null },
    });
  }

  async startCycle(userId: string, slotId: string) {
    const slot = await this.prisma.userStationSlot.findFirst({ where: { id: slotId, userId } });
    if (!slot) {
      throw new NotFoundException("Slot not found");
    }
    if (!slot.assignedStationId) {
      throw new BadRequestException("Station not assigned");
    }

    const station = await this.prisma.stationCatalog.findUnique({
      where: { id: slot.assignedStationId },
      select: { cycleDurationHours: true },
    });
    if (!station) {
      throw new NotFoundException("Station not found");
    }

    const startedAt = new Date();
    const endsAt = new Date(startedAt.getTime() + station.cycleDurationHours * 60 * 60 * 1000);

    return await this.prisma.userStationSlot.update({
      where: { id: slotId },
      data: { startedAt, endsAt },
    });
  }

  async collect(userId: string, slotId: string) {
    const slot = await this.prisma.userStationSlot.findFirst({ where: { id: slotId, userId } });
    if (!slot) {
      throw new NotFoundException("Slot not found");
    }
    if (!slot.assignedStationId) {
      throw new BadRequestException("Station not assigned");
    }
    if (!slot.endsAt || !slot.startedAt) {
      throw new BadRequestException("Cycle not started");
    }
    const now = new Date();
    if (now.getTime() < slot.endsAt.getTime()) {
      throw new BadRequestException("Cycle not finished");
    }

    const station = await this.prisma.stationCatalog.findUnique({
      where: { id: slot.assignedStationId },
      select: { resourceType: true, baseAmountPerCycle: true },
    });
    if (!station) {
      throw new NotFoundException("Station not found");
    }

    const granted = { resourceType: station.resourceType, amount: station.baseAmountPerCycle };

    await this.prisma.$transaction(async (tx) => {
      if (station.resourceType === "coins") {
        await tx.userCurrencies.update({ where: { userId }, data: { coins: { increment: station.baseAmountPerCycle } } });
      } else if (station.resourceType === "ore") {
        await tx.userCurrencies.update({ where: { userId }, data: { ore: { increment: station.baseAmountPerCycle } } });
      } else if (station.resourceType === "crystal") {
        await tx.userCurrencies.update({
          where: { userId },
          data: { crystal: { increment: station.baseAmountPerCycle } },
        });
      } else {
        throw new BadRequestException("Unsupported station resourceType");
      }

      await tx.userStationSlot.update({
        where: { id: slotId },
        data: { lastCollectedAt: now, startedAt: null, endsAt: null },
      });
    });

    return { granted };
  }
}
