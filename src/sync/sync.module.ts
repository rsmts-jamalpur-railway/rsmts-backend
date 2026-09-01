import { Module } from '@nestjs/common';
import { SyncController } from './sync.controller';
import { SyncService } from './sync.service';
import { SyncDispatcher } from './sync.dispatcher';
import { PrismaModule } from '../prisma/prisma.module';
import { RepairModule } from '../repair/repair.module';
import { YardModule } from '../yard/yard.module';
import { QaModule } from '../qa/qa.module';
import { ManufacturingModule } from '../manufacturing/manufacturing.module';
import { ExceptionsModule } from '../exceptions/exceptions.module';

@Module({
  imports: [
    PrismaModule,
    RepairModule,
    YardModule,
    QaModule,
    ManufacturingModule,
    ExceptionsModule,
  ],
  controllers: [SyncController],
  providers: [SyncService, SyncDispatcher],
})
export class SyncModule {}
