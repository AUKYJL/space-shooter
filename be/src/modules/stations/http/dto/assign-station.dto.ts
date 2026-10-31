import { IsIn, IsString } from "class-validator";
import { ALL_STATION_IDS, type StationId } from "../../../../shared/ids";

export class AssignStationDto {
  @IsString()
  @IsIn(ALL_STATION_IDS)
  stationId!: StationId;
}
