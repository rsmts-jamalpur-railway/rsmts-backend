import { Module } from '@nestjs/common';
import { YardService } from './yard.service';
import { YardController } from './yard.controller';
import { MovementsModule } from '../movements/movements.module';

@Module({
  imports: [MovementsModule],
  controllers: [YardController],
  providers: [YardService],
  exports: [YardService]
})
export class YardModule {}
