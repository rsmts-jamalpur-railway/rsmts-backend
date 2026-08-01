import { IsString, IsNotEmpty, IsEnum, Length, IsOptional, IsInt } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateAssetDto {
  @ApiProperty({
    description: '11-digit wagon number',
    minLength: 11,
    maxLength: 11,
  })
  @IsString()
  @IsNotEmpty()
  @Length(11, 11, { message: 'Asset number must be exactly 11 digits' })
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

  @ApiProperty({ description: 'Custom Fields JSON', required: false })
  @IsOptional()
  custom_fields?: any;
}
