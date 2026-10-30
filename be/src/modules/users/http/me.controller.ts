import { Controller, Get } from "@nestjs/common";
import { CurrentUser, type CurrentUser as CurrentUserType } from "../../../common/guards/current-user.decorator";
import { UsersService } from "../users.service";

@Controller()
export class MeController {
  constructor(private readonly users: UsersService) {}

  @Get("/me")
  async me(@CurrentUser() user: CurrentUserType) {
    return await this.users.getProfile(user.id);
  }
}
