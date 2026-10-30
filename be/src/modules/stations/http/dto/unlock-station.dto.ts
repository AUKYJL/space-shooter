import { IsIn, IsString } from "class-validator";
import { ALL_STATION_IDS, type StationId } from "../../../../common/ids";

export class UnlockStationDto {
  @IsString()
  @IsIn(ALL_STATION_IDS)
  stationId!: StationId;
}

