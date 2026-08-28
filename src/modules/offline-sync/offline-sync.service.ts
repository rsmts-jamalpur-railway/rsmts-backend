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
        user: { select: { full_name: true, email: true } },
      },
      orderBy: { last_sync: 'desc' },
    });
  }

  async pullChanges(lastPulledAt: number, currentUserId: string) {
    const validTime = (lastPulledAt && !isNaN(lastPulledAt)) ? lastPulledAt : 0;
    const lastPulledDate = new Date(validTime);
    const isFirstSync = validTime === 0;

    // Assets have both createdAt and updatedAt
    const assetsRaw = await this.prisma.asset.findMany({
      where: { updatedAt: { gt: lastPulledDate } },
    });
    const createdAssets = isFirstSync ? assetsRaw : assetsRaw.filter(a => a.createdAt > lastPulledDate);
    const updatedAssets = isFirstSync ? [] : assetsRaw.filter(a => a.createdAt <= lastPulledDate);

    // Movement Logs are immutable and only have createdAt
    const createdLogs = await this.prisma.movementLog.findMany({
      where: { createdAt: { gt: lastPulledDate } },
    });

    // Locations have no timestamps, so we fetch all.
    // If it's not the first sync, we treat them as updated (note: new locations added post-launch might need schema updates to sync properly)
    const locationsRaw = await this.prisma.location.findMany();
    const createdLocations = isFirstSync ? locationsRaw : [];
    const updatedLocations = isFirstSync ? [] : locationsRaw;

    // Settings only have updatedAt
    const settingsRaw = await this.prisma.setting.findMany({
      where: validTime > 0 ? { updatedAt: { gt: lastPulledDate } } : undefined
    });
    const createdSettings = isFirstSync ? settingsRaw : [];
    const updatedSettings = isFirstSync ? [] : settingsRaw;

    return {
      changes: {
        assets: {
          created: createdAssets,
          updated: updatedAssets,
          deleted: [], // We use soft deletes
        },
        movement_logs: {
          created: createdLogs,
          updated: updatedLogs,
          deleted: [],
        },
        locations: {
          created: createdLocations,
          updated: updatedLocations,
          deleted: [],
        },
        settings: {
          created: createdSettings,
          updated: updatedSettings,
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
    // Process Created Assets
    if (changes?.assets?.created?.length > 0) {
      for (const asset of changes.assets.created) {
        try {
          await this.prisma.asset.upsert({
            where: { asset_number: asset.asset_number },
            create: {
              asset_number: asset.asset_number,
              asset_category: asset.asset_category || 'WAGON',
              asset_type: asset.asset_type || 'UNKNOWN',
              origin: asset.origin || 'REPAIR',
              current_status: asset.current_status || 'NSY IN',
              current_location: asset.current_location || 'NSY',
              nsy_in_date: asset.nsy_in_date ? new Date(asset.nsy_in_date) : new Date(),
              is_active: asset.is_active ?? true,
              loco_type: asset.loco_type,
              crane_age_tag: asset.crane_age_tag,
              tc_variant: asset.tc_variant,
              tc_zone: asset.tc_zone,
            },
            update: {
              current_status: asset.current_status,
              current_location: asset.current_location,
              is_active: asset.is_active,
            }
          });
        } catch (error) {
          console.error('Failed to sync created asset:', error);
        }
      }
    }

    // Process Updated Assets
    if (changes?.assets?.updated?.length > 0) {
      for (const asset of changes.assets.updated) {
        try {
          await this.prisma.asset.update({
            where: { asset_number: asset.asset_number },
            data: {
              current_status: asset.current_status,
              current_location: asset.current_location,
              allocated_shop: asset.allocated_shop,
              is_active: asset.is_active,
              loco_type: asset.loco_type,
              crane_age_tag: asset.crane_age_tag,
              tc_variant: asset.tc_variant,
              tc_zone: asset.tc_zone,
            },
          });
        } catch (error) {
          console.error('Failed to sync updated asset:', error);
        }
      }
    }

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
              timestamp: log.timestamp,
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
