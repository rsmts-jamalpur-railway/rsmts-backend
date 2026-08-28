import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export class CreateMovementDto {
  asset_id: string;
  from_location?: string;
  to_location: string;
  previous_status?: string;
  new_status: string;
  handled_by: string;
  remarks?: string;
  repair_cycle_id?: string;
  manufacturing_order_id?: string;
}

@Injectable()
export class MovementsService {
  private readonly logger = new Logger(MovementsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async createMovement(data: CreateMovementDto) {
    // Enforce XOR constraint on context if both provided
    if (data.repair_cycle_id && data.manufacturing_order_id) {
      throw new BadRequestException('Movement cannot belong to both Repair and Manufacturing operations.');
    }

    const movement = await this.prisma.movementLog.create({
      data: {
        asset_id: data.asset_id,
        from_location: data.from_location,
        to_location: data.to_location,
        previous_status: data.previous_status,
        new_status: data.new_status,
        handled_by: data.handled_by,
        remarks: data.remarks,
        repair_cycle_id: data.repair_cycle_id,
        manufacturing_order_id: data.manufacturing_order_id,
        timestamp: new Date(),
        sync_status: 'Synced',
      }
    });

    // Update the asset's current location and status automatically
    await this.prisma.asset.update({
      where: { id: data.asset_id },
      data: {
        current_location: data.to_location,
        current_status: data.new_status,
      }
    });

    this.logger.log(`Created movement for asset ${data.asset_id} to ${data.to_location}`);
    return movement;
  }
}
