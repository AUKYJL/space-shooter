import { Body, Controller, Get, Patch } from "@nestjs/common";
import { CurrentUser, type CurrentUser as CurrentUserType } from "../../../shared/guards/current-user.decorator";
import { LoadoutService } from "../loadout.service";
import { SetWeaponDto } from "./dto/set-weapon.dto";

@Controller()
export class LoadoutController {
  constructor(private readonly loadout: LoadoutService) {}

  @Get("/loadout")
  async getLoadout(@CurrentUser() user: CurrentUserType) {
    return await this.loadout.getLoadout(user.id);
  }

  @Patch("/loadout/weapon")
  async setWeapon(@CurrentUser() user: CurrentUserType, @Body() body: SetWeaponDto) {
    return await this.loadout.setSelectedWeapon(user.id, body.weaponId);
  }
}
