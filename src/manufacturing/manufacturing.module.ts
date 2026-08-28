import { Module } from '@nestjs/common';
import { ManufacturingService } from './manufacturing.service';
import { ManufacturingController } from './manufacturing.controller';
import { MovementsModule } from '../movements/movements.module';

@Module({
  imports: [MovementsModule],
  controllers: [ManufacturingController],
  providers: [ManufacturingService],
  exports: [ManufacturingService]
})
export class ManufacturingModule {}
