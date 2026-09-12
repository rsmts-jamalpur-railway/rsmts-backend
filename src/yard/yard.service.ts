import { Injectable, Logger, ConflictException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MovementsService } from '../movements/movements.service';
import { YardWorkflow } from './yard.workflow';
import { SyncEventService } from '../sync/sync-event.service';
import { SyncEntity, SyncAction } from '@prisma/client';
import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class IntakeAssetDto {
  @IsString()
  @IsNotEmpty()
  client_operation_id: string;

  @IsString()
  @IsNotEmpty()
  asset_number: string;

  @IsString()
  @IsNotEmpty()
  category_id: string; // e.g. BOXNHL

  @IsString()
  @IsNotEmpty()
  from_railway: string;
}

export class DispatchAssetDto {
  @IsString()
  @IsNotEmpty()
  client_operation_id: string;

  @IsString()
  @IsNotEmpty()
  asset_number: string;

  @IsString()
  @IsNotEmpty()
  to_railway: string;
}

export class AllocateAssetDto {
  @IsString()
  @IsNotEmpty()
  client_operation_id: string;

  @IsOptional()
  @IsString()
  asset_id?: string;

  @IsOptional()
  @IsString()
  asset_number?: string;

  @IsString()
  @IsNotEmpty()
  shop_id: string;
}

export class CancelIntakeDto {
  @IsString()
  @IsNotEmpty()
  client_operation_id: string;

  @IsOptional()
  @IsString()
  asset_id?: string;

  @IsOptional()
  @IsString()
  asset_number?: string;
}

export class UpdateAssetDto {
  @IsString()
  @IsNotEmpty()
  client_operation_id: string;

  @IsString()
  @IsNotEmpty()
  asset_id: string;

  @IsOptional()
  @IsString()
  asset_number?: string;

  @IsOptional()
  @IsString()
  railway_zone?: string;

  @IsOptional()
  @IsString()
  track_line?: string;

  @IsOptional()
  @IsString()
  train_number?: string;

  @IsOptional()
  @IsString()
  remarks?: string;

  @IsOptional()
  @IsString()
  condition?: string;
}

@Injectable()
export class YardService {
  private readonly logger = new Logger(YardService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly movementsService: MovementsService,
    private readonly syncEventService: SyncEventService,
  ) {}

  async intakeAsset(userId: string, assignedLocationId: string | undefined, data: IntakeAssetDto & { assigned_location?: string }, userRoles?: string[]) {
    const isGlobalAdmin = !assignedLocationId || userRoles?.includes('SYSTEM_ADMIN');
    if (!isGlobalAdmin && assignedLocationId !== 'YARD' && assignedLocationId !== 'NSY') {
      throw new ForbiddenException('User is not scoped to operate in the YARD.');
    }

    const targetLocation = data.assigned_location || 'NSY';

    return await this.prisma.$transaction(async (tx) => {
      // 1. Idempotency Check
      const existingMovement = await tx.movementLog.findUnique({
        where: { client_operation_id: data.client_operation_id }
      });

      if (existingMovement) {
        if (existingMovement.to_location === targetLocation && existingMovement.remarks?.includes(data.from_railway || '')) {
          return { message: 'Idempotent success', log_id: existingMovement.log_id };
        }
        throw new ConflictException('Client operation ID exists with different payload.');
      }

      // 2. Asset State Check & Lock
      let asset = await tx.asset.findUnique({
        where: { asset_number: data.asset_number }
      });

      YardWorkflow.validateIntake(asset ? asset.current_status : null);

      if (!asset) {
        asset = await tx.asset.create({
          data: {
            asset_number: data.asset_number,
            category_id: data.category_id,
            current_location: targetLocation,
            current_status: 'RECEIVED_IN_YARD'
          }
        });
        await this.syncEventService.record(tx, SyncEntity.ASSET, SyncAction.CREATED, asset.id, asset);
      } else {
        asset = await tx.asset.update({
          where: { id: asset.id },
          data: {
            current_location: targetLocation,
            current_status: 'RECEIVED_IN_YARD'
          }
        });
        await this.syncEventService.record(tx, SyncEntity.ASSET, SyncAction.UPDATED, asset.id, asset);
      }

      // 3. Movement Log (with client_operation_id)
      const movement = await tx.movementLog.create({
        data: {
          client_operation_id: data.client_operation_id,
          asset_id: asset.id,
          from_location: undefined,
          to_location: targetLocation,
          previous_status: undefined,
          new_status: 'RECEIVED_IN_YARD',
          handled_by: userId,
          remarks: `Intake from ${data.from_railway || 'Zonal Railway'} to ${targetLocation}`,
          timestamp: new Date()
        }
      });

      await this.syncEventService.record(tx, SyncEntity.MOVEMENT_LOG, SyncAction.CREATED, movement.log_id, movement);

      this.logger.log(`Intake completed for ${data.asset_number}`);
      return movement;
    });
  }

  async dispatchAsset(userId: string, assignedLocationId: string | undefined, data: DispatchAssetDto, userRoles?: string[]) {
    const isGlobalAdmin = !assignedLocationId || userRoles?.includes('SYSTEM_ADMIN');
    if (!isGlobalAdmin && assignedLocationId !== 'YARD' && assignedLocationId !== 'NSY' && assignedLocationId !== 'Trial Yard') {
      throw new ForbiddenException('User is not scoped to operate in the YARD.');
    }

    return await this.prisma.$transaction(async (tx) => {
      // 1. Idempotency Check
      const existingMovement = await tx.movementLog.findUnique({
        where: { client_operation_id: data.client_operation_id }
      });

      if (existingMovement) {
        if (existingMovement.to_location === 'EXTERNAL_RAILWAY' && existingMovement.remarks?.includes(data.to_railway)) {
          return { message: 'Idempotent success', log_id: existingMovement.log_id };
        }
        throw new ConflictException('Client operation ID exists with different payload.');
      }

      // 2. Asset State Check
      const asset = await tx.asset.findUnique({
        where: { asset_number: data.asset_number },
        include: { exceptions: { where: { status: 'OPEN' } } }
      });

      if (!asset) throw new ConflictException('Asset not found');

      YardWorkflow.validateDispatch(asset.current_status, asset.exceptions.length);

      const updatedAsset = await tx.asset.update({
        where: { id: asset.id },
        data: {
          current_location: null,
          current_status: 'DISPATCHED'
        }
      });

      await this.syncEventService.record(tx, SyncEntity.ASSET, SyncAction.UPDATED, updatedAsset.id, updatedAsset);

      // 3. Movement Log
      const movement = await tx.movementLog.create({
        data: {
          client_operation_id: data.client_operation_id,
          asset_id: asset.id,
          from_location: asset.current_location,
          to_location: 'EXTERNAL_RAILWAY',
          previous_status: asset.current_status,
          new_status: 'DISPATCHED',
          handled_by: userId,
          remarks: `Dispatched to ${data.to_railway}`,
          timestamp: new Date()
        }
      });

      await this.syncEventService.record(tx, SyncEntity.MOVEMENT_LOG, SyncAction.CREATED, movement.log_id, movement);

      this.logger.log(`Dispatch completed for ${data.asset_number}`);
      return movement;
    });
  }

  async allocateAsset(userId: string, data: AllocateAssetDto) {
    return await this.prisma.$transaction(async (tx) => {
      const existingMovement = await tx.movementLog.findUnique({
        where: { client_operation_id: data.client_operation_id }
      });
      if (existingMovement) {
        return { message: 'Idempotent success', log_id: existingMovement.log_id };
      }

      const asset = await tx.asset.findFirst({
        where: {
          OR: [
            { id: data.asset_id },
            { asset_number: data.asset_number }
          ]
        }
      });

      if (!asset) throw new ConflictException('Asset not found');

      const updatedAsset = await tx.asset.update({
        where: { id: asset.id },
        data: {
          current_location: data.shop_id,
          current_status: 'Allocated'
        }
      });
      await this.syncEventService.record(tx, SyncEntity.ASSET, SyncAction.UPDATED, updatedAsset.id, updatedAsset);

      const movement = await tx.movementLog.create({
        data: {
          client_operation_id: data.client_operation_id,
          asset_id: asset.id,
          from_location: 'YARD',
          to_location: data.shop_id,
          previous_status: asset.current_status,
          new_status: 'Allocated',
          handled_by: userId,
          remarks: `Allocated to ${data.shop_id}`,
          timestamp: new Date()
        }
      });
      await this.syncEventService.record(tx, SyncEntity.MOVEMENT_LOG, SyncAction.CREATED, movement.log_id, movement);

      return movement;
    });
  }

  async cancelIntake(userId: string, data: CancelIntakeDto) {
    return await this.prisma.$transaction(async (tx) => {
      const existingMovement = await tx.movementLog.findUnique({
        where: { client_operation_id: data.client_operation_id }
      });
      if (existingMovement) {
        return { message: 'Idempotent success', log_id: existingMovement.log_id };
      }

      const asset = await tx.asset.findFirst({
        where: {
          OR: [
            { id: data.asset_id },
            { asset_number: data.asset_number }
          ]
        }
      });

      if (!asset) throw new ConflictException('Asset not found');

      const updatedAsset = await tx.asset.update({
        where: { id: asset.id },
        data: {
          current_status: 'Cancelled Entry'
        }
      });
      await this.syncEventService.record(tx, SyncEntity.ASSET, SyncAction.UPDATED, updatedAsset.id, updatedAsset);

      const movement = await tx.movementLog.create({
        data: {
          client_operation_id: data.client_operation_id,
          asset_id: asset.id,
          from_location: 'YARD',
          to_location: 'YARD',
          previous_status: asset.current_status,
          new_status: 'Cancelled Entry',
          handled_by: userId,
          remarks: `Entry cancelled by Yard Master`,
          timestamp: new Date()
        }
      });
      await this.syncEventService.record(tx, SyncEntity.MOVEMENT_LOG, SyncAction.CREATED, movement.log_id, movement);

      return movement;
    });
  }

  async updateAsset(userId: string, data: UpdateAssetDto) {
    return await this.prisma.$transaction(async (tx) => {
      // 1. Idempotency Check (we can use the sync event or log for this, but for update, it's fine)
      const asset = await tx.asset.findUnique({
        where: { id: data.asset_id }
      });

      if (!asset) throw new ConflictException('Asset not found');

      const customFields = (asset.custom_fields as Record<string, any>) || {};
      
      if (data.railway_zone !== undefined) customFields.railway_zone = data.railway_zone;
      if (data.track_line !== undefined) customFields.track_line = data.track_line;
      if (data.train_number !== undefined) customFields.train_number = data.train_number;
      if (data.remarks !== undefined) customFields.remarks = data.remarks;
      if (data.condition !== undefined) customFields.condition = data.condition;

      const updatedAsset = await tx.asset.update({
        where: { id: asset.id },
        data: {
          asset_number: data.asset_number || asset.asset_number,
          custom_fields: customFields
        }
      });

      await this.syncEventService.record(tx, SyncEntity.ASSET, SyncAction.UPDATED, updatedAsset.id, updatedAsset);

      return updatedAsset;
    });
  }
}
