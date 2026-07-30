import { Module } from '@nestjs/common';
import { OfflineSyncService } from './offline-sync.service';
import { OfflineSyncController } from './offline-sync.controller';

import { MovementModule } from '../movement/movement.module';

@Module({
  imports: [MovementModule],
  providers: [OfflineSyncService],
  controllers: [OfflineSyncController],
})
export class OfflineSyncModule {}
