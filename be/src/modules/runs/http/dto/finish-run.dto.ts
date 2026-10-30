import { Type } from "class-transformer";
import { IsInt, IsNumber, IsObject, IsOptional, IsString, IsUUID, Max, Min, ValidateNested } from "class-validator";

class ResourcesCollectedDto {
  @IsInt()
  @Min(0)
  ore!: number;

  @IsInt()
  @Min(0)
  crystal!: number;
}

class RunSummaryDto {
  @IsInt()
  @Min(0)
  asteroidsDestroyed!: number;

  @IsInt()
  @Min(0)
  @IsOptional()
  largeAsteroidsDestroyed?: number;

  @IsInt()
  @Min(0)
  @IsOptional()
  armoredAsteroidsDestroyed?: number;

  @IsInt()
  @Min(0)
  @IsOptional()
  rareAsteroidsDestroyed?: number;

  @IsInt()
  @Min(0)
  coinsCollected!: number;

  @ValidateNested()
  @Type(() => ResourcesCollectedDto)
  resourcesCollected!: ResourcesCollectedDto;
}

export class FinishRunDto {
  @IsUUID()
  runId!: string;

  @IsInt()
  @Min(0)
  durationMs!: number;

  @IsString()
  endedBy!: string;

  @IsInt()
  @Min(0)
  @Max(10)
  extractionCount!: number;

  @IsNumber()
  @Min(0)
  @Max(10)
  rewardMultiplier!: number;

  @ValidateNested()
  @Type(() => RunSummaryDto)
  summary!: RunSummaryDto;

  @IsObject()
  @IsOptional()
  extra?: Record<string, unknown>;
}

