import { Module } from '@nestjs/common';
import { RepairService } from './repair.service';
import { RepairController } from './repair.controller';
import { MovementsModule } from '../movements/movements.module';

@Module({
  imports: [MovementsModule],
  controllers: [RepairController],
  providers: [RepairService],
  exports: [RepairService]
})
export class RepairModule {}
