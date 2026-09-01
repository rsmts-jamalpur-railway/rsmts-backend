import { Injectable } from '@nestjs/common';
import { PrismaClient, SyncEntity, SyncAction } from '@prisma/client';

export type PrismaTransaction = Omit<PrismaClient, "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends">;

@Injectable()
export class SyncEventService {
  /**
   * Records a synchronization event inside an existing Prisma transaction.
   * This is explicitly called by Domain Services to ensure they represent
   * intentional business operations.
   * 
   * @param tx The active Prisma transaction client
   * @param entityType The entity type being synchronized (e.g. ASSET, REPAIR_CYCLE)
   * @param action The action performed (CREATED, UPDATED, DELETED)
   * @param recordId The UUID of the primary record
   * @param payload The complete snapshot of the record for the Sync Ledger
   */
  async record(
    tx: PrismaTransaction,
    entityType: SyncEntity,
    action: SyncAction,
    recordId: string,
    payload: any,
  ) {
    // If the action is DELETED, the payload just contains the ID to save space
    const finalPayload = action === SyncAction.DELETED 
      ? { id: recordId, action: 'DELETED' } 
      : payload;

    await tx.syncEvent.create({
      data: {
        entity_type: entityType,
        action: action,
        record_id: recordId,
        payload: finalPayload,
      },
    });
  }
}
