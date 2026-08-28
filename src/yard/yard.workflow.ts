import { BadRequestException } from '@nestjs/common';

export class YardWorkflow {
  static validateIntake(currentStatus: string | null) {
    if (currentStatus !== null && currentStatus !== 'DISPATCHED') {
      throw new BadRequestException(`Asset cannot be intaken. Current status is ${currentStatus}, expected null or DISPATCHED.`);
    }
  }

  static validateDispatch(currentStatus: string, openExceptionsCount: number) {
    if (currentStatus !== 'AWAITING_DISPATCH') {
      throw new BadRequestException(`Asset cannot be dispatched. Current status is ${currentStatus}, expected AWAITING_DISPATCH.`);
    }
    if (openExceptionsCount > 0) {
      throw new BadRequestException('Asset cannot be dispatched with open exceptions.');
    }
  }
}
