import {
  IsString,
  IsNotEmpty,
  IsEnum,
  Length,
  IsOptional,
  IsInt,
  ValidateIf,
  Matches,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateAssetDto {
  @ApiProperty({
    description: 'Category of asset',
    enum: ['WAGON', 'LOCO', 'CRANE', 'TOWER_CAR'],
  })
  @IsEnum(['WAGON', 'LOCO', 'CRANE', 'TOWER_CAR'])
  @IsNotEmpty()
  asset_category: string;

  @ApiProperty({ description: 'Asset identifier number' })
  @IsString()
  @IsNotEmpty()
  @ValidateIf((o) => o.asset_category === 'WAGON')
  @Matches(/^\d{11}$/, { message: 'Wagon number must be exactly 11 digits' })
  @ValidateIf((o) => o.asset_category === 'LOCO')
  @Matches(/^\d{5}$/, { message: 'Locomotive number must be exactly 5 digits' })
  @ValidateIf((o) => o.asset_category === 'CRANE')
  @Matches(/^(?!145)\d{6}$/, {
    message: 'Crane number must be 6 digits and cannot start with 145',
  })
  @ValidateIf((o) => o.asset_category === 'TOWER_CAR')
  @Matches(/^(\d{3}|\d{6})$/, {
    message: 'Tower car number must be exactly 3 or 6 digits',
  })
  asset_number: string;

  @ApiProperty({ description: 'Type of asset (e.g. BOXNHL)' })
  @IsString()
  @IsNotEmpty()
  asset_type: string;

  @ApiProperty({
    description: 'REPAIR, GIF, or CRANE',
    enum: ['REPAIR', 'GIF', 'CRANE'],
  })
  @IsEnum(['REPAIR', 'GIF', 'CRANE'])
  @IsNotEmpty()
  origin: string;

  @ApiProperty({ description: 'Serial Number', required: false })
  @IsOptional()
  @IsString()
  wagon_sr?: string;

  @ApiProperty({ description: 'Railway Zone', required: false })
  @IsOptional()
  @IsString()
  rly?: string;

  @ApiProperty({ description: 'Modification/Type', required: false })
  @IsOptional()
  @IsString()
  mod?: string;

  @ApiProperty({ description: 'Built Year', required: false })
  @IsOptional()
  @IsInt()
  built_year?: number;

  @ApiProperty({ description: 'Action (e.g. POH)', required: false })
  @IsOptional()
  @IsString()
  action?: string;

  // Loco Specific
  @ApiProperty({ description: 'Locomotive Type', required: false })
  @ValidateIf((o) => o.asset_category === 'LOCO')
  @IsEnum(['WAG-9', 'WAP-7', 'WDG-3A', 'WDG-4', 'WDP-4', 'WDS-6'])
  @IsNotEmpty()
  loco_type?: string;

  // Crane Specific
  @ApiProperty({ description: 'Crane Age Tag', required: false })
  @ValidateIf((o) => o.asset_category === 'CRANE')
  @IsEnum(['OLD', 'NEW'])
  @IsNotEmpty()
  crane_age_tag?: string;

  // Tower Car Specific
  @ApiProperty({ description: 'Tower Car Variant', required: false })
  @ValidateIf((o) => o.asset_category === 'TOWER_CAR')
  @IsEnum(['M3', 'M4', 'DETC', 'DHTC'])
  @IsNotEmpty()
  tc_variant?: string;

  @ApiProperty({ description: 'Tower Car Zone', required: false })
  @ValidateIf((o) => o.asset_category === 'TOWER_CAR')
  @IsEnum(['ER', 'ECR'])
  @IsNotEmpty()
  tc_zone?: string;

  @ApiProperty({ description: 'Custom Fields JSON', required: false })
  @IsOptional()
  custom_fields?: any;
}
