import { BadRequestException } from '@nestjs/common';

export class ManufacturingWorkflow {
  static validateStart(assetExists: boolean) {
    if (assetExists) {
      throw new BadRequestException(`Asset already exists. Cannot start manufacturing for an existing asset.`);
    }
  }

  static validateComplete(orderStatus: string) {
    if (orderStatus !== 'ACTIVE') {
      throw new BadRequestException('Cannot complete an inactive manufacturing order.');
    }
  }
}
