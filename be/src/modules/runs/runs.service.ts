import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { randomInt } from "crypto";
import { PrismaService } from "../../infra/prisma/prisma.service";
import { type WeaponId } from "../../common/ids";
import { type JsonValue } from "@prisma/client/runtime/library";

type RunSnapshot = {
  weaponId: WeaponId;
  damage: number;
  fireRate: number;
  maxHp: number;
};

type GrantedRewards = {
  coins: number;
  resources: {
    ore: number;
    crystal: number;
  };
};

const COINS_CAP = 10_000;
const ORE_CAP = 1_000;
const CRYSTAL_CAP = 1_000;

@Injectable()
export class RunsService {
  constructor(private readonly prisma: PrismaService) {}

  async startRun(userId: string, weaponId: WeaponId) {
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

    const weapon = await this.prisma.weaponCatalog.findUnique({
      where: { id: weaponId },
      select: { baseDamage: true, baseFireRate: true },
    });
    if (!weapon) {
      throw new NotFoundException("Weapon not found");
    }

    const ownedUpgrades = await this.prisma.userUpgrade.findMany({
      where: { userId },
      select: { upgradeId: true },
    });
    const ownedUpgradeIds = ownedUpgrades.map((u) => u.upgradeId);

    const ownedCatalog = ownedUpgradeIds.length
      ? await this.prisma.upgradeCatalog.findMany({
          where: { id: { in: ownedUpgradeIds } },
          select: { effectJson: true },
        })
      : [];

    const bonus = sumUpgradeEffects(ownedCatalog.map((u) => u.effectJson));

    const seed = randomInt(1, 1_000_000_000);
    const snapshot: RunSnapshot = {
      weaponId,
      damage: weapon.baseDamage + bonus.damage,
      fireRate: weapon.baseFireRate + bonus.fireRate,
      maxHp: 5 + bonus.maxHp,
    };

    const run = await this.prisma.run.create({
      data: {
        userId,
        seed,
        weaponId,
        snapshotJson: snapshot,
        status: "started",
      },
      select: { id: true },
    });

    return { runId: run.id, seed, snapshot };
  }

  async finishRun(
    userId: string,
    input: {
      runId: string;
      durationMs: number;
      endedBy: string;
      extractionCount: number;
      rewardMultiplier: number;
      summary: any;
    },
  ) {
    if (input.durationMs < 1_000 || input.durationMs > 3 * 60 * 60 * 1000) {
      throw new BadRequestException("durationMs out of range");
    }

    const run = await this.prisma.run.findFirst({
      where: { id: input.runId, userId },
      select: { id: true, status: true, finishedAt: true },
    });
    if (!run) {
      throw new NotFoundException("Run not found");
    }
    if (run.status !== "started" || run.finishedAt) {
      throw new BadRequestException("Run already finished");
    }

    const summary = input.summary ?? {};
    const multiplier = Number.isFinite(input.rewardMultiplier)
      ? input.rewardMultiplier
      : 1;

    const coinsCollected =
      typeof summary.coinsCollected === "number" ? summary.coinsCollected : 0;
    const oreCollected =
      typeof summary.resourcesCollected?.ore === "number"
        ? summary.resourcesCollected.ore
        : 0;
    const crystalCollected =
      typeof summary.resourcesCollected?.crystal === "number"
        ? summary.resourcesCollected.crystal
        : 0;

    const grantedRewards: GrantedRewards = {
      coins: Math.max(
        0,
        Math.min(Math.floor(coinsCollected * multiplier), COINS_CAP),
      ),
      resources: {
        ore: Math.max(
          0,
          Math.min(Math.floor(oreCollected * multiplier), ORE_CAP),
        ),
        crystal: Math.max(
          0,
          Math.min(Math.floor(crystalCollected * multiplier), CRYSTAL_CAP),
        ),
      },
    };

    const accepted = true;

    await this.prisma.$transaction(async (tx) => {
      await tx.run.update({
        where: { id: run.id },
        data: {
          finishedAt: new Date(),
          endedBy: input.endedBy,
          extractionCount: input.extractionCount,
          rewardMultiplier: input.rewardMultiplier,
          status: "finished",
        },
      });

      await tx.runResult.create({
        data: {
          runId: run.id,
          summaryJson: summary,
          grantedRewardsJson: grantedRewards,
          accepted,
          suspiciousScore: 0,
        },
      });

      await tx.userCurrencies.upsert({
        where: { userId },
        create: {
          userId,
          coins: grantedRewards.coins,
          ore: grantedRewards.resources.ore,
          crystal: grantedRewards.resources.crystal,
        },
        update: {
          coins: { increment: grantedRewards.coins },
          ore: { increment: grantedRewards.resources.ore },
          crystal: { increment: grantedRewards.resources.crystal },
        },
      });
    });

    return { accepted, grantedRewards };
  }

  async getHistory(userId: string, limit = 20) {
    const runs = await this.prisma.run.findMany({
      where: { userId },
      orderBy: { startedAt: "desc" },
      take: Math.min(Math.max(limit, 1), 50),
      select: {
        id: true,
        seed: true,
        weaponId: true,
        startedAt: true,
        finishedAt: true,
        endedBy: true,
        extractionCount: true,
        rewardMultiplier: true,
        status: true,
        result: {
          select: {
            accepted: true,
            summaryJson: true,
            grantedRewardsJson: true,
          },
        },
      },
    });

    return runs.map((r) => ({
      runId: r.id,
      seed: r.seed,
      weaponId: r.weaponId,
      startedAt: r.startedAt,
      finishedAt: r.finishedAt,
      endedBy: r.endedBy,
      extractionCount: r.extractionCount,
      rewardMultiplier: r.rewardMultiplier,
      status: r.status,
      result: r.result
        ? {
            accepted: r.result.accepted,
            summary: r.result.summaryJson,
            grantedRewards: r.result.grantedRewardsJson,
          }
        : null,
    }));
  }
}

function sumUpgradeEffects(effects: JsonValue[]) {
  let maxHp = 0;
  let damage = 0;
  let fireRate = 0;

  for (const raw of effects) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) continue;
    const effect = raw as Record<string, unknown>;

    const hp = effect.maxHp;
    if (typeof hp === "number" && Number.isFinite(hp)) maxHp += hp;

    const dmg = effect.damage;
    if (typeof dmg === "number" && Number.isFinite(dmg)) damage += dmg;

    const fr = effect.fireRate;
    if (typeof fr === "number" && Number.isFinite(fr)) fireRate += fr;
  }

  return { maxHp, damage, fireRate };
}
