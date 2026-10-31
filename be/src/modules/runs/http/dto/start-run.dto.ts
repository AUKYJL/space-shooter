import { IsIn, IsInt, IsString, Min } from "class-validator";
import { ALL_WEAPON_IDS, type WeaponId } from "../../../../shared/ids";

export class StartRunDto {
  @IsInt()
  @Min(1)
  scoringConfigVersion!: number;

  @IsString()
  @IsIn(ALL_WEAPON_IDS)
  weaponId!: WeaponId;
}
