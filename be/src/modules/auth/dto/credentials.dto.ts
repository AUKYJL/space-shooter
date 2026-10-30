import { Transform } from "class-transformer";
import { IsString, MinLength } from "class-validator";

export class CredentialsDto {
  @Transform(({ value }) => typeof value === "string" ? value.trim().toLowerCase() : value)
  @IsString()
  @MinLength(1)
  username!: string;

  @IsString()
  @MinLength(1)
  password!: string;
}
