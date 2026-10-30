import { Test } from "@nestjs/testing";
import { INestApplication } from "@nestjs/common";
import { AppModule } from "../src/app.module";
import { PrismaService } from "../src/infra/prisma/prisma.service";

describe("models", () => {
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

  it("creates a user with currencies", async () => {
    if (!process.env.DATABASE_URL) {
      return;
    }
    if (!prisma) {
      throw new Error("Prisma not initialized");
    }

    const user = await prisma.user.create({ data: {} });
    const currencies = await prisma.userCurrencies.create({
      data: { userId: user.id, coins: 0, donateCoins: 0, ore: 0, crystal: 0 },
    });
    expect(currencies.userId).toBe(user.id);
  });
});

