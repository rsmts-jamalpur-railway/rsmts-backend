import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class StateMachineService {
  constructor(private readonly prisma: PrismaService) {}

  // Valid transitions mapped as { [currentState]: allowedNextStates[] }
  private readonly validTransitions: Record<string, string[]> = {
    'NSY IN': ['Allocated'],
    Allocated: ['Shop In', 'Missing', 'Allocated'],
    Missing: ['Allocated', 'Shop In'],
    'Shop In': [
      'Pending QA',
      'Missing',
      'Hold',
      'Condemned',
      'Allocated',
      'NSY IN',
      'Fit',
    ],
    Hold: ['Shop In'],
    'Pending QA': ['Fit', 'Not Fit', 'Minor Fix', 'Condemned', 'Allocated'],
    'Minor Fix': ['Pending QA'],
    'Not Fit': ['Shop In', 'MFG ACTIVE', 'Allocated'],
    Fit: ['NSY OUT'], // Completed QA, moves to yard exit
    'NSY OUT': ['Dispatched', 'Not Dispatched', 'NSY IN'], // TPT Rail reviews
    'Not Dispatched': ['Dispatched', 'NSY OUT', 'Shop In'], // From 68 lines back to dispatch or repair
    Dispatched: ['NSY IN'], // Re-enter cycle if it comes back
    'MFG IN': ['MFG ACTIVE'],
    'MFG ACTIVE': ['Pending QA', 'Fit', 'NSY OUT'], // New builds go to QA, or directly out
    Condemned: ['Scrapped'],
    // Legacy support mappings
    'GIF IN': ['MFG ACTIVE', 'Allocated'],
    'CRANE IN': ['MFG ACTIVE', 'Allocated'],
  };

  /**
   * Validate if a transition from current to new state is allowed.
   */
  validateTransition(currentStatus: string, newStatus: string): boolean {
    const allowed = this.validTransitions[currentStatus];
    if (!allowed || !allowed.includes(newStatus)) {
      throw new BadRequestException(
        `Invalid state transition from '${currentStatus}' to '${newStatus}'`,
      );
    }
    return true;
  }

  /**
   * Checks if the target location has enough capacity to accept the wagon.
   */
  async checkLocationCapacity(locationId: string): Promise<boolean> {
    const location = await this.prisma.location.findUnique({
      where: { location_id: locationId },
      include: {
        _count: {
          select: { assets_current: true, assets_allocated: true },
        },
      },
    });

    if (!location) {
      throw new BadRequestException(`Location ${locationId} not found`);
    }

    // Treat both currently present and allocated (incoming) as occupying capacity
    const currentOccupancy =
      location._count.assets_current + location._count.assets_allocated;

    if (currentOccupancy >= location.max_capacity) {
      throw new BadRequestException(
        `Capacity full at location ${locationId}. Max: ${location.max_capacity}`,
      );
    }

    return true;
  }

  /**
   * Enforces exact mathematical Smart Routing rules for asset categories.
   */
  validateSmartRouting(assetCategory: string, assetNumber: string, destinationId: string): boolean {
    assetCategory = assetCategory.toUpperCase();
    
    // 1. WAGON: Exactly 11 Digits, WRS-1 to WRS-4
    if (assetCategory === 'WAGON') {
      if (!/^\d{11}$/.test(assetNumber)) throw new BadRequestException(`Wagon asset number must be exactly 11 digits.`);
      if (!destinationId.startsWith('WRS-') && destinationId !== 'NSY' && destinationId !== 'OUT') {
         throw new BadRequestException(`Wagons can only be routed to WRS locations.`);
      }
    }
    
    // 2. LOCOMOTIVE: Exactly 5 Digits, DPS or Electric Shed
    if (assetCategory === 'LOCOMOTIVE') {
      if (!/^\d{5}$/.test(assetNumber)) throw new BadRequestException(`Locomotive asset number must be exactly 5 digits.`);
      if (destinationId !== 'DPS' && destinationId !== 'Electric Shed' && destinationId !== 'NSY' && destinationId !== 'OUT') {
         throw new BadRequestException(`Locomotives can only be routed to DPS or Electric Shed.`);
      }
    }

    // 3. CRANE: Exactly 6 Digits, Cannot start with 145
    if (assetCategory === 'CRANE') {
      if (!/^\d{6}$/.test(assetNumber) || assetNumber.startsWith('145')) {
         throw new BadRequestException(`Crane asset number must be 6 digits and cannot start with 145.`);
      }
      if (destinationId !== 'Crane Shop' && destinationId !== 'Trial Yard' && destinationId !== 'NSY' && destinationId !== 'OUT') {
         throw new BadRequestException(`Cranes can only be routed to Crane Shop or Trial Yard.`);
      }
    }

    // 4. TOWER CAR: 3 Digits or 6 Digits
    if (assetCategory === 'TOWER CAR') {
      if (!/^\d{3}$/.test(assetNumber) && !/^\d{6}$/.test(assetNumber)) {
         throw new BadRequestException(`Tower Car asset number must be exactly 3 or 6 digits.`);
      }
      if (destinationId !== 'Crane Shop' && destinationId !== 'Tower Car Line' && destinationId !== 'NSY' && destinationId !== 'OUT') {
         throw new BadRequestException(`Tower Cars can only be routed to Crane Shop or Tower Car Line.`);
      }
    }

    return true;
  }
}
