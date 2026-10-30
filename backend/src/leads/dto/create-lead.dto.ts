import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsOptional, IsPhoneNumber, IsString, Length, MaxLength } from "class-validator";

export class CreateLeadDto {
  @ApiProperty() @IsString() @Length(2, 100) parentName: string;
  @ApiProperty() @IsPhoneNumber("VN") phone: string;
  @ApiProperty() @IsString() @Length(2, 100) studentName: string;
  @ApiProperty() @IsString() @Length(1, 50) studentGrade: string;
  @ApiProperty() @IsString() @Length(1, 100) interestedCourse: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(500) note?: string;
}

