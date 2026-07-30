import { IsString, IsInt, IsOptional, IsBoolean } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateUserDto {
  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  full_name?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  department?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  designation?: string;

  @ApiProperty({ required: false })
  @IsInt()
  @IsOptional()
  role_id?: number;

  @ApiProperty({ required: false })
  @IsBoolean()
  @IsOptional()
  is_active?: boolean;
}
