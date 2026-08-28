import { Injectable, Logger, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { QaWorkflow } from './qa.workflow';

export class SubmitInspectionDto {
  client_operation_id: string;
  asset_id: string;
  repair_cycle_id?: string;
  manufacturing_order_id?: string;
  result: string; // 'FIT', 'MINOR_FIX', 'NOT_FIT', 'CONDEMNATION_REQUEST'
  remarks?: string;
}

@Injectable()
export class QaService {
  private readonly logger = new Logger(QaService.name);

  constructor(private readonly prisma: PrismaService) {}

  async submitInspection(userId: string, data: SubmitInspectionDto) {
    QaWorkflow.validateInspection(data.repair_cycle_id, data.manufacturing_order_id);
    QaWorkflow.validateResult(data.result);

    return await this.prisma.$transaction(async (tx) => {
      // 1. Idempotency Check
      const existingInspection = await tx.qAInspection.findUnique({
        where: { client_operation_id: data.client_operation_id }
      });
      if (existingInspection) {
        if (existingInspection.result === data.result) {
          return { message: 'Idempotent success', inspection_id: existingInspection.id };
        }
        throw new ConflictException('Client operation ID exists with different payload.');
      }

      // 2. Insert Inspection
      const inspection = await tx.qAInspection.create({
        data: {
          client_operation_id: data.client_operation_id,
          asset_id: data.asset_id,
          repair_cycle_id: data.repair_cycle_id,
          manufacturing_order_id: data.manufacturing_order_id,
          inspector_id: userId,
          inspection_type: 'FINAL',
          result: data.result,
          remarks: data.remarks
        }
      });

      // 3. Conditional Logic Routing
      if (data.result === 'FIT') {
        await tx.fitCertificate.create({
          data: {
            inspection_id: inspection.id,
            certificate_number: `FC-${data.client_operation_id.substring(0, 8).toUpperCase()}-${Date.now()}`,
            issued_by: userId,
          }
        });
        this.logger.log(`Asset ${data.asset_id} FIT. FitCertificate issued.`);
      } else if (data.result === 'CONDEMNATION_REQUEST') {
        // Create an Exception for authority approval
        await tx.exception.create({
          data: {
            asset_id: data.asset_id,
            type: 'CONDEMNATION_APPROVAL_REQUIRED',
            status: 'OPEN',
            severity: 'CRITICAL',
            reason: `QA requested condemnation for asset ${data.asset_id}. Remarks: ${data.remarks}`,
            reported_by: userId
          }
        });
        this.logger.log(`Asset ${data.asset_id} requested for CONDEMNATION. Exception raised.`);
      }

      return inspection;
    });
  }
}
