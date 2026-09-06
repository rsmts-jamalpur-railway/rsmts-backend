import { IsEmail, IsNotEmpty, IsOptional, IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateUserDto {
  @ApiProperty({ example: 'JMP-2041' })
  @IsString()
  @IsNotEmpty()
  employee_number: string;

  @ApiProperty({ example: 'Rajesh' })
  @IsString()
  @IsNotEmpty()
  first_name: string;

  @ApiProperty({ example: 'Sharma', required: false })
  @IsString()
  @IsOptional()
  last_name?: string;

  @ApiProperty({ example: 'rajesh.sharma@rsmts.gov.in' })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({ example: 'Jamalpur@123' })
  @IsString()
  @MinLength(6)
  password: string;

  @ApiProperty({ example: 'REPAIR_SUPERVISOR' })
  @IsString()
  @IsNotEmpty()
  role_name: string;

  @ApiProperty({ example: 'WRS-1', required: false })
  @IsString()
  @IsOptional()
  assigned_location_id?: string;

  @ApiProperty({ example: 'Mechanical (Carriage & Wagon)', required: false })
  @IsString()
  @IsOptional()
  department?: string;

  @ApiProperty({ example: 'Senior Section Engineer (SSE)', required: false })
  @IsString()
  @IsOptional()
  designation?: string;
}
