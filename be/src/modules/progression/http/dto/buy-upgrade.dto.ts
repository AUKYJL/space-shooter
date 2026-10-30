import { IsIn, IsString } from "class-validator";
import { ALL_UPGRADE_IDS, type UpgradeId } from "../../../../common/ids";

export class BuyUpgradeDto {
  @IsString()
  @IsIn(ALL_UPGRADE_IDS)
  upgradeId!: UpgradeId;
}

