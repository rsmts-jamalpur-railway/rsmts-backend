import { Injectable, Logger, BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MovementsService } from '../movements/movements.service';
import { RepairWorkflow } from './repair.workflow';

export class StartRepairDto {
  client_operation_id: string;
  asset_id: string;
  repair_category_id: string;
  shop_id: string;
}

export class CloseRepairDto {
  client_operation_id: string;
  cycle_id: string;
  final_remarks?: string;
}

export class RepairHoldDto {
  client_operation_id: string;
  cycle_id: string;
  reason: string;
  remarks?: string;
}

@Injectable()
export class RepairService {
  private readonly logger = new Logger(RepairService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly movementsService: MovementsService
  ) {}

  async startRepair(userId: string, assignedLocationId: string | undefined, data: StartRepairDto) {
    if (assignedLocationId !== data.shop_id && assignedLocationId !== 'YARD') {
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
      await tx.movementLog.create({
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

      this.logger.log(`Started repair cycle ${cycle.cycle_id} for asset ${data.asset_id}`);
      return cycle;
    });
  }

  async closeRepair(userId: string, assignedLocationId: string | undefined, data: CloseRepairDto) {
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
      
      if (assignedLocationId !== cycle.asset.current_location && assignedLocationId !== 'YARD') {
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
          current_status: 'AWAITING_DISPATCH'
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

      this.logger.log(`Closed repair cycle ${cycle.cycle_id}. TAT: ${actualTatHours}h`);
      return movement;
    });
  }

  async putOnHold(userId: string, data: RepairHoldDto) {
    return await this.prisma.$transaction(async (tx) => {
      // 1. Idempotency Check
      const existingHold = await tx.repairHold.findUnique({
        where: { client_operation_id: data.client_operation_id }
      });
      if (existingHold) {
        if (existingHold.repair_cycle_id === data.cycle_id) {
          return { message: 'Idempotent success', hold_id: existingHold.id };
        }
        throw new ConflictException('Client operation ID exists with different payload.');
      }

      // 2. Validate
      const cycle = await tx.repairCycle.findUnique({
        where: { cycle_id: data.cycle_id },
        include: { holds: { where: { released_at: null } } }
      });

      if (!cycle) throw new BadRequestException('Cycle not found');
      RepairWorkflow.validateHold(cycle.status);

      if (cycle.holds.length > 0) {
        throw new ConflictException('Repair cycle is already on hold.');
      }

      // 3. Mutate
      const hold = await tx.repairHold.create({
        data: {
          client_operation_id: data.client_operation_id,
          repair_cycle_id: data.cycle_id,
          reason: data.reason,
          remarks: data.remarks,
          created_by: userId
        }
      });

      return hold;
    });
  }

  async resumeRepair(userId: string, data: RepairHoldDto) {
    return await this.prisma.$transaction(async (tx) => {
      // We use the same DTO schema. For resume, the idempotency logic differs slightly: 
      // the operation id represents the "release" action.
      // Wait, there is no client_operation_id on the release event, we update the existing row.
      // Let's rely on finding the open hold. If it's already released, it might be idempotent.
      const cycle = await tx.repairCycle.findUnique({
        where: { cycle_id: data.cycle_id },
        include: { holds: { where: { released_at: null } } }
      });

      if (!cycle) throw new BadRequestException('Cycle not found');
      if (cycle.holds.length === 0) {
        // Idempotency: if already resumed recently... we can just return ok.
        return { message: 'Already resumed' };
      }

      RepairWorkflow.validateResume(cycle.status, cycle.holds.length > 0);

      const hold = await tx.repairHold.update({
        where: { id: cycle.holds[0].id },
        data: {
          released_at: new Date(),
          released_by: userId
        }
      });

      return hold;
    });
  }
}
