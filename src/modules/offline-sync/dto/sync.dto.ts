import { IsNumber, IsObject, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class SyncPushDto {
  @ApiProperty()
  @IsObject()
  changes: any;

  @ApiProperty()
  @IsNumber()
  last_pulled_at: number;
}
