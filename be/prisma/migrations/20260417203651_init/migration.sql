-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "telegramId" TEXT,
    "username" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserCurrencies" (
    "userId" TEXT NOT NULL,
    "coins" INTEGER NOT NULL DEFAULT 0,
    "donateCoins" INTEGER NOT NULL DEFAULT 0,
    "ore" INTEGER NOT NULL DEFAULT 0,
    "crystal" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserCurrencies_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "WeaponCatalog" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "baseDamage" INTEGER NOT NULL,
    "baseFireRate" DOUBLE PRECISION NOT NULL,
    "projectileSpeed" DOUBLE PRECISION NOT NULL,
    "unlockedByDefault" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "WeaponCatalog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserWeapon" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "weaponId" TEXT NOT NULL,
    "unlocked" BOOLEAN NOT NULL DEFAULT false,
    "level" INTEGER,

    CONSTRAINT "UserWeapon_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserLoadout" (
    "userId" TEXT NOT NULL,
    "selectedWeaponId" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserLoadout_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "UpgradeCatalog" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "level" INTEGER NOT NULL,
    "costCoins" INTEGER NOT NULL,
    "costResourcesJson" JSONB NOT NULL,
    "effectJson" JSONB NOT NULL,

    CONSTRAINT "UpgradeCatalog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserUpgrade" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "upgradeId" TEXT NOT NULL,
    "purchasedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserUpgrade_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Run" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "seed" INTEGER NOT NULL,
    "weaponId" TEXT NOT NULL,
    "snapshotJson" JSONB NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "endedBy" TEXT,
    "extractionCount" INTEGER,
    "rewardMultiplier" DOUBLE PRECISION,
    "status" TEXT NOT NULL,

    CONSTRAINT "Run_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RunResult" (
    "runId" TEXT NOT NULL,
    "summaryJson" JSONB NOT NULL,
    "grantedRewardsJson" JSONB NOT NULL,
    "accepted" BOOLEAN NOT NULL,
    "suspiciousScore" INTEGER,

    CONSTRAINT "RunResult_pkey" PRIMARY KEY ("runId")
);

-- CreateTable
CREATE TABLE "StationCatalog" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "resourceType" TEXT NOT NULL,
    "baseAmountPerCycle" INTEGER NOT NULL,
    "cycleDurationHours" INTEGER NOT NULL,
    "unlockCostJson" JSONB NOT NULL,

    CONSTRAINT "StationCatalog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserStationUnlock" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "stationId" TEXT NOT NULL,
    "unlockedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserStationUnlock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserStationSlot" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "slotIndex" INTEGER NOT NULL,
    "assignedStationId" TEXT,
    "startedAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "lastCollectedAt" TIMESTAMP(3),

    CONSTRAINT "UserStationSlot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_telegramId_key" ON "User"("telegramId");

-- CreateIndex
CREATE UNIQUE INDEX "UserWeapon_userId_weaponId_key" ON "UserWeapon"("userId", "weaponId");

-- CreateIndex
CREATE UNIQUE INDEX "UserUpgrade_userId_upgradeId_key" ON "UserUpgrade"("userId", "upgradeId");

-- CreateIndex
CREATE UNIQUE INDEX "UserStationUnlock_userId_stationId_key" ON "UserStationUnlock"("userId", "stationId");

-- CreateIndex
CREATE UNIQUE INDEX "UserStationSlot_userId_slotIndex_key" ON "UserStationSlot"("userId", "slotIndex");

-- AddForeignKey
ALTER TABLE "UserCurrencies" ADD CONSTRAINT "UserCurrencies_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserWeapon" ADD CONSTRAINT "UserWeapon_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserWeapon" ADD CONSTRAINT "UserWeapon_weaponId_fkey" FOREIGN KEY ("weaponId") REFERENCES "WeaponCatalog"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserLoadout" ADD CONSTRAINT "UserLoadout_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserLoadout" ADD CONSTRAINT "UserLoadout_selectedWeaponId_fkey" FOREIGN KEY ("selectedWeaponId") REFERENCES "WeaponCatalog"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserUpgrade" ADD CONSTRAINT "UserUpgrade_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserUpgrade" ADD CONSTRAINT "UserUpgrade_upgradeId_fkey" FOREIGN KEY ("upgradeId") REFERENCES "UpgradeCatalog"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Run" ADD CONSTRAINT "Run_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Run" ADD CONSTRAINT "Run_weaponId_fkey" FOREIGN KEY ("weaponId") REFERENCES "WeaponCatalog"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RunResult" ADD CONSTRAINT "RunResult_runId_fkey" FOREIGN KEY ("runId") REFERENCES "Run"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserStationUnlock" ADD CONSTRAINT "UserStationUnlock_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserStationUnlock" ADD CONSTRAINT "UserStationUnlock_stationId_fkey" FOREIGN KEY ("stationId") REFERENCES "StationCatalog"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserStationSlot" ADD CONSTRAINT "UserStationSlot_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserStationSlot" ADD CONSTRAINT "UserStationSlot_assignedStationId_fkey" FOREIGN KEY ("assignedStationId") REFERENCES "StationCatalog"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
