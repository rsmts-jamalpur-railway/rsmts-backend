import { IsString, IsNotEmpty, IsOptional, IsBoolean } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateMovementDto {
  @ApiProperty({ description: 'The 11 digit asset number' })
  @IsString()
  @IsNotEmpty()
  asset_number: string;

  @ApiProperty({ description: 'The new status (e.g. Allocated, Accepted, Repair)' })
  @IsString()
  @IsNotEmpty()
  new_status: string;

  @ApiProperty({ description: 'Target location ID', required: false })
  @IsString()
  @IsOptional()
  to_location?: string;

  @ApiProperty({ description: 'Any remarks for this movement', required: false })
  @IsString()
  @IsOptional()
  remarks?: string;

  @ApiProperty({ description: 'Flag if this was recorded offline and synced later', required: false })
  @IsBoolean()
  @IsOptional()
  is_offline_entry?: boolean;
}
