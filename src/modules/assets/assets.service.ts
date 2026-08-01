import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateAssetDto } from './dto/create-asset.dto';
import { UpdateAssetDto } from './dto/update-asset.dto';
import { GetAssetsQueryDto } from './dto/get-assets-query.dto';
import { WagonValidationService } from '../../shared/wagon-validation/wagon-validation.service';
import { AuditService } from '../../shared/audit/audit.service';
import { NotificationService } from '../../shared/notification/notification.service';

@Injectable()
export class AssetsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly wagonValidation: WagonValidationService,
    private readonly audit: AuditService,
    private readonly notification: NotificationService,
  ) {}

  async create(createAssetDto: CreateAssetDto, currentUserId: string) {
    // Validate 11-digit number
    if (!this.wagonValidation.validateNumber(createAssetDto.asset_number)) {
      throw new BadRequestException('Invalid wagon check digit');
    }

    const initialStatus =
      createAssetDto.origin === 'GIF'
        ? 'GIF IN'
        : createAssetDto.origin === 'CRANE'
        ? 'CRANE IN'
        : 'NSY IN';
    const initialLocation =
      createAssetDto.origin === 'GIF'
        ? 'GIF'
        : createAssetDto.origin === 'CRANE'
        ? 'CRANE'
        : 'NSY';

    // Start a transaction to create asset and initial movement log
    const result = await this.prisma.$transaction(async (prisma) => {
      // Check if asset already exists and is active INSIDE transaction
      const existingAsset = await prisma.asset.findUnique({
        where: { asset_number: createAssetDto.asset_number },
      });

      if (existingAsset && existingAsset.is_active) {
        throw new BadRequestException(
          'Asset is already actively tracking in the system',
        );
      }

      let asset;
      if (existingAsset) {
        // Reactivate soft-deleted asset
        asset = await prisma.asset.update({
          where: { asset_number: createAssetDto.asset_number },
          data: {
            is_active: true,
            current_status: initialStatus,
            current_location: initialLocation,
            allocated_shop: null,
            asset_type: createAssetDto.asset_type,
            origin: createAssetDto.origin,
            wagon_sr: createAssetDto.wagon_sr,
            rly: createAssetDto.rly,
            mod: createAssetDto.mod,
            built_year: createAssetDto.built_year,
            action: createAssetDto.action,
            nsy_in_date: new Date(),
            custom_fields: createAssetDto.custom_fields || {},
          },
        });
      } else {
        // Create new asset
        asset = await prisma.asset.create({
          data: {
            asset_number: createAssetDto.asset_number,
            asset_type: createAssetDto.asset_type,
            origin: createAssetDto.origin,
            current_status: initialStatus,
            current_location: initialLocation,
            wagon_sr: createAssetDto.wagon_sr,
            rly: createAssetDto.rly,
            mod: createAssetDto.mod,
            built_year: createAssetDto.built_year,
            action: createAssetDto.action,
            nsy_in_date: new Date(),
            custom_fields: createAssetDto.custom_fields || {},
          },
        });
      }

      // Create initial RepairCycle
      const cycle = await prisma.repairCycle.create({
        data: {
          asset_number: asset.asset_number,
          cycle_number: 1,
          nsy_in_date: new Date(),
        }
      });

      // Create initial movement log
      await prisma.movementLog.create({
        data: {
          asset_number: asset.asset_number,
          to_location: initialLocation,
          new_status: initialStatus,
          handled_by: currentUserId,
          timestamp: new Date(),
          remarks: 'Asset registered into the system',
          repair_cycle_id: cycle.id
        },
      });

      return asset;
    });

    await this.audit.logAction(currentUserId, 'REGISTER_ASSET', {
      asset_number: result.asset_number,
    });
    await this.notification.notify(
      'New Asset Received',
      `Asset ${result.asset_number} (${result.asset_type}) has been received at ${initialLocation}`,
      'INFO',
    );

    return result;
  }

  async findAll(query: GetAssetsQueryDto) {
    const { status, location, active = 'true', page = 1, limit = 50 } = query;

    const where: any = {};
    if (active !== 'all') {
      where.is_active = active === 'true';
    }
    
    if (status) where.current_status = status;
    if (location) where.current_location = location;

    const skip = (Number(page) - 1) * Number(limit);
    const take = Number(limit);

    const [data, total] = await Promise.all([
      this.prisma.asset.findMany({
        where,
        skip,
        take,
        include: {
          location: { select: { location_id: true } },
          allocatedTo: { select: { location_id: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.asset.count({ where }),
    ]);

    return {
      data,
      meta: {
        total,
        page: Number(page),
        last_page: Math.ceil(total / take),
      },
    };
  }

  async findOne(asset_number: string) {
    const asset = await this.prisma.asset.findUnique({
      where: { asset_number },
      include: {
        repair_cycles: {
          orderBy: { cycle_number: 'desc' },
          include: {
            movement_logs: {
              orderBy: { timestamp: 'desc' },
              include: { 
                handler: { select: { full_name: true } },
                photos: true
              },
            }
          }
        },
        movement_logs: {
          where: { repair_cycle_id: null },
          orderBy: { timestamp: 'desc' },
          include: { 
            handler: { select: { full_name: true } },
            photos: true
          },
        },
      },
    });

    if (!asset) throw new NotFoundException('Asset not found');
    return asset;
  }

  async update(
    asset_number: string,
    updateAssetDto: UpdateAssetDto,
    currentUserId: string,
  ) {
    const asset = await this.prisma.asset.findUnique({
      where: { asset_number },
    });
    if (!asset) throw new NotFoundException('Asset not found');

    const updated = await this.prisma.asset.update({
      where: { asset_number },
      data: updateAssetDto,
    });

    await this.audit.logAction(currentUserId, 'UPDATE_ASSET', {
      asset_number,
      updates: updateAssetDto,
    });
    return updated;
  }

  async remove(asset_number: string, currentUserId: string) {
    const asset = await this.prisma.asset.findUnique({
      where: { asset_number },
    });
    if (!asset) throw new NotFoundException('Asset not found');

    // Soft delete
    const deleted = await this.prisma.asset.update({
      where: { asset_number },
      data: { is_active: false },
    });

    await this.audit.logAction(currentUserId, 'DELETE_ASSET', { asset_number });
    return deleted;
  }
}
