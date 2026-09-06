import { IsEmail, IsOptional, IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateUserDto {
  @ApiProperty({ example: 'Rajesh', required: false })
  @IsString()
  @IsOptional()
  first_name?: string;

  @ApiProperty({ example: 'Sharma', required: false })
  @IsString()
  @IsOptional()
  last_name?: string;

  @ApiProperty({ example: 'rajesh.sharma@rsmts.gov.in', required: false })
  @IsEmail()
  @IsOptional()
  email?: string;

  @ApiProperty({ example: 'NewSecret@123', required: false })
  @IsString()
  @MinLength(6)
  @IsOptional()
  password?: string;

  @ApiProperty({ example: 'REPAIR_SUPERVISOR', required: false })
  @IsString()
  @IsOptional()
  role_name?: string;

  @ApiProperty({ example: 'WRS-2', required: false })
  @IsString()
  @IsOptional()
  assigned_location_id?: string;

  @ApiProperty({ example: 'ACTIVE', required: false, enum: ['ACTIVE', 'SUSPENDED', 'INACTIVE'] })
  @IsString()
  @IsOptional()
  status?: string;

  @ApiProperty({ example: 'Mechanical', required: false })
  @IsString()
  @IsOptional()
  department?: string;

  @ApiProperty({ example: 'Senior Section Engineer', required: false })
  @IsString()
  @IsOptional()
  designation?: string;
}
