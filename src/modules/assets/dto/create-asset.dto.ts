import { IsString, IsNotEmpty, IsEnum, Length } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateAssetDto {
  @ApiProperty({ description: '11-digit wagon number', minLength: 11, maxLength: 11 })
  @IsString()
  @IsNotEmpty()
  @Length(11, 11, { message: 'Asset number must be exactly 11 digits' })
  asset_number: string;

  @ApiProperty({ description: 'Type of asset (e.g. BOXNHL)' })
  @IsString()
  @IsNotEmpty()
  asset_type: string;

  @ApiProperty({ description: 'REPAIR or NEW_MFG', enum: ['REPAIR', 'NEW_MFG'] })
  @IsEnum(['REPAIR', 'NEW_MFG'])
  @IsNotEmpty()
  origin: string;
}
