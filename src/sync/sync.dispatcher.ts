import { Injectable, BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import { RepairService } from '../repair/repair.service';
import { YardService } from '../yard/yard.service';
import { QaService } from '../qa/qa.service';
import { ManufacturingService } from '../manufacturing/manufacturing.service';
import { ExceptionsService } from '../exceptions/exceptions.service';

@Injectable()
export class SyncDispatcher {
  constructor(
    private readonly repairService: RepairService,
    private readonly yardService: YardService,
    private readonly qaService: QaService,
    private readonly manufacturingService: ManufacturingService,
    private readonly exceptionsService: ExceptionsService,
  ) {}

  /**
   * Dispatches an outbox command from the mobile client to the existing
   * business logic services, ensuring we do not duplicate logic.
   */
  async dispatch(userId: string, assignedLocationId: string | undefined, operation: any) {
    const { command_type, payload } = operation;

    const parsedPayload = typeof payload === 'string' ? JSON.parse(payload) : payload;

    let res: any;
    switch (command_type) {
      // YARD
      case 'YARD_INTAKE':
        res = await this.yardService.intakeAsset(userId, assignedLocationId, parsedPayload);
        return this.formatResult(res, res.log_id, 'MOVEMENT_LOG');
      case 'YARD_DISPATCH':
        res = await this.yardService.dispatchAsset(userId, assignedLocationId, parsedPayload);
        return this.formatResult(res, res.log_id, 'MOVEMENT_LOG');
      case 'YARD_ALLOCATE':
        res = await this.yardService.allocateAsset(userId, parsedPayload);
        return this.formatResult(res, res.log_id, 'MOVEMENT_LOG');
      case 'YARD_CANCEL_INTAKE':
        res = await this.yardService.cancelIntake(userId, parsedPayload);
        return this.formatResult(res, res.log_id, 'MOVEMENT_LOG');
      // REPAIR
      case 'REPAIR_START':
        res = await this.repairService.startRepair(userId, assignedLocationId, parsedPayload);
        return this.formatResult(res, res.cycle_id || res.message === 'Idempotent success' ? res.cycle_id : null, 'REPAIR_CYCLE');
      case 'REPAIR_HOLD':
        res = await this.repairService.putOnHold(userId, parsedPayload);
        return this.formatResult(res, res.hold_id, 'REPAIR_HOLD');
      case 'REPAIR_RESUME':
        res = await this.repairService.resumeRepair(userId, parsedPayload);
        return this.formatResult(res, res.cycle_id, 'REPAIR_CYCLE');
      case 'REPAIR_CLOSE':
        res = await this.repairService.closeRepair(userId, assignedLocationId, parsedPayload);
        return this.formatResult(res, res.cycle_id, 'REPAIR_CYCLE');

      // MANUFACTURING
      case 'MANUFACTURING_START':
        res = await this.manufacturingService.startManufacturing(userId, assignedLocationId, parsedPayload);
        return this.formatResult(res, res.order_id, 'MANUFACTURING_CYCLE', { asset_id: res.asset_id }); 
      case 'MANUFACTURING_CLOSE':
        res = await this.manufacturingService.closeManufacturing(userId, assignedLocationId, parsedPayload);
        return this.formatResult(res, res.order_id, 'MANUFACTURING_CYCLE');

      // QA
      case 'QA_INSPECT':
        res = await this.qaService.submitInspection(userId, parsedPayload);
        return this.formatResult(res, res.inspection_id, 'QA_INSPECTION', { asset_id: res.asset_id, inspection_id: res.inspection_id });

      // EXCEPTIONS
      case 'EXCEPTION_REPORT':
        res = await this.exceptionsService.reportException(userId, parsedPayload);
        return this.formatResult(res, res.exception_id, 'EXCEPTION', { asset_id: res.asset_id, exception_id: res.exception_id });

      // ---------------------------------------------------------
      // TEST HARNESS SIMULATORS (For Step 8 Native Verification)
      // ---------------------------------------------------------
      case 'TEST_500':
        if (process.env.NODE_ENV === 'production') throw new ForbiddenException();
        throw new Error('Simulated 500 Internal Server Error');
      case 'TEST_400_STATE':
        if (process.env.NODE_ENV === 'production') throw new ForbiddenException();
        throw new BadRequestException('Asset cannot start repair simulated');
      case 'TEST_403':
        if (process.env.NODE_ENV === 'production') throw new ForbiddenException();
        throw new ForbiddenException('Forbidden scope simulated');
      case 'TEST_409_CAPACITY':
        if (process.env.NODE_ENV === 'production') throw new ForbiddenException();
        throw new ConflictException('maximum capacity reached simulated');
      case 'TEST_409_IDEMPOTENCY':
        if (process.env.NODE_ENV === 'production') throw new ForbiddenException();
        return { status: 'ALREADY_PROCESSED', server_id: 'simulated-uuid-999', entity: 'REPAIR_CYCLE' };
        
      default:
        throw new BadRequestException(`Unknown command_type: ${command_type}`);
    }
  }

  private formatResult(res: any, server_id: string, entity: string, extra: any = {}) {
    if (res && res.message === 'Idempotent success') {
      return { status: 'ALREADY_PROCESSED', server_id: res.cycle_id || res.inspection_id || server_id, entity, ...extra };
    }
    return { status: 'SUCCESS', server_id, entity, ...extra };
  }
}
