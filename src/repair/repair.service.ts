import { Injectable, Logger, BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MovementsService } from '../movements/movements.service';
import { RepairWorkflow } from './repair.workflow';
import { SyncEventService } from '../sync/sync-event.service';
import { SyncEntity, SyncAction } from '@prisma/client';

import { IsOptional, IsString, IsNotEmpty } from 'class-validator';

export class StartRepairDto {
  @IsString()
  @IsNotEmpty()
  client_operation_id: string;

  @IsString()
  @IsNotEmpty()
  asset_id: string;

  @IsString()
  @IsNotEmpty()
  repair_category_id: string;

  @IsString()
  @IsNotEmpty()
  shop_id: string;
}

export class CloseRepairDto {
  @IsString()
  @IsNotEmpty()
  client_operation_id: string;

  @IsString()
  @IsNotEmpty()
  cycle_id: string;

  @IsOptional()
  @IsString()
  final_remarks?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class RepairHoldDto {
  @IsOptional()
  @IsString()
  client_operation_id?: string;

  @IsOptional()
  @IsString()
  cycle_id?: string;

  @IsOptional()
  @IsString()
  asset_id?: string;

  @IsOptional()
  @IsString()
  asset_number?: string;

  @IsOptional()
  @IsString()
  reason?: string;

  @IsOptional()
  @IsString()
  remarks?: string;
}

@Injectable()
export class RepairService {
  private readonly logger = new Logger(RepairService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly movementsService: MovementsService,
    private readonly syncEventService: SyncEventService,
  ) {}

  async startRepair(userId: string, assignedLocationId: string | undefined, data: StartRepairDto, userRoles?: string[]) {
    const isGlobalAdmin = !assignedLocationId || userRoles?.includes('SYSTEM_ADMIN');
    if (!isGlobalAdmin && assignedLocationId !== data.shop_id && assignedLocationId !== 'YARD' && assignedLocationId !== 'NSY') {
      throw new ForbiddenException(`User is not scoped to operate on ${data.shop_id}.`);
    }

    return await this.prisma.$transaction(async (tx) => {
      // 1. Idempotency Check
      const existingCycle = await tx.repairCycle.findUnique({
        where: { client_operation_id: data.client_operation_id }
      });
      if (existingCycle) {
        if (existingCycle.asset_id === data.asset_id) {
          return { message: 'Idempotent success', cycle_id: existingCycle.cycle_id };
        }
        throw new ConflictException('Client operation ID exists with different payload.');
      }

      // 2. Capacity Concurrency Lock (FOR UPDATE)
      // We lock the Location row to prevent race conditions exceeding capacity.
      const shops: any[] = await tx.$queryRaw`
        SELECT location_id, max_capacity 
        FROM "Location" 
        WHERE location_id = ${data.shop_id} 
        FOR UPDATE;
      `;
      if (shops.length === 0) throw new BadRequestException('Shop not found');
      
      const currentOccupancy = await tx.asset.count({
        where: { current_location: data.shop_id }
      });

      if (currentOccupancy >= shops[0].max_capacity) {
        throw new ConflictException('Shop is at maximum capacity.');
      }

      // 3. Asset State Validation
      const asset = await tx.asset.findUnique({
        where: { id: data.asset_id }
      });

      if (!asset) throw new BadRequestException('Asset not found');
      RepairWorkflow.validateStart(asset.current_status);

      // 4. Create Operation & Move
      const cycle = await tx.repairCycle.create({
        data: {
          client_operation_id: data.client_operation_id,
          asset_id: data.asset_id,
          repair_category_id: data.repair_category_id,
          status: 'ACTIVE',
          started_at: new Date()
        }
      });

      await tx.asset.update({
        where: { id: data.asset_id },
        data: {
          current_location: data.shop_id,
          current_status: 'IN_REPAIR'
        }
      });

      // We manually construct the movement payload instead of calling the external service
      // to ensure it happens inside the same transactional block.
      const movement = await tx.movementLog.create({
        data: {
          client_operation_id: data.client_operation_id + '-move',
          asset_id: data.asset_id,
          from_location: asset.current_location || undefined,
          to_location: data.shop_id,
          previous_status: asset.current_status || undefined,
          new_status: 'IN_REPAIR',
          repair_cycle_id: cycle.cycle_id,
          handled_by: userId,
          remarks: 'Moved to repair shop',
          timestamp: new Date()
        }
      });

      await this.syncEventService.record(tx, SyncEntity.REPAIR_CYCLE, SyncAction.CREATED, cycle.cycle_id, cycle);
      await this.syncEventService.record(tx, SyncEntity.ASSET, SyncAction.UPDATED, data.asset_id, { current_location: data.shop_id, current_status: 'IN_REPAIR' });
      await this.syncEventService.record(tx, SyncEntity.MOVEMENT_LOG, SyncAction.CREATED, movement.log_id, movement);

      this.logger.log(`Started repair cycle ${cycle.cycle_id} for asset ${data.asset_id}`);
      return cycle;
    });
  }

  async closeRepair(userId: string, assignedLocationId: string | undefined, data: CloseRepairDto, userRoles?: string[]) {
    return await this.prisma.$transaction(async (tx) => {
      // 1. Idempotency Check
      const existingMovement = await tx.movementLog.findUnique({
        where: { client_operation_id: data.client_operation_id }
      });
      if (existingMovement) {
        if (existingMovement.repair_cycle_id === data.cycle_id) {
          return { message: 'Idempotent success', log_id: existingMovement.log_id };
        }
        throw new ConflictException('Client operation ID exists with different payload.');
      }

      // 2. Fetch State & Validate
      const cycle = await tx.repairCycle.findUnique({
        where: { cycle_id: data.cycle_id },
        include: { asset: true, holds: { where: { released_at: null } } }
      });

      if (!cycle) throw new BadRequestException('Cycle not found');
      
      const isGlobalAdmin = !assignedLocationId || userRoles?.includes('SYSTEM_ADMIN');
      if (!isGlobalAdmin && assignedLocationId !== cycle.asset.current_location && assignedLocationId !== 'YARD') {
        throw new ForbiddenException('User is not scoped to close repair for this location.');
      }

      RepairWorkflow.validateComplete(cycle.status, cycle.holds.length > 0);

      // TAT Calculation
      const completedAt = new Date();
      let totalHoldMs = 0;
      const allHolds = await tx.repairHold.findMany({
        where: { repair_cycle_id: data.cycle_id, released_at: { not: null } }
      });
      allHolds.forEach(hold => {
        totalHoldMs += hold.released_at!.getTime() - hold.started_at.getTime();
      });
      
      const elapsedMs = completedAt.getTime() - cycle.started_at!.getTime();
      const actualTatHours = Math.max(0, Math.round((elapsedMs - totalHoldMs) / (1000 * 60 * 60)));

      // 3. Mutate State
      await tx.repairCycle.update({
        where: { cycle_id: data.cycle_id },
        data: {
          status: 'COMPLETED',
          completed_at: completedAt,
          actual_tat_hours: actualTatHours
        }
      });

      await tx.asset.update({
        where: { id: cycle.asset_id },
        data: {
          current_location: 'YARD',
          current_status: 'PENDING_QA'
        }
      });

      const movement = await tx.movementLog.create({
        data: {
          client_operation_id: data.client_operation_id,
          asset_id: cycle.asset_id,
          from_location: cycle.asset.current_location || undefined,
          to_location: 'YARD',
          previous_status: cycle.asset.current_status || undefined,
          new_status: 'AWAITING_DISPATCH',
          repair_cycle_id: cycle.cycle_id,
          handled_by: userId,
          remarks: data.final_remarks || 'Returned to yard post-repair',
          timestamp: new Date()
        }
      });

      await this.syncEventService.record(tx, SyncEntity.REPAIR_CYCLE, SyncAction.UPDATED, data.cycle_id, { status: 'COMPLETED', completed_at: completedAt, actual_tat_hours: actualTatHours });
      await this.syncEventService.record(tx, SyncEntity.ASSET, SyncAction.UPDATED, cycle.asset_id, { current_location: 'YARD', current_status: 'PENDING_QA' });
      await this.syncEventService.record(tx, SyncEntity.MOVEMENT_LOG, SyncAction.CREATED, movement.log_id, movement);

      this.logger.log(`Closed repair cycle ${cycle.cycle_id}. TAT: ${actualTatHours}h`);
      return movement;
    });
  }

  async putOnHold(userId: string, data: RepairHoldDto) {
    return await this.prisma.$transaction(async (tx) => {
      let cycleId = data.cycle_id;
      let targetAssetId = data.asset_id;

      if (!cycleId && (data.asset_number || data.asset_id)) {
        const asset = await tx.asset.findFirst({
          where: data.asset_number
            ? { asset_number: data.asset_number.trim().toUpperCase() }
            : { id: data.asset_id },
          include: { repair_cycles: { where: { status: 'ACTIVE' }, take: 1 } },
        });
        if (asset && asset.repair_cycles.length > 0) {
          cycleId = asset.repair_cycles[0].cycle_id;
          targetAssetId = asset.id;
        } else {
          throw new BadRequestException(`No active repair cycle found for ${data.asset_number || data.asset_id}`);
        }
      }

      if (!cycleId) throw new BadRequestException('Cycle ID or Asset identifier is required');

      const opId = data.client_operation_id || `hold-${cycleId}-${Date.now()}`;

      // 1. Idempotency Check
      const existingHold = await tx.repairHold.findUnique({
        where: { client_operation_id: opId },
      });
      if (existingHold) {
        if (existingHold.repair_cycle_id === cycleId) {
          return { message: 'Idempotent success', hold_id: existingHold.id };
        }
        throw new ConflictException('Client operation ID exists with different payload.');
      }

      // 2. Validate
      const cycle = await tx.repairCycle.findUnique({
        where: { cycle_id: cycleId },
        include: { holds: { where: { released_at: null } }, asset: true },
      });

      if (!cycle) throw new BadRequestException('Cycle not found');
      RepairWorkflow.validateHold(cycle.status);

      if (cycle.holds.length > 0) {
        throw new ConflictException('Repair cycle is already on hold.');
      }

      // 3. Mutate
      const hold = await tx.repairHold.create({
        data: {
          client_operation_id: opId,
          repair_cycle_id: cycleId,
          reason: data.reason || 'MATERIAL_SHORTAGE',
          remarks: data.remarks,
          created_by: userId,
        },
      });

      // Update asset current_status to ON_HOLD
      await tx.asset.update({
        where: { id: cycle.asset_id },
        data: { current_status: 'ON_HOLD' },
      });

      // Record movement log entry for hold event
      await tx.movementLog.create({
        data: {
          asset_id: cycle.asset_id,
          from_location: cycle.asset.current_location || 'NSY',
          to_location: cycle.asset.current_location || 'NSY',
          previous_status: cycle.asset.current_status || 'IN_REPAIR',
          new_status: 'ON_HOLD',
          handled_by: userId,
          remarks: `Placed on Hold: [${hold.reason}] ${data.remarks || ''}`.trim(),
          repair_cycle_id: cycleId,
          timestamp: new Date(),
          sync_status: 'Synced',
        },
      });

      await this.syncEventService.record(tx, SyncEntity.REPAIR_HOLD, SyncAction.CREATED, hold.id, hold);

      this.logger.log(`Placed cycle ${cycleId} on hold (${hold.reason})`);
      return hold;
    });
  }

  async resumeRepair(userId: string, data: RepairHoldDto) {
    return await this.prisma.$transaction(async (tx) => {
      let cycleId = data.cycle_id;

      if (!cycleId && (data.asset_number || data.asset_id)) {
        const asset = await tx.asset.findFirst({
          where: data.asset_number
            ? { asset_number: data.asset_number.trim().toUpperCase() }
            : { id: data.asset_id },
          include: { repair_cycles: { where: { status: 'ACTIVE' }, take: 1 } },
        });
        if (asset && asset.repair_cycles.length > 0) {
          cycleId = asset.repair_cycles[0].cycle_id;
        } else {
          throw new BadRequestException(`No active repair cycle found for ${data.asset_number || data.asset_id}`);
        }
      }

      if (!cycleId) throw new BadRequestException('Cycle ID or Asset identifier is required');

      const cycle = await tx.repairCycle.findUnique({
        where: { cycle_id: cycleId },
        include: { holds: { where: { released_at: null } }, asset: true },
      });

      if (!cycle) throw new BadRequestException('Cycle not found');
      if (cycle.holds.length === 0) {
        return { message: 'Already resumed' };
      }

      RepairWorkflow.validateResume(cycle.status, cycle.holds.length > 0);

      const hold = await tx.repairHold.update({
        where: { id: cycle.holds[0].id },
        data: {
          released_at: new Date(),
          released_by: userId,
        },
      });

      // Restore asset status to IN_REPAIR
      await tx.asset.update({
        where: { id: cycle.asset_id },
        data: { current_status: 'IN_REPAIR' },
      });

      // Record movement log entry for resume event
      await tx.movementLog.create({
        data: {
          asset_id: cycle.asset_id,
          from_location: cycle.asset.current_location || 'NSY',
          to_location: cycle.asset.current_location || 'NSY',
          previous_status: 'ON_HOLD',
          new_status: 'IN_REPAIR',
          handled_by: userId,
          remarks: `Resumed repair cycle from hold: [${hold.reason}]`,
          repair_cycle_id: cycleId,
          timestamp: new Date(),
          sync_status: 'Synced',
        },
      });

      await this.syncEventService.record(tx, SyncEntity.REPAIR_HOLD, SyncAction.UPDATED, hold.id, hold);

      this.logger.log(`Resumed cycle ${cycleId} from hold`);
      return hold;
    });
  }
}
