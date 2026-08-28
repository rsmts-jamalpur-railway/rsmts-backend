import { Injectable, Logger, ConflictException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MovementsService } from '../movements/movements.service';
import { YardWorkflow } from './yard.workflow';

export class IntakeAssetDto {
  client_operation_id: string;
  asset_number: string;
  category_id: string; // e.g. BOXNHL
  from_railway: string;
}

export class DispatchAssetDto {
  client_operation_id: string;
  asset_number: string;
  to_railway: string;
}

@Injectable()
export class YardService {
  private readonly logger = new Logger(YardService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly movementsService: MovementsService
  ) {}

  async intakeAsset(userId: string, assignedLocationId: string | undefined, data: IntakeAssetDto) {
    if (assignedLocationId !== 'YARD') {
      throw new ForbiddenException('User is not scoped to operate in the YARD.');
    }

    return await this.prisma.$transaction(async (tx) => {
      // 1. Idempotency Check
      const existingMovement = await tx.movementLog.findUnique({
        where: { client_operation_id: data.client_operation_id }
      });

      if (existingMovement) {
        if (existingMovement.to_location === 'YARD' && existingMovement.remarks?.includes(data.from_railway)) {
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
            current_location: 'YARD',
            current_status: 'RECEIVED_IN_YARD'
          }
        });
      } else {
        asset = await tx.asset.update({
          where: { id: asset.id },
          data: {
            current_location: 'YARD',
            current_status: 'RECEIVED_IN_YARD'
          }
        });
      }

      // 3. Movement Log (with client_operation_id)
      const movement = await tx.movementLog.create({
        data: {
          client_operation_id: data.client_operation_id,
          asset_id: asset.id,
          from_location: undefined,
          to_location: 'YARD',
          previous_status: undefined,
          new_status: 'RECEIVED_IN_YARD',
          handled_by: userId,
          remarks: `Intake from ${data.from_railway}`,
          timestamp: new Date()
        }
      });

      this.logger.log(`Intake completed for ${data.asset_number}`);
      return movement;
    });
  }

  async dispatchAsset(userId: string, assignedLocationId: string | undefined, data: DispatchAssetDto) {
    if (assignedLocationId !== 'YARD') {
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

      this.logger.log(`Dispatch completed for ${data.asset_number}`);
      return movement;
    });
  }
}
