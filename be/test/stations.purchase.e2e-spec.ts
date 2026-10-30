import request from "supertest";
import { Test } from "@nestjs/testing";
import { INestApplication } from "@nestjs/common";
import { AppModule } from "../src/app.module";
import { PrismaService } from "../src/infra/prisma/prisma.service";

async function login(app: INestApplication) {
  const res = await request(app.getHttpServer()).post("/auth/login-dev").send({ username: "dev" });
  return res.body.accessToken as string;
}

describe("stations purchase", () => {
  let app: INestApplication | undefined;
  let prisma: PrismaService | undefined;

  beforeAll(async () => {
    if (!process.env.DATABASE_URL) {
      return;
    }
    process.env.JWT_SECRET ??= "test-secret";
    process.env.PRISMA_CONNECT = "1";

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    await app?.close();
  });

  it("can unlock a station once", async () => {
    if (!app || !prisma) {
      return;
    }

    const token = await login(app);

    await prisma.stationCatalog.upsert({
      where: { id: "coin_station" },
      update: { unlockCostJson: { coins: 1500 } },
      create: {
        id: "coin_station",
        name: "Coin Station",
        resourceType: "coins",
        baseAmountPerCycle: 250,
        cycleDurationHours: 8,
        unlockCostJson: { coins: 1500 },
      },
    });

    const user = await prisma.user.findFirst({ where: { username: "dev" } });
    if (!user) {
      throw new Error("User not found");
    }

    await prisma.userCurrencies.update({ where: { userId: user.id }, data: { coins: 2000 } });

    await request(app.getHttpServer())
      .post("/stations/unlock")
      .set("Authorization", `Bearer ${token}`)
      .send({ stationId: "coin_station" })
      .expect(201);

    await request(app.getHttpServer())
      .post("/stations/unlock")
      .set("Authorization", `Bearer ${token}`)
      .send({ stationId: "coin_station" })
      .expect(400);
  });
});

