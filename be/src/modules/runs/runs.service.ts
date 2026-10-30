import {
  BadRequestException,
  ConflictException,
  Logger,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { randomInt } from "crypto";
import { PrismaService } from "../../infra/prisma/prisma.service";
import { type WeaponId } from "../../common/ids";
import type { Prisma } from "@prisma/client";
import { FinishRunDto } from "./http/dto/finish-run.dto";
import { calculateScore, getSuspicionReasons, SCORING_CONFIG, type ScoringConfig } from "./scoring";
import { type JsonValue } from "@prisma/client/runtime/library";

type RunSnapshot = {
  scoringConfig: ScoringConfig;
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

  private readonly logger = new Logger(RunsService.name);

  getConfig(): ScoringConfig {
    return SCORING_CONFIG;
  }

  async startRun(userId: string, weaponId: WeaponId, scoringConfigVersion: number) {
    const scoringConfig = this.getConfig();
    if (scoringConfigVersion !== scoringConfig.version) {
      throw new ConflictException("Scoring config changed; reload /runs/config");
    }
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
    const START_HP = 1000;
    const snapshot: RunSnapshot = {
      scoringConfig,
      weaponId,
      damage: weapon.baseDamage + bonus.damage,
      fireRate: weapon.baseFireRate + bonus.fireRate,
      maxHp: START_HP + bonus.maxHp,
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

    return { runId: run.id, seed, snapshot, scoringConfigVersion: scoringConfig.version };
  }

  async finishRun(userId: string, input: FinishRunDto) {
    return this.prisma.$transaction(async (tx) => {
      const run = await tx.run.findFirst({ where: { id: input.runId, userId } });
      if (!run) throw new NotFoundException("Run not found");

      const savedResponse = async () => {
        const result = await tx.runResult.findUnique({ where: { runId: run.id } });
        if (!result) throw new ConflictException("Run has no completed result");
        const user = await tx.user.findUniqueOrThrow({ where: { id: userId }, select: { bestScore: true } });
        return { accepted: result.accepted, score: result.score, bestScore: user.bestScore,
          grantedRewards: result.grantedRewardsJson as unknown as GrantedRewards };
      };
      if (run.status !== "started" || run.finishedAt) return savedResponse();

      const config = (run.snapshotJson as unknown as Partial<RunSnapshot>).scoringConfig;
      const score = config ? calculateScore(config, input.summary.destroyedByType, input.summary.stageReached, input.summary.enemiesDestroyed) : null;
      const now = new Date();
      const reasons = getSuspicionReasons(input, run.startedAt, now, config);
      if (!config) reasons.push("missing scoring snapshot");
      const accepted = reasons.length === 0;
      const multiplier = 1 + (input.summary.stageReached - 1) * 0.15;
      const grantLoot = accepted && input.endedBy === "extract";
      const grantedRewards: GrantedRewards = {
        coins: grantLoot ? Math.min(Math.floor(input.summary.coinsCollected * multiplier), COINS_CAP) : 0,
        resources: {
          ore: grantLoot ? Math.min(Math.floor(input.summary.resourcesCollected.ore * multiplier), ORE_CAP) : 0,
          crystal: grantLoot ? Math.min(Math.floor(input.summary.resourcesCollected.crystal * multiplier), CRYSTAL_CAP) : 0,
        },
      };

      // The conditional UPDATE locks the row. Concurrent losers wait for the winner's
      // commit and then read its canonical result under PostgreSQL READ COMMITTED.
      const claimed = await tx.run.updateMany({
        where: { id: run.id, userId, status: "started", finishedAt: null },
        data: { finishedAt: now, endedBy: input.endedBy, extractionCount: input.extractionCount,
          rewardMultiplier: input.rewardMultiplier, status: "finished" },
      });
      if (claimed.count === 0) return savedResponse();

      await tx.runResult.create({
        data: { runId: run.id, score, accepted, suspiciousScore: reasons.length,
          summaryJson: { ...input.summary, validationReasons: reasons } as unknown as Prisma.InputJsonValue,
          grantedRewardsJson: grantedRewards },
      });
      if (grantLoot) {
        await tx.userCurrencies.upsert({
          where: { userId },
          create: { userId, coins: grantedRewards.coins, ore: grantedRewards.resources.ore,
            crystal: grantedRewards.resources.crystal },
          update: { coins: { increment: grantedRewards.coins }, ore: { increment: grantedRewards.resources.ore },
            crystal: { increment: grantedRewards.resources.crystal } },
        });
      }
      if (accepted && score !== null) {
        await tx.user.updateMany({ where: { id: userId, bestScore: { lt: score } }, data: { bestScore: score } });
      }
      if (!accepted) this.logger.warn(`Run ${run.id} rejected: ${reasons.join(", ")}`);
      return savedResponse();
    });
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
            score: true,
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
            score: r.result.score,
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
