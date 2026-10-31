import { Body, Controller, Get, Param, Post } from "@nestjs/common";
import { CurrentUser, type CurrentUser as CurrentUserType } from "../../../shared/guards/current-user.decorator";
import { StationsService } from "../stations.service";
import { AssignStationDto } from "./dto/assign-station.dto";
import { UnlockStationDto } from "./dto/unlock-station.dto";

@Controller()
export class StationsController {
  constructor(private readonly stations: StationsService) {}

  @Get("/stations/catalog")
  async catalog() {
    return await this.stations.getCatalog();
  }

  @Get("/stations/unlocks")
  async unlocks(@CurrentUser() user: CurrentUserType) {
    return await this.stations.getUnlocks(user.id);
  }

  @Get("/stations/slots")
  async slots(@CurrentUser() user: CurrentUserType) {
    return await this.stations.getSlots(user.id);
  }

  @Post("/stations/unlock-slot")
  async unlockSlot(@CurrentUser() user: CurrentUserType) {
    return await this.stations.unlockSlot(user.id);
  }

  @Post("/stations/unlock")
  async unlock(@CurrentUser() user: CurrentUserType, @Body() body: UnlockStationDto) {
    return await this.stations.unlockStation(user.id, body.stationId);
  }

  @Post("/stations/slots/:slotId/assign")
  async assign(@CurrentUser() user: CurrentUserType, @Param("slotId") slotId: string, @Body() body: AssignStationDto) {
    return await this.stations.assignStation(user.id, slotId, body.stationId);
  }

  @Post("/stations/slots/:slotId/start")
  async start(@CurrentUser() user: CurrentUserType, @Param("slotId") slotId: string) {
    return await this.stations.startCycle(user.id, slotId);
  }

  @Post("/stations/slots/:slotId/collect")
  async collect(@CurrentUser() user: CurrentUserType, @Param("slotId") slotId: string) {
    return await this.stations.collect(user.id, slotId);
  }
}
