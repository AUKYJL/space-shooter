import { Injectable, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit() {
    if (process.env.NODE_ENV === "test" && process.env.PRISMA_CONNECT !== "1") {
      return;
    }
    await this.$connect();
  }

  async onModuleDestroy() {
    if (process.env.NODE_ENV === "test" && process.env.PRISMA_CONNECT !== "1") {
      return;
    }
    await this.$disconnect();
  }
}
