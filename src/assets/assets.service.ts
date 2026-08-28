import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AssetsService {
  constructor(private readonly prisma: PrismaService) {}

  async getAssetStatus(assetNumber: string) {
    const asset = await this.prisma.asset.findUnique({
      where: { asset_number: assetNumber },
      include: {
        category: true,
        location: true,
        allocations: {
          where: { status: 'PENDING' }
        },
        repair_cycles: {
          where: { status: 'ACTIVE' }
        },
        manufacturing_orders: {
          where: { status: 'ACTIVE' }
        },
        exceptions: {
          where: { status: 'OPEN' }
        }
      }
    });

    if (!asset) {
      throw new NotFoundException(`Asset ${assetNumber} not found.`);
    }

    // Determine the active operation based on 10/10 Invariants
    const activeRepair = asset.repair_cycles.length > 0 ? asset.repair_cycles[0] : null;
    const activeManufacturing = asset.manufacturing_orders.length > 0 ? asset.manufacturing_orders[0] : null;

    return {
      asset_number: asset.asset_number,
      category: asset.category.category,
      current_location: asset.location?.location_id || 'UNKNOWN',
      current_status: asset.current_status,
      active_operation: activeRepair ? 'REPAIR' : (activeManufacturing ? 'MANUFACTURING' : 'NONE'),
      operation_details: activeRepair || activeManufacturing || null,
      open_exceptions: asset.exceptions,
      pending_allocations: asset.allocations
    };
  }
}
