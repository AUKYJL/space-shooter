import { Controller, Get } from "@nestjs/common";
import { CurrentUser, type CurrentUser as CurrentUserType } from "../../../shared/guards/current-user.decorator";
import { InventoryService } from "../inventory.service";

@Controller("/me")
export class InventoryController {
  constructor(private readonly inventory: InventoryService) {}

  @Get("/currencies")
  async currencies(@CurrentUser() user: CurrentUserType) {
    return await this.inventory.getCurrencies(user.id);
  }
}
