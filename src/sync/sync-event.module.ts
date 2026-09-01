import { Global, Module } from '@nestjs/common';
import { SyncEventService } from './sync-event.service';

@Global()
@Module({
  providers: [SyncEventService],
  exports: [SyncEventService],
})
export class SyncEventModule {}
