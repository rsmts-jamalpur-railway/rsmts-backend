import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateMovementDto } from './dto/create-movement.dto';
import { StateMachineService } from '../state-machine/state-machine.service';
import { AuditService } from '../../shared/audit/audit.service';
import { NotificationService } from '../../shared/notification/notification.service';

@Injectable()
export class MovementService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly stateMachine: StateMachineService,
    private readonly audit: AuditService,
    private readonly notification: NotificationService,
  ) {}

  async recordMovement(dto: CreateMovementDto, currentUserId: string) {
    const asset = await this.prisma.asset.findUnique({
      where: { asset_number: dto.asset_number }
    });

    if (!asset) {
      throw new NotFoundException(`Asset ${dto.asset_number} not found`);
    }

    if (!asset.is_active) {
      throw new BadRequestException(`Asset ${dto.asset_number} is inactive`);
    }

    // 1. Validate State Transition
    this.stateMachine.validateTransition(asset.current_status, dto.new_status);

    // Default to current location if not moving
    const toLocation = dto.to_location || asset.current_location;

    // 2. Validate Capacity if moving to a new location
    if (toLocation && toLocation !== asset.current_location) {
      await this.stateMachine.checkLocationCapacity(toLocation);
    }

    // 3. Execute Transaction
    const result = await this.prisma.$transaction(async (prisma) => {
      
      let allocatedShop = asset.allocated_shop;
      let currentLocation = asset.current_location;

      if (dto.new_status === 'Allocated') {
        allocatedShop = toLocation; // Shop is allocated
      } else if (dto.new_status === 'Accepted') {
        currentLocation = toLocation; // Wagon actually moves into the shop
        allocatedShop = null; // No longer just 'allocated'
      } else if (dto.new_status === 'Dispatched') {
        currentLocation = null; // Left the workshop
        allocatedShop = null;
      } else {
        currentLocation = toLocation;
      }

      // Update Asset
      const updatedAsset = await prisma.asset.update({
        where: { id: asset.id },
        data: {
          current_status: dto.new_status,
          current_location: currentLocation,
          allocated_shop: allocatedShop,
          is_active: dto.new_status === 'Dispatched' ? false : true,
        }
      });

      // Create Movement Log
      const log = await prisma.movementLog.create({
        data: {
          asset_number: asset.asset_number,
          from_location: asset.current_location,
          to_location: toLocation!,
          previous_status: asset.current_status,
          new_status: dto.new_status,
          handled_by: currentUserId,
          timestamp: new Date(),
          remarks: dto.remarks,
          is_offline_entry: dto.is_offline_entry ?? false,
        }
      });

      return { asset: updatedAsset, log };
    });

    // 4. Audit & Notify
    await this.audit.logAction(currentUserId, 'MOVEMENT_RECORDED', { 
      asset_number: asset.asset_number, 
      transition: `${asset.current_status} -> ${dto.new_status}` 
    });

    await this.notification.notify(
      `Wagon ${dto.new_status}`,
      `Asset ${asset.asset_number} transitioned to ${dto.new_status} at ${toLocation}`,
      'MOVEMENT'
    );

    return result;
  }
}
