import { Controller, Get } from "@nestjs/common";
import { CurrentUser, type CurrentUser as CurrentUserType } from "../../../shared/guards/current-user.decorator";
import { ProgressionService } from "../progression.service";

@Controller("/me")
export class ProgressionController {
  constructor(private readonly progression: ProgressionService) {}

  @Get("/progression")
  async progressionState(@CurrentUser() user: CurrentUserType) {
    return await this.progression.getProgression(user.id);
  }
}
