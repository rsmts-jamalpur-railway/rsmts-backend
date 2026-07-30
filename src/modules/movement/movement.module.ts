import { Module } from '@nestjs/common';
import { MovementService } from './movement.service';
import { MovementController } from './movement.controller';

@Module({
  providers: [MovementService],
  controllers: [MovementController],
  exports: [MovementService],
})
export class MovementModule {}
