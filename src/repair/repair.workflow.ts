import { BadRequestException } from '@nestjs/common';

export class RepairWorkflow {
  static validateStart(currentStatus: string) {
    // Usually, assets must be received in yard, or dispatched, or awaiting repair.
    const allowedStates = ['RECEIVED_IN_YARD', 'AWAITING_REPAIR', 'DISPATCHED'];
    if (!allowedStates.includes(currentStatus)) {
      throw new BadRequestException(`Asset cannot start repair. Current status is ${currentStatus}, expected one of: ${allowedStates.join(', ')}.`);
    }
  }

  static validateHold(cycleStatus: string) {
    if (cycleStatus !== 'ACTIVE') {
      throw new BadRequestException('Can only hold an ACTIVE repair cycle.');
    }
  }

  static validateResume(cycleStatus: string, hasOpenHold: boolean) {
    if (cycleStatus !== 'ACTIVE') {
      throw new BadRequestException('Cycle must be ACTIVE to resume.');
    }
    if (!hasOpenHold) {
      throw new BadRequestException('No open hold to resume from.');
    }
  }

  static validateComplete(cycleStatus: string, hasOpenHold: boolean) {
    if (cycleStatus !== 'ACTIVE') {
      throw new BadRequestException('Cannot complete an inactive repair cycle.');
    }
    if (hasOpenHold) {
      throw new BadRequestException('Cannot complete a repair cycle that is currently on hold.');
    }
  }
}
