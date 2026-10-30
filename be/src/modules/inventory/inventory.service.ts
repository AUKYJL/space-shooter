import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../infra/prisma/prisma.service";

@Injectable()
export class InventoryService {
  constructor(private readonly prisma: PrismaService) {}

  async getCurrencies(userId: string) {
    const currencies = await this.prisma.userCurrencies.findUnique({ where: { userId } });
    if (!currencies) {
      throw new NotFoundException("Currencies not found");
    }
    const { coins, donateCoins, ore, crystal } = currencies;
    return { coins, donateCoins, ore, crystal };
  }
}

