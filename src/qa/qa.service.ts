import { Injectable, Logger, ConflictException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { QaWorkflow } from './qa.workflow';
import { SyncEventService } from '../sync/sync-event.service';
import { SyncEntity, SyncAction } from '@prisma/client';

export class SubmitInspectionDto {
  client_operation_id: string;
  asset_id?: string;
  asset_number?: string;
  repair_cycle_id?: string;
  manufacturing_order_id?: string;
  result: string; // 'FIT', 'MINOR_FIX', 'NOT_FIT', 'CONDEMNATION_REQUEST'
  remarks?: string;
}

@Injectable()
export class QaService {
  private readonly logger = new Logger(QaService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly syncEventService: SyncEventService,
  ) {}

  async submitInspection(userId: string, data: SubmitInspectionDto) {
    QaWorkflow.validateInspection(data.repair_cycle_id, data.manufacturing_order_id);
    QaWorkflow.validateResult(data.result);

    if (!data.asset_id && !data.asset_number) {
      throw new BadRequestException('Must provide either asset_id or asset_number for identity reconciliation.');
    }

    return await this.prisma.$transaction(async (tx) => {
      // 1. Idempotency Check
      const existingInspection = await tx.qAInspection.findUnique({
        where: { client_operation_id: data.client_operation_id }
      });
      if (existingInspection) {
        if (existingInspection.result === data.result) {
          return { message: 'Idempotent success', inspection_id: existingInspection.id, asset_id: existingInspection.asset_id };
        }
        throw new ConflictException('Client operation ID exists with different payload.');
      }

      // 2. Identity Reconciliation
      let asset;
      if (data.asset_id) {
        asset = await tx.asset.findUnique({ where: { id: data.asset_id } });
      } else {
        asset = await tx.asset.findUnique({ where: { asset_number: data.asset_number } });
      }

      if (!asset) {
        throw new BadRequestException('Asset not found. Cannot perform QA on unknown asset.');
      }
      
      const serverAssetId = asset.id;

      let repairCycle: any = null;
      if (data.repair_cycle_id) {
        repairCycle = await tx.repairCycle.findUnique({ where: { cycle_id: data.repair_cycle_id } });
        if (!repairCycle) throw new BadRequestException('Repair cycle not found');
      }

      let mfgOrder: any = null;
      if (data.manufacturing_order_id) {
        mfgOrder = await tx.manufacturingOrder.findUnique({ where: { order_id: data.manufacturing_order_id } });
        if (!mfgOrder) throw new BadRequestException('Manufacturing order not found');
      }

      // 3. Insert Inspection
      const inspection = await tx.qAInspection.create({
        data: {
          client_operation_id: data.client_operation_id,
          asset_id: serverAssetId,
          repair_cycle_id: data.repair_cycle_id || null,
          manufacturing_order_id: data.manufacturing_order_id || null,
          inspector_id: userId,
          inspection_type: 'FINAL',
          result: data.result,
          remarks: data.remarks
        }
      });

      await this.syncEventService.record(tx, SyncEntity.QA_INSPECTION, SyncAction.CREATED, inspection.id, inspection);

      // 4. State Transitions and Side Effects
      let newAssetStatus = asset.current_status;
      let newLocation = asset.current_location;
      
      if (data.result === 'FIT') {
        newAssetStatus = 'FIT';
        newLocation = 'YARD';

        const fitCert = await tx.fitCertificate.create({
          data: {
            inspection_id: inspection.id,
            certificate_number: `FC-${data.client_operation_id.substring(0, 8).toUpperCase()}-${Date.now()}`,
            issued_by: userId,
          }
        });
        await this.syncEventService.record(tx, SyncEntity.FIT_CERTIFICATE, SyncAction.CREATED, fitCert.id, fitCert);
        this.logger.log(`Asset ${serverAssetId} FIT. FitCertificate issued.`);
        
      } else if (data.result === 'MINOR_FIX' || data.result === 'NOT_FIT') {
        if (data.repair_cycle_id && repairCycle) {
          newAssetStatus = 'IN_REPAIR';
          await tx.repairCycle.update({
            where: { cycle_id: data.repair_cycle_id },
            data: { status: 'IN_PROGRESS', completed_at: null }
          });
          await this.syncEventService.record(tx, SyncEntity.REPAIR_CYCLE, SyncAction.UPDATED, data.repair_cycle_id, { status: 'IN_PROGRESS', completed_at: null });
        } else if (data.manufacturing_order_id && mfgOrder) {
          newAssetStatus = 'IN_MANUFACTURING';
          await tx.manufacturingOrder.update({
            where: { order_id: data.manufacturing_order_id },
            data: { status: 'ACTIVE', completed_at: null }
          });
          await this.syncEventService.record(tx, SyncEntity.MANUFACTURING_ORDER, SyncAction.UPDATED, data.manufacturing_order_id, { status: 'ACTIVE', completed_at: null });
        }
      } else if (data.result === 'CONDEMNATION_REQUEST') {
        newAssetStatus = 'CONDEMNATION_REQUESTED';
        const exception = await tx.exception.create({
          data: {
            asset_id: serverAssetId,
            type: 'CONDEMNATION_APPROVAL_REQUIRED',
            status: 'OPEN',
            severity: 'CRITICAL',
            reason: `QA requested condemnation for asset ${serverAssetId}. Remarks: ${data.remarks}`,
            reported_by: userId
          }
        });
        await this.syncEventService.record(tx, SyncEntity.EXCEPTION, SyncAction.CREATED, exception.id, exception);
        this.logger.log(`Asset ${serverAssetId} requested for CONDEMNATION. Exception raised.`);
      }

      // Update Asset
      await tx.asset.update({
        where: { id: serverAssetId },
        data: {
          current_status: newAssetStatus,
          current_location: newLocation
        }
      });
      await this.syncEventService.record(tx, SyncEntity.ASSET, SyncAction.UPDATED, serverAssetId, { current_status: newAssetStatus, current_location: newLocation });

      // Create MovementLog for the QA outcome
      const movement = await tx.movementLog.create({
        data: {
          client_operation_id: data.client_operation_id + '-qa',
          asset_id: serverAssetId,
          from_location: asset.current_location,
          to_location: newLocation,
          previous_status: asset.current_status,
          new_status: newAssetStatus,
          repair_cycle_id: data.repair_cycle_id || null,
          manufacturing_order_id: data.manufacturing_order_id || null,
          handled_by: userId,
          remarks: `QA Result: ${data.result}. Remarks: ${data.remarks}`,
          timestamp: new Date()
        }
      });
      await this.syncEventService.record(tx, SyncEntity.MOVEMENT_LOG, SyncAction.CREATED, movement.log_id, movement);

      return {
        inspection_id: inspection.id,
        asset_id: serverAssetId, // Return for client reconciliation
        result: data.result
      };
    });
  }
}
