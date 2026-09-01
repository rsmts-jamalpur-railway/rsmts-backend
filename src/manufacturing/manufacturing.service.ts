import { Injectable, Logger, BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MovementsService } from '../movements/movements.service';
import { ManufacturingWorkflow } from './manufacturing.workflow';
import { SyncEventService } from '../sync/sync-event.service';
import { SyncEntity, SyncAction } from '@prisma/client';

export class StartManufacturingDto {
  client_operation_id: string;
  asset_number: string; // The planned asset number to be manufactured
  category_id: string; // e.g. 140T_CRANE
  shop_id: string; // e.g. GIF
}

export class CloseManufacturingDto {
  client_operation_id: string;
  order_id: string;
}

@Injectable()
export class ManufacturingService {
  private readonly logger = new Logger(ManufacturingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly movementsService: MovementsService,
    private readonly syncEventService: SyncEventService,
  ) {}

  async startManufacturing(userId: string, assignedLocationId: string | undefined, data: StartManufacturingDto) {
    if (assignedLocationId !== data.shop_id && assignedLocationId !== 'YARD') {
      throw new ForbiddenException(`User is not scoped to manufacture at ${data.shop_id}.`);
    }

    return await this.prisma.$transaction(async (tx) => {
      // 1. Idempotency Check
      const existingOrder = await tx.manufacturingOrder.findUnique({
        where: { client_operation_id: data.client_operation_id },
        include: { asset: true }
      });

      if (existingOrder) {
        if (existingOrder.asset.asset_number === data.asset_number) {
          return { message: 'Idempotent success', order_id: existingOrder.order_id };
        }
        throw new ConflictException('Client operation ID exists with different payload.');
      }

      // 2. State & Asset Check
      let asset = await tx.asset.findUnique({
        where: { asset_number: data.asset_number }
      });
      ManufacturingWorkflow.validateStart(!!asset);

      // 3. Capacity Locking
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

      // 4. Create Asset & Operation
      asset = await tx.asset.create({
        data: {
          asset_number: data.asset_number,
          category_id: data.category_id,
          current_location: data.shop_id,
          current_status: 'IN_MANUFACTURING'
        }
      });

      const order = await tx.manufacturingOrder.create({
        data: {
          client_operation_id: data.client_operation_id,
          asset_id: asset.id,
          production_type: 'NEW',
          built_by_shop: data.shop_id,
          status: 'ACTIVE',
          started_at: new Date()
        }
      });

      const movement = await tx.movementLog.create({
        data: {
          client_operation_id: data.client_operation_id + '-move',
          asset_id: asset.id,
          to_location: data.shop_id,
          new_status: 'IN_MANUFACTURING',
          manufacturing_order_id: order.order_id,
          handled_by: userId,
          remarks: 'Manufacturing initialized',
          timestamp: new Date()
        }
      });

      await this.syncEventService.record(tx, SyncEntity.ASSET, SyncAction.CREATED, asset.id, asset);
      await this.syncEventService.record(tx, SyncEntity.MANUFACTURING_ORDER, SyncAction.CREATED, order.order_id, order);
      await this.syncEventService.record(tx, SyncEntity.MOVEMENT_LOG, SyncAction.CREATED, movement.log_id, movement);

      this.logger.log(`Started manufacturing order ${order.order_id} for asset ${asset.asset_number}`);
      return order;
    });
  }

  async closeManufacturing(userId: string, assignedLocationId: string | undefined, data: CloseManufacturingDto) {
    return await this.prisma.$transaction(async (tx) => {
      // 1. Idempotency Check
      const existingMovement = await tx.movementLog.findUnique({
        where: { client_operation_id: data.client_operation_id }
      });
      if (existingMovement) {
        if (existingMovement.manufacturing_order_id === data.order_id) {
          return { message: 'Idempotent success', log_id: existingMovement.log_id };
        }
        throw new ConflictException('Client operation ID exists with different payload.');
      }

      // 2. Fetch State & Validate
      const order = await tx.manufacturingOrder.findUnique({
        where: { order_id: data.order_id },
        include: { asset: true }
      });

      if (!order) throw new BadRequestException('Order not found');
      
      if (assignedLocationId !== order.asset.current_location && assignedLocationId !== 'YARD') {
        throw new ForbiddenException('User is not scoped to close manufacturing for this location.');
      }

      ManufacturingWorkflow.validateComplete(order.status);

      // 3. Mutate State
      await tx.manufacturingOrder.update({
        where: { order_id: data.order_id },
        data: {
          status: 'COMPLETED',
          completed_at: new Date()
        }
      });

      await tx.asset.update({
        where: { id: order.asset_id },
        data: {
          current_location: 'YARD',
          current_status: 'PENDING_QA'
        }
      });

      const movement = await tx.movementLog.create({
        data: {
          client_operation_id: data.client_operation_id,
          asset_id: order.asset_id,
          from_location: order.asset.current_location || undefined,
          to_location: 'YARD',
          previous_status: order.asset.current_status || undefined,
          new_status: 'AWAITING_DISPATCH',
          handled_by: userId,
          manufacturing_order_id: order.order_id,
          remarks: 'Manufacturing completed, moved to Yard',
          timestamp: new Date()
        }
      });

      await this.syncEventService.record(tx, SyncEntity.MANUFACTURING_ORDER, SyncAction.UPDATED, data.order_id, { status: 'COMPLETED', completed_at: new Date() });
      await this.syncEventService.record(tx, SyncEntity.ASSET, SyncAction.UPDATED, order.asset_id, { current_location: 'YARD', current_status: 'PENDING_QA' });
      await this.syncEventService.record(tx, SyncEntity.MOVEMENT_LOG, SyncAction.CREATED, movement.log_id, movement);

      this.logger.log(`Closed manufacturing order ${order.order_id}`);
      return movement;
    });
  }
}
