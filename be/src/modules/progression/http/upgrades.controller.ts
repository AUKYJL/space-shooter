import { Body, Controller, Get, Post } from "@nestjs/common";
import { CurrentUser, type CurrentUser as CurrentUserType } from "../../../common/guards/current-user.decorator";
import { ProgressionService } from "../progression.service";
import { BuyUpgradeDto } from "./dto/buy-upgrade.dto";

@Controller()
export class UpgradesController {
  constructor(private readonly progression: ProgressionService) {}

  @Get("/upgrades")
  async upgrades(@CurrentUser() user: CurrentUserType) {
    return await this.progression.getUpgrades(user.id);
  }

  @Post("/upgrades/buy")
  async buyUpgrade(@CurrentUser() user: CurrentUserType, @Body() body: BuyUpgradeDto) {
    return await this.progression.buyUpgrade(user.id, body.upgradeId);
  }
}

