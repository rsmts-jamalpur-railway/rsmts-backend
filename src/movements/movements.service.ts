import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class CreateMovementDto {
  @IsOptional()
  @IsString()
  client_operation_id?: string;

  @IsOptional()
  @IsString()
  asset_id?: string;

  @IsOptional()
  @IsString()
  asset_number?: string;

  @IsOptional()
  @IsString()
  from_location?: string;

  @IsString()
  @IsNotEmpty()
  to_location: string;

  @IsOptional()
  @IsString()
  previous_status?: string;

  @IsString()
  @IsNotEmpty()
  new_status: string;

  @IsOptional()
  @IsString()
  handled_by?: string;

  @IsOptional()
  @IsString()
  remarks?: string;

  @IsOptional()
  @IsString()
  repair_cycle_id?: string;

  @IsOptional()
  @IsString()
  manufacturing_order_id?: string;
}

@Injectable()
export class MovementsService {
  private readonly logger = new Logger(MovementsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async createMovement(data: CreateMovementDto) {
    // Resolve asset_id if asset_number was passed
    let assetId = data.asset_id;
    if (!assetId && data.asset_number) {
      const asset = await this.prisma.asset.findUnique({
        where: { asset_number: data.asset_number.trim().toUpperCase() },
      });
      if (asset) {
        assetId = asset.id;
      } else {
        throw new BadRequestException(`Asset with number ${data.asset_number} not found.`);
      }
    }

    if (!assetId) {
      throw new BadRequestException('Either asset_id or asset_number must be provided.');
    }

    // Fetch asset to verify active operation domain
    const asset = await this.prisma.asset.findUnique({
      where: { id: assetId },
      include: {
        manufacturing_orders: { where: { status: 'ACTIVE' }, take: 1 },
        repair_cycles: { where: { status: 'ACTIVE' }, take: 1 },
      },
    });

    if (!asset) {
      throw new BadRequestException(`Asset with ID ${assetId} not found.`);
    }

    // Determine active operational pipeline
    const hasActiveRepair = Boolean(
      data.repair_cycle_id ||
      asset.repair_cycles?.some((r) => r.status === 'ACTIVE' || r.status === 'IN_PROGRESS') ||
      asset.current_status.includes('REPAIR') ||
      asset.current_status.includes('Received NSY') ||
      asset.current_status.includes('Shop In') ||
      asset.current_status === 'ON_HOLD',
    );

    const hasActiveMfg = Boolean(
      data.manufacturing_order_id ||
      asset.manufacturing_orders?.some((m) => m.status === 'ACTIVE' || m.status === 'IN_PROGRESS') ||
      asset.current_status.includes('MANUFACTURING'),
    );

    // STRICT DOMAIN RULE: Rolling stock is ONLY restricted from repair shops if actively in its INITIAL NEW-BUILD manufacturing phase.
    // Rolling stock originally manufactured here that later returns for POH/ROH/Special Repair has full, unrestricted access to WRS-1 to WRS-4.
    const isCurrentlyInManufacturing = hasActiveMfg && !hasActiveRepair;
    const repairShops = ['WRS-1', 'WRS-2', 'WRS-3', 'WRS-4', 'DPS'];
    if (isCurrentlyInManufacturing && repairShops.includes(data.to_location)) {
      throw new BadRequestException(
        `Operational Rule Violation: Rolling stock (#${asset.asset_number}) is currently in the new-build manufacturing phase. New builds from GIF / Crane Shop move directly to WRS-5 (QA Testing), Trial Yard, or Exit Yard for dispatch. (Once dispatched and returned for repair, repair routing will be unrestricted).`,
      );
    }

    // STRICT DOMAIN RULE: Rolling stock currently in repair cannot be routed to GIF (New Manufacturing Shop)
    if (hasActiveRepair && data.to_location === 'GIF') {
      throw new BadRequestException(
        `Operational Rule Violation: Wagons in repair (#${asset.asset_number}) cannot be routed to GIF (New Manufacturing Shop). Repair operations are confined to WRS-1 through WRS-5.`,
      );
    }

    // Enforce XOR constraint on context if both provided
    if (data.repair_cycle_id && data.manufacturing_order_id) {
      throw new BadRequestException('Movement cannot belong to both Repair and Manufacturing operations.');
    }

    const movement = await this.prisma.movementLog.create({
      data: {
        asset_id: assetId,
        from_location: data.from_location,
        to_location: data.to_location,
        previous_status: data.previous_status,
        new_status: data.new_status,
        handled_by: data.handled_by || 'SYSTEM',
        remarks: data.remarks,
        repair_cycle_id: data.repair_cycle_id,
        manufacturing_order_id: data.manufacturing_order_id,
        timestamp: new Date(),
        sync_status: 'Synced',
      }
    });

    // Update the asset's current location and status automatically
    await this.prisma.asset.update({
      where: { id: assetId },
      data: {
        current_location: data.to_location,
        current_status: data.new_status,
      }
    });

    this.logger.log(`Created movement for asset ${assetId} to ${data.to_location}`);
    return movement;
  }

  async findRecent(limit = 50) {
    const movements = await this.prisma.movementLog.findMany({
      take: Number(limit) || 50,
      orderBy: { timestamp: 'desc' },
      include: {
        asset: {
          select: {
            asset_number: true,
            current_status: true,
            category_id: true,
          }
        },
        handler: {
          select: {
            employee: {
              select: {
                first_name: true,
                last_name: true,
                employee_number: true,
              }
            }
          }
        }
      }
    });

    return {
      success: true,
      count: movements.length,
      data: movements,
    };
  }
}
