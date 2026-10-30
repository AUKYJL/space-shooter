export const STATION_ID = {
  COIN_STATION: "coin_station",
} as const;

export type StationId = (typeof STATION_ID)[keyof typeof STATION_ID];

export const ALL_STATION_IDS = Object.values(STATION_ID) as StationId[];
