import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { SyncPushDto } from './dto/sync.dto';
import { MovementService } from '../movement/movement.service';
import { AuditService } from '../../shared/audit/audit.service';

@Injectable()
export class OfflineSyncService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly movementService: MovementService,
    private readonly audit: AuditService,
  ) {}

  async getSyncStatus() {
    return this.prisma.device.findMany({
      include: {
        user: { select: { full_name: true, employee_id: true } }
      },
      orderBy: { last_sync: 'desc' }
    });
  }

  async pullChanges(lastPulledAt: number, currentUserId: string) {
    const lastPulledDate = new Date(lastPulledAt);

    // Fetch changes for assets and movement_logs since lastPulledDate
    const updatedAssets = await this.prisma.asset.findMany({
      where: { updatedAt: { gt: lastPulledDate } },
    });

    const newMovementLogs = await this.prisma.movementLog.findMany({
      where: { createdAt: { gt: lastPulledDate } },
    });

    return {
      changes: {
        assets: {
          created: [], // Assuming assets are created on server, but synced down as updated for simplicity
          updated: updatedAssets,
          deleted: [], // We use soft deletes
        },
        movement_logs: {
          created: newMovementLogs,
          updated: [],
          deleted: [],
        },
      },
      timestamp: Date.now(),
    };
  }

  async pushChanges(dto: SyncPushDto, currentUserId: string) {
    const { changes, last_pulled_at } = dto;
    const lastPulledDate = new Date(last_pulled_at);

    // In a full implementation, we'd iterate over changes.movement_logs.created
    // and apply them via MovementService to ensure validation and transactions.
    // For this boilerplate, we'll process created movement_logs.

    if (changes?.movement_logs?.created?.length > 0) {
      for (const log of changes.movement_logs.created) {
        // Attempt to apply the movement
        try {
          await this.movementService.recordMovement(
            {
              asset_number: log.asset_number,
              new_status: log.new_status,
              to_location: log.to_location,
              remarks: log.remarks,
              is_offline_entry: true,
            },
            currentUserId,
          );
        } catch (error) {
          // Log conflict / failure
          await this.audit.logAction(currentUserId, 'SYNC_CONFLICT', {
            log,
            error: error.message,
          });
          // Note: Real world WatermelonDB handles conflicts gracefully. We'll skip failed ones.
        }
      }
    }

    // Update Device sync timestamp
    await this.prisma.device.updateMany({
      where: { user_id: currentUserId },
      data: { last_sync: new Date() },
    });

    return { success: true };
  }
}
