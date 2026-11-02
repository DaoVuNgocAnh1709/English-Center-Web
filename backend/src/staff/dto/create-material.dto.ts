import { MaterialType } from "@prisma/client";
import { IsBoolean, IsEnum, IsInt, IsOptional, IsString, IsUrl, MaxLength, Min } from "class-validator";

export class CreateMaterialDto {
  @IsString() @MaxLength(160) title!: string;
  @IsString() @MaxLength(220) summary!: string;
  @IsString() @MaxLength(80) category!: string;
  @IsOptional() @IsString() @MaxLength(80) level?: string;
  @IsEnum(MaterialType) type!: MaterialType;
  @IsOptional() @IsUrl({ protocols: ["http", "https"], require_protocol: true, require_tld: true }) driveUrl?: string;
  @IsOptional() @IsUrl({ protocols: ["http", "https"], require_protocol: true, require_tld: true }) youtubeUrl?: string;
  @IsOptional() @IsBoolean() isPublic?: boolean;
  @IsOptional() @IsInt() @Min(0) sortOrder?: number;
}
