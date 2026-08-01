import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
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
    // Execute Transaction
    const result = await this.prisma.$transaction(async (prisma) => {
      const asset = await prisma.asset.findUnique({
        where: { asset_number: dto.asset_number },
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

      // Find active cycle (or create if re-entering)
      let activeCycle = await prisma.repairCycle.findFirst({
        where: { asset_number: asset.asset_number },
        orderBy: { cycle_number: 'desc' },
      });

      if (!activeCycle || ((dto.new_status === 'NSY IN' || dto.new_status === 'GIF IN' || dto.new_status === 'CRANE IN') && asset.current_status === 'NSY OUT')) {
        activeCycle = await prisma.repairCycle.create({
          data: {
            asset_number: asset.asset_number,
            cycle_number: activeCycle ? activeCycle.cycle_number + 1 : 1,
            nsy_in_date: new Date(),
          }
        });
      }

      let allocatedShop = asset.allocated_shop;
      let currentLocation = asset.current_location;
      
      let nsy_in_date = asset.nsy_in_date;
      let shop_in_date = asset.shop_in_date;
      let fit_date = asset.fit_date;
      let nsy_out_date = asset.nsy_out_date;
      
      const now = new Date();

      if (dto.new_status === 'Allocated') {
        allocatedShop = toLocation; 
      } else if (dto.new_status === 'Shop In') {
        currentLocation = toLocation; 
        allocatedShop = null; 
        shop_in_date = shop_in_date || now;
      } else if (dto.new_status === 'NSY OUT') {
        currentLocation = null;
        allocatedShop = null;
        nsy_out_date = now;
      } else {
        currentLocation = toLocation;
      }

      if (dto.new_status === 'NSY IN' || dto.new_status === 'GIF IN' || dto.new_status === 'CRANE IN') {
        nsy_in_date = nsy_in_date || now;
      }
      if (dto.new_status === 'Fit') {
        fit_date = now;
      }

      // Update RepairCycle Dates and TAT
      let tat_days = activeCycle.tat_days;
      if (dto.new_status === 'NSY OUT' && activeCycle.nsy_in_date) {
        const diffTime = Math.abs(now.getTime() - activeCycle.nsy_in_date.getTime());
        tat_days = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      }

      await prisma.repairCycle.update({
        where: { id: activeCycle.id },
        data: {
          nsy_in_date: dto.new_status === 'NSY IN' || dto.new_status === 'GIF IN' || dto.new_status === 'CRANE IN' ? now : undefined,
          shop_in_date: dto.new_status === 'Shop In' ? now : undefined,
          fit_date: dto.new_status === 'Fit' ? now : undefined,
          nsy_out_date: dto.new_status === 'NSY OUT' ? now : undefined,
          tat_days: tat_days
        }
      });

      // Update Asset
      const updatedAsset = await prisma.asset.update({
        where: { id: asset.id },
        data: {
          current_status: dto.new_status,
          current_location: currentLocation,
          allocated_shop: allocatedShop,
          nsy_in_date: nsy_in_date,
          shop_in_date: shop_in_date,
          fit_date: fit_date,
          nsy_out_date: nsy_out_date,
          is_active: dto.new_status === 'NSY OUT' ? false : true,
        },
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
          repair_cycle_id: activeCycle.id,
        },
      });

      // Save photos if provided
      if (dto.photos && dto.photos.length > 0) {
        await prisma.assetPhoto.createMany({
          data: dto.photos.map(photo_url => ({
            photo_url,
            asset_number: asset.asset_number,
            movement_log_id: log.log_id
          }))
        });
      }

      return {
        asset: updatedAsset,
        log
      };
    });

    // 4. Audit & Notify
    await this.audit.logAction(currentUserId, 'RECORD_MOVEMENT', {
      asset_number: result.asset.asset_number,
      transition: `${result.log.previous_status} -> ${result.log.new_status}`,
    });

    await this.notification.notify(
      `Wagon ${result.asset.current_status}`,
      `Asset ${result.asset.asset_number} transitioned to ${result.asset.current_status} at ${result.asset.current_location}`,
      'MOVEMENT',
    );

    return result;
  }
}
