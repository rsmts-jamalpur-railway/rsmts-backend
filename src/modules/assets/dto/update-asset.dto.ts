import {
  IsString,
  IsOptional,
  IsBoolean,
  IsInt,
  IsEnum,
} from 'class-validator';
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

  @ApiProperty({
    description: 'REPAIR, GIF, or CRANE',
    enum: ['REPAIR', 'GIF', 'CRANE'],
    required: false,
  })
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

  @ApiProperty({ description: 'Action (e.g. POH)', required: false })
  @IsOptional()
  @IsString()
  action?: string;

  @ApiProperty({
    description: 'Category of asset',
    enum: ['WAGON', 'LOCO', 'CRANE', 'TOWER_CAR'],
    required: false,
  })
  @IsOptional()
  @IsEnum(['WAGON', 'LOCO', 'CRANE', 'TOWER_CAR'])
  asset_category?: string;

  // Loco Specific
  @ApiProperty({ description: 'Locomotive Type', required: false })
  @IsOptional()
  @IsEnum(['WAG-9', 'WAP-7', 'WDG-3A', 'WDG-4', 'WDP-4', 'WDS-6'])
  loco_type?: string;

  // Crane Specific
  @ApiProperty({ description: 'Crane Age Tag', required: false })
  @IsOptional()
  @IsEnum(['OLD', 'NEW'])
  crane_age_tag?: string;

  // Tower Car Specific
  @ApiProperty({ description: 'Tower Car Variant', required: false })
  @IsOptional()
  @IsEnum(['M3', 'M4', 'DETC', 'DHTC'])
  tc_variant?: string;

  @ApiProperty({ description: 'Tower Car Zone', required: false })
  @IsOptional()
  @IsEnum(['ER', 'ECR'])
  tc_zone?: string;

  @ApiProperty({ description: 'Custom Fields JSON', required: false })
  @IsOptional()
  custom_fields?: any;
}
