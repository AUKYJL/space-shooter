import { IsIn, IsString } from "class-validator";
import { ALL_WEAPON_IDS, type WeaponId } from "../../../../shared/ids";

export class StartRunDto {
  @IsString()
  @IsIn(ALL_WEAPON_IDS)
  weaponId!: WeaponId;
}
