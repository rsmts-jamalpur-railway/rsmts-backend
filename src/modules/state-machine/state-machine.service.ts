import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class StateMachineService {
  constructor(private readonly prisma: PrismaService) {}

  // Valid transitions mapped as { [currentState]: allowedNextStates[] }
  private readonly validTransitions: Record<string, string[]> = {
    'NSY IN': ['Allocated', 'Shop In'],
    'GIF IN': ['NSY OUT'],
    'CRANE IN': ['NSY OUT'],
    'Allocated': ['Shop In', 'NSY IN'],
    'Shop In': ['WRS-5 In'],
    'WRS-5 In': ['Fit', 'Not Fit'],
    'Not Fit': ['Shop In', 'WRS-5 In'],
    'Fit': ['NSY OUT'],
    'NSY OUT': ['NSY IN'],
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
}
