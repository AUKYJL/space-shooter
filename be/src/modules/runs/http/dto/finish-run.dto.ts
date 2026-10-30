import { Type } from "class-transformer";
import { IsDefined, IsIn, IsInt, IsNumber, IsObject, IsOptional, IsUUID, Max, Min, ValidateNested } from "class-validator";

class ResourcesCollectedDto {
  @IsInt() @Min(0) @Max(2_147_483_647)
  ore!: number;

  @IsInt() @Min(0) @Max(2_147_483_647)
  crystal!: number;
}

class DestroyedByTypeDto {
  @IsInt() @Min(0) @Max(2_147_483_647)
  normal!: number;

  @IsInt() @Min(0) @Max(2_147_483_647)
  fast!: number;

  @IsInt() @Min(0) @Max(2_147_483_647)
  big!: number;

  @IsInt() @Min(0) @Max(2_147_483_647)
  armored!: number;
}

class RunSummaryDto {
  @IsInt() @Min(0) @Max(2_147_483_647)
  asteroidsDestroyed!: number;

  @IsDefined() @IsObject() @ValidateNested() @Type(() => DestroyedByTypeDto)
  destroyedByType!: DestroyedByTypeDto;

  @IsInt() @Min(1) @Max(2_147_483_647)
  stageReached!: number;

  @IsInt() @Min(0) @Max(2_147_483_647) @IsOptional()
  largeAsteroidsDestroyed?: number;

  @IsInt() @Min(0) @Max(2_147_483_647) @IsOptional()
  armoredAsteroidsDestroyed?: number;

  @IsInt() @Min(0) @Max(2_147_483_647) @IsOptional()
  rareAsteroidsDestroyed?: number;

  @IsInt() @Min(0) @Max(2_147_483_647)
  coinsCollected!: number;

  @IsDefined() @IsObject() @ValidateNested() @Type(() => ResourcesCollectedDto)
  resourcesCollected!: ResourcesCollectedDto;
}

export class FinishRunDto {
  @IsUUID()
  runId!: string;

  @IsInt() @Min(0) @Max(2_147_483_647)
  durationMs!: number;

  @IsIn(["death", "extract"])
  endedBy!: "death" | "extract";

  @IsInt() @Min(0) @Max(2_147_483_647)
  extractionCount!: number;

  @IsNumber() @Min(0) @Max(2_147_483_647)
  rewardMultiplier!: number;

  @IsDefined() @IsObject() @ValidateNested() @Type(() => RunSummaryDto)
  summary!: RunSummaryDto;

  @IsObject() @IsOptional()
  extra?: Record<string, unknown>;
}
