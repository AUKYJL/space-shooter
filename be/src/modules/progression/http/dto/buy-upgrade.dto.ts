import { IsIn, IsString } from "class-validator";
import { ALL_UPGRADE_IDS, type UpgradeId } from "../../../../shared/ids";

export class BuyUpgradeDto {
  @IsString()
  @IsIn(ALL_UPGRADE_IDS)
  upgradeId!: UpgradeId;
}
