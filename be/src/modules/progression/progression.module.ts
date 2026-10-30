import { Module } from "@nestjs/common";
import { ProgressionController } from "./http/progression.controller";
import { UpgradesController } from "./http/upgrades.controller";
import { ProgressionService } from "./progression.service";

@Module({
  controllers: [ProgressionController, UpgradesController],
  providers: [ProgressionService],
})
export class ProgressionModule {}
