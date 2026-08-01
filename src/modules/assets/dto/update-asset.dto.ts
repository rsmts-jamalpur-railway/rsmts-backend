import { IsString, IsOptional, IsBoolean, IsInt, IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateAssetDto {
  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  asset_type?: string;

  @ApiProperty({ required: false })
  @IsBoolean()
  @IsOptional()
  is_active?: boolean;

  @ApiProperty({ description: 'REPAIR, GIF, or CRANE', enum: ['REPAIR', 'GIF', 'CRANE'], required: false })
  @IsOptional()
  @IsEnum(['REPAIR', 'GIF', 'CRANE'])
  origin?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  wagon_sr?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  rly?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  mod?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsInt()
  built_year?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  action?: string;

  @ApiProperty({ description: 'Custom Fields JSON', required: false })
  @IsOptional()
  custom_fields?: any;
}
