import { BadRequestException } from '@nestjs/common';

export class QaWorkflow {
  static validateInspection(repairCycleId?: string, manufacturingOrderId?: string) {
    if (repairCycleId && manufacturingOrderId) {
      throw new BadRequestException('Inspection must belong to EITHER a Repair Cycle OR a Manufacturing Order, not both.');
    }
    if (!repairCycleId && !manufacturingOrderId) {
      throw new BadRequestException('Inspection must belong to an active operation.');
    }
  }

  static validateResult(result: string) {
    const validResults = ['FIT', 'MINOR_FIX', 'NOT_FIT', 'CONDEMNATION_REQUEST'];
    if (!validResults.includes(result)) {
      throw new BadRequestException(`Invalid QA result. Must be one of: ${validResults.join(', ')}`);
    }
  }
}
