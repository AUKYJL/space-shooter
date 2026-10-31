import { WEAPON_CATALOG } from "../src/shared/game-config/weaponsConfig";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const weapons = WEAPON_CATALOG;

  for (const weapon of weapons) {
    await prisma.weaponCatalog.upsert({
      where: { id: weapon.id },
      update: weapon,
      create: weapon,
    });
  }

  const stations = [
    {
      id: "coin_station",
      name: "Coin Station",
      resourceType: "coins",
      baseAmountPerCycle: 250,
      cycleDurationHours: 8,
      unlockCostJson: { coins: 1500 },
    },
  ] as const;

  for (const station of stations) {
    await prisma.stationCatalog.upsert({
      where: { id: station.id },
      update: station,
      create: station,
    });
  }

  const upgrades = [
    {
      id: "hp_1",
      type: "hp",
      level: 1,
      costCoins: 1000,
      costResourcesJson: {},
      effectJson: { maxHp: 10 },
    },
    {
      id: "damage_1",
      type: "damage",
      level: 1,
      costCoins: 1200,
      costResourcesJson: {},
      effectJson: { damage: 1 },
    },
    {
      id: "fire_rate_1",
      type: "fire_rate",
      level: 1,
      costCoins: 1100,
      costResourcesJson: {},
      effectJson: { fireRate: 0.1 },
    },
  ] as const;

  for (const upgrade of upgrades) {
    await prisma.upgradeCatalog.upsert({
      where: { id: upgrade.id },
      update: upgrade,
      create: upgrade,
    });
  }
}

main()
  .then(async () => prisma.$disconnect())
  .catch(async (err) => {
    console.error(err);
    await prisma.$disconnect();
    process.exit(1);
  });
