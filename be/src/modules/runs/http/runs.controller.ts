import { Body, Controller, Get, Post, Query } from "@nestjs/common";
import { CurrentUser, type CurrentUser as CurrentUserType } from "../../../common/guards/current-user.decorator";
import { RunsService } from "../runs.service";
import { FinishRunDto } from "./dto/finish-run.dto";
import { StartRunDto } from "./dto/start-run.dto";

@Controller()
export class RunsController {
  constructor(private readonly runs: RunsService) {}

  @Get("/runs/config")
  config() {
    return this.runs.getConfig();
  }

  @Post("/runs/start")
  async start(@CurrentUser() user: CurrentUserType, @Body() body: StartRunDto) {
    return await this.runs.startRun(user.id, body.weaponId, body.scoringConfigVersion);
  }

  @Post("/runs/finish")
  async finish(@CurrentUser() user: CurrentUserType, @Body() body: FinishRunDto) {
    return await this.runs.finishRun(user.id, body);
  }

  @Get("/runs/history")
  async history(@CurrentUser() user: CurrentUserType, @Query("limit") limit?: string) {
    const parsed = limit ? Number(limit) : undefined;
    return await this.runs.getHistory(user.id, Number.isFinite(parsed) ? parsed : undefined);
  }
}

