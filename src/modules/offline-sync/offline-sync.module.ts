import { Module } from '@nestjs/common';
import { OfflineSyncService } from './offline-sync.service';
import { OfflineSyncController } from './offline-sync.controller';

@Module({
  providers: [OfflineSyncService],
  controllers: [OfflineSyncController]
})
export class OfflineSyncModule {}
