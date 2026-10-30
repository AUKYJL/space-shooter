import { Test } from "@nestjs/testing";
import { INestApplication } from "@nestjs/common";
import { AppModule } from "../src/app.module";
import { PrismaService } from "../src/infra/prisma/prisma.service";

describe("prisma", () => {
  let app: INestApplication;
  let prisma: PrismaService;

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

  it("can connect", async () => {
    if (!process.env.DATABASE_URL) {
      return;
    }
    await expect(prisma.$queryRaw`SELECT 1`).resolves.toBeTruthy();
  });
});
