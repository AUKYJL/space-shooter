import { Module } from "@nestjs/common";
import { StationsController } from "./http/stations.controller";
import { StationsService } from "./stations.service";

@Module({
  controllers: [StationsController],
  providers: [StationsService],
})
export class StationsModule {}

