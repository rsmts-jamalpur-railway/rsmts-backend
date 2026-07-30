import {
  IsString,
  IsNotEmpty,
  IsInt,
  IsOptional,
  IsBoolean,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateUserDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  employee_id: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  password: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  full_name: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  department?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  designation?: string;

  @ApiProperty()
  @IsInt()
  @IsNotEmpty()
  role_id: number;

  @ApiProperty({ required: false })
  @IsBoolean()
  @IsOptional()
  is_active?: boolean;
}
