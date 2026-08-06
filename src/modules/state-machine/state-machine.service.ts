import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class StateMachineService {
  constructor(private readonly prisma: PrismaService) {}

  // Valid transitions mapped as { [currentState]: allowedNextStates[] }
  private readonly validTransitions: Record<string, string[]> = {
    'NSY IN': ['Allocated'], // Yard Master assigns to WRS
    'Allocated': ['Shop In', 'Missing', 'Allocated'], // Accept, Report Missing, or Re-route
    'Missing': ['Allocated', 'Shop In'], // Admin resolves and returns to queue (Re-route or Mark Found)
    'Shop In': ['Pending QA', 'Missing', 'Hold', 'Condemned', 'Allocated', 'NSY IN'], // Finish repair (to WRS-5), lost, material shortage, scrapped, forward to another shop, or reject to NSY
    'Hold': ['Shop In'], // Resume repair
    'Pending QA': ['Fit', 'Not Fit', 'Minor Fix', 'Condemned', 'Allocated'], // QA results, including redirecting back to shop (Allocated)
    'Minor Fix': ['Pending QA'], // Local fix complete, re-test
    'Not Fit': ['Shop In', 'MFG ACTIVE', 'Allocated'], // Send back to repair or mfg
    'Fit': ['NSY OUT'], // Handover to dispatch
    'NSY OUT': ['NSY IN'], // Wagon leaves, cycle complete
    'MFG IN': ['MFG ACTIVE'], // New build starts
    'MFG ACTIVE': ['Pending QA'], // Assembly finishes, send to QA
    'Condemned': ['Scrapped'], // Admin approves scrap
    // Legacy support mappings
    'GIF IN': ['MFG ACTIVE'],
    'CRANE IN': ['MFG ACTIVE'],
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
