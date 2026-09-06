import { Injectable, NotFoundException, BadRequestException, ConflictException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface AssetQueryDto {
  page?: number;
  limit?: number;
  active?: string;
  search?: string;
  category?: string;
  status?: string;
  location?: string;
}

import { IsOptional, IsString, IsBoolean, IsNumber } from 'class-validator';

export class CreateAssetDto {
  @IsString()
  asset_number: string;

  @IsOptional()
  @IsString()
  category_id?: string;

  @IsOptional()
  @IsString()
  asset_category?: string;

  @IsOptional()
  @IsString()
  asset_type?: string;

  @IsOptional()
  @IsString()
  current_location?: string;

  @IsOptional()
  @IsString()
  current_status?: string;

  @IsOptional()
  @IsString()
  origin?: 'REPAIR' | 'MANUFACTURING';

  @IsOptional()
  @IsString()
  action?: string;

  @IsOptional()
  @IsString()
  wagon_sr?: string;

  @IsOptional()
  @IsString()
  rly?: string;

  @IsOptional()
  @IsString()
  mod?: string;

  @IsOptional()
  @IsNumber()
  built_year?: number;

  @IsOptional()
  custom_fields?: any;
}

export class UpdateAssetDto {
  @IsOptional()
  @IsString()
  current_location?: string;

  @IsOptional()
  @IsString()
  current_status?: string;

  @IsOptional()
  @IsBoolean()
  is_active?: boolean;

  @IsOptional()
  @IsString()
  asset_type?: string;

  @IsOptional()
  @IsString()
  action?: string;

  @IsOptional()
  @IsString()
  wagon_sr?: string;

  @IsOptional()
  @IsString()
  rly?: string;

  @IsOptional()
  @IsString()
  mod?: string;

  @IsOptional()
  @IsNumber()
  built_year?: number;

  @IsOptional()
  @IsString()
  allocated_shop?: string;

  @IsOptional()
  custom_fields?: any;
}

@Injectable()
export class AssetsService {
  private readonly logger = new Logger(AssetsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Comprehensive Asset Status query
   */
  async getAssetStatus(assetNumber: string) {
    const asset = await this.prisma.asset.findUnique({
      where: { asset_number: assetNumber.trim().toUpperCase() },
      include: {
        category: true,
        location: true,
        allocations: {
          where: { status: 'PENDING' },
        },
        repair_cycles: {
          where: { status: 'ACTIVE' },
        },
        manufacturing_orders: {
          where: { status: 'ACTIVE' },
        },
        exceptions: {
          where: { status: 'OPEN' },
        },
      },
    });

    if (!asset) {
      throw new NotFoundException(`Asset ${assetNumber} not found.`);
    }

    const activeRepair = asset.repair_cycles.length > 0 ? asset.repair_cycles[0] : null;
    const activeManufacturing = asset.manufacturing_orders.length > 0 ? asset.manufacturing_orders[0] : null;

    return {
      asset_number: asset.asset_number,
      category: asset.category?.category || 'WAGON',
      current_location: asset.location?.location_id || asset.current_location || 'UNKNOWN',
      current_status: asset.current_status,
      active_operation: activeRepair ? 'REPAIR' : (activeManufacturing ? 'MANUFACTURING' : 'NONE'),
      operation_details: activeRepair || activeManufacturing || null,
      open_exceptions: asset.exceptions,
      pending_allocations: asset.allocations,
    };
  }

  /**
   * Paginated and Filtered Asset List for Dashboard & Master Catalog
   */
  async findAll(query: AssetQueryDto) {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.max(1, Math.min(200, Number(query.limit) || 20));
    const skip = (page - 1) * limit;

    const whereClause: any = {};

    // Active status filter: 'true' -> active only, 'false' -> deactivated only, 'all' -> both
    if (query.active === 'true') {
      whereClause.is_active = true;
    } else if (query.active === 'false') {
      whereClause.is_active = false;
    }

    // Search query (case-insensitive on asset_number)
    if (query.search && query.search.trim().length > 0) {
      whereClause.asset_number = {
        contains: query.search.trim().toUpperCase(),
        mode: 'insensitive',
      };
    }

    // Category filter
    if (query.category && query.category !== 'ALL') {
      whereClause.OR = [
        { category_id: query.category },
        { category: { category: query.category } },
        { category: { subtype: query.category } },
      ];
    }

    // Status filter
    if (query.status && query.status !== 'ALL') {
      whereClause.current_status = query.status;
    }

    // Location filter
    if (query.location && query.location !== 'ALL') {
      whereClause.current_location = query.location;
    }

    const [total, assets] = await Promise.all([
      this.prisma.asset.count({ where: whereClause }),
      this.prisma.asset.findMany({
        where: whereClause,
        skip,
        take: limit,
        orderBy: { updatedAt: 'desc' },
        include: {
          category: true,
          location: true,
          repair_cycles: {
            take: 3,
            orderBy: { started_at: 'desc' },
            include: {
              repair_category: true,
              holds: true,
            },
          },
          manufacturing_orders: {
            take: 2,
            orderBy: { started_at: 'desc' },
          },
          exceptions: {
            where: { status: 'OPEN' },
          },
          movements: {
            take: 5,
            orderBy: { timestamp: 'desc' },
          },
        },
      }),
    ]);

    const mappedAssets = assets.map((a) => {
      const activeRepair = a.repair_cycles.find((r) => r.status === 'ACTIVE') || a.repair_cycles[0];
      const activeMfg = a.manufacturing_orders.find((m) => m.status === 'ACTIVE') || a.manufacturing_orders[0];

      return {
        id: a.id,
        asset_number: a.asset_number,
        asset_category: a.category?.category || 'WAGON',
        asset_type: a.category?.subtype || a.category_id || 'BOXNHL',
        current_location: a.current_location,
        current_status: a.current_status,
        origin: activeMfg ? 'MANUFACTURING' : 'REPAIR',
        allocated_shop: a.allocated_shop,
        is_active: a.is_active,
        custom_fields: a.custom_fields,
        repair_cycles: a.repair_cycles,
        manufacturing_orders: a.manufacturing_orders,
        exceptions: a.exceptions,
        movements: a.movements,
        movement_logs: a.movements,
        createdAt: a.createdAt,
        updatedAt: a.updatedAt,
      };
    });

    return {
      success: true,
      count: mappedAssets.length,
      data: mappedAssets,
      meta: {
        total,
        page,
        limit,
        last_page: Math.ceil(total / limit) || 1,
      },
    };
  }

  /**
   * Find single asset by asset_number with complete lifecycle relations
   */
  async findOne(assetNumber: string) {
    const cleanNumber = assetNumber.trim().toUpperCase();
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(assetNumber.trim());
    const whereCondition = isUuid
      ? { OR: [{ id: assetNumber.trim() }, { asset_number: cleanNumber }] }
      : { asset_number: cleanNumber };

    const asset = await this.prisma.asset.findFirst({
      where: whereCondition,
      include: {
        category: true,
        location: true,
        repair_cycles: {
          orderBy: { started_at: 'desc' },
          include: {
            repair_category: true,
            holds: {
              include: {
                creator: { select: { employee: true } },
                releaser: { select: { employee: true } },
              },
            },
            assessments: true,
            work_logs: true,
          },
        },
        manufacturing_orders: {
          orderBy: { started_at: 'desc' },
          include: {
            work_logs: true,
          },
        },
        qa_inspections: {
          orderBy: { inspected_at: 'desc' },
          include: {
            inspector: { select: { employee: true } },
          },
        },
        movements: {
          orderBy: { timestamp: 'desc' },
          include: {
            handler: { select: { employee: true } },
          },
        },
        exceptions: {
          orderBy: { createdAt: 'desc' },
          include: {
            reporter: { select: { employee: true } },
            resolver: { select: { employee: true } },
          },
        },
        allocations: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!asset) {
      throw new NotFoundException(`Asset #${cleanNumber} not found.`);
    }

    const activeMfg = asset.manufacturing_orders.find((m) => m.status === 'ACTIVE');

    return {
      success: true,
      data: {
        ...asset,
        ...(typeof asset.custom_fields === 'object' && asset.custom_fields ? (asset.custom_fields as any) : {}),
        asset_category: asset.category?.category || 'WAGON',
        asset_type: (asset.custom_fields as any)?.asset_type || asset.category?.subtype || asset.category_id || 'BOXNHL',
        origin: (asset.custom_fields as any)?.origin || (activeMfg ? 'MANUFACTURING' : 'REPAIR'),
        movement_logs: asset.movements,
      },
    };
  }

  /**
   * Register a new rolling stock asset
   */
  async create(dto: CreateAssetDto, userId?: string) {
    const cleanNumber = dto.asset_number.trim().toUpperCase();

    // Check duplicate
    const existing = await this.prisma.asset.findUnique({
      where: { asset_number: cleanNumber },
    });
    if (existing) {
      throw new ConflictException(`Asset with number ${cleanNumber} already exists.`);
    }

    // Resolve category
    const catId = dto.category_id || dto.asset_type || 'BOXNHL';
    const category = await this.prisma.assetCategoryMaster.findUnique({
      where: { id: catId },
    });

    if (!category) {
      // Create or fallback
      await this.prisma.assetCategoryMaster.upsert({
        where: { id: catId },
        update: {},
        create: {
          id: catId,
          category: dto.asset_category || 'WAGON',
          subtype: catId,
          id_length: cleanNumber.length,
          requires_check_digit: cleanNumber.length === 11,
        },
      });
    }

    const location = dto.current_location || (dto.origin === 'MANUFACTURING' ? 'GIF' : 'NSY');
    const status = dto.current_status || (dto.origin === 'MANUFACTURING' ? 'IN_MANUFACTURING' : 'Received NSY');

    const asset = await this.prisma.asset.create({
      data: {
        asset_number: cleanNumber,
        category_id: catId,
        current_location: location,
        current_status: status,
        is_active: true,
        custom_fields: {
          ...(dto.custom_fields || {}),
          asset_type: dto.asset_type || catId,
          origin: dto.origin || 'REPAIR',
          wagon_sr: dto.wagon_sr,
          rly: dto.rly,
          mod: dto.mod,
          built_year: dto.built_year,
          action: dto.action,
        },
      },
    });

    // Auto-create initial cycle
    if (dto.origin === 'MANUFACTURING') {
      await this.prisma.manufacturingOrder.create({
        data: {
          asset_id: asset.id,
          production_type: 'NEW_BUILD',
          built_by_shop: location,
          status: 'ACTIVE',
          started_at: new Date(),
        },
      });
    } else {
      await this.prisma.repairCycle.create({
        data: {
          asset_id: asset.id,
          repair_category_id: dto.action || 'POH',
          status: 'ACTIVE',
          started_at: new Date(),
        },
      });
    }

    // Log initial placement movement
    if (userId) {
      await this.prisma.movementLog.create({
        data: {
          asset_id: asset.id,
          to_location: location,
          new_status: status,
          handled_by: userId,
          remarks: `Initial registration of ${catId} #${cleanNumber}`,
          timestamp: new Date(),
        },
      });
    }

    this.logger.log(`Created new asset #${cleanNumber} (${catId}) at ${location}`);
    return {
      success: true,
      data: asset,
    };
  }

  /**
   * Update an existing asset
   */
  async update(assetNumber: string, dto: UpdateAssetDto, userId?: string) {
    const cleanNumber = assetNumber.trim().toUpperCase();
    const existing = await this.prisma.asset.findUnique({
      where: { asset_number: cleanNumber },
    });

    if (!existing) {
      throw new NotFoundException(`Asset #${cleanNumber} not found.`);
    }

    const updateData: any = {};
    if (dto.is_active !== undefined) updateData.is_active = dto.is_active;
    if (dto.current_status) updateData.current_status = dto.current_status;
    if (dto.allocated_shop) updateData.allocated_shop = dto.allocated_shop;

    // If location changed, record movement
    if (dto.current_location && dto.current_location !== existing.current_location) {
      updateData.current_location = dto.current_location;
      if (userId) {
        await this.prisma.movementLog.create({
          data: {
            asset_id: existing.id,
            from_location: existing.current_location,
            to_location: dto.current_location,
            previous_status: existing.current_status,
            new_status: dto.current_status || existing.current_status,
            handled_by: userId,
            remarks: `Admin status update to ${dto.current_location}`,
            timestamp: new Date(),
          },
        });
      }
    }

    // Merge custom fields
    if (dto.custom_fields || dto.wagon_sr || dto.rly || dto.mod || dto.built_year || dto.action || dto.asset_type || (dto as any).origin) {
      const existingCustom = (existing.custom_fields as any) || {};
      updateData.custom_fields = {
        ...existingCustom,
        ...(dto.custom_fields || {}),
        ...(dto.asset_type !== undefined ? { asset_type: dto.asset_type } : {}),
        ...((dto as any).origin !== undefined ? { origin: (dto as any).origin } : {}),
        ...(dto.wagon_sr !== undefined ? { wagon_sr: dto.wagon_sr } : {}),
        ...(dto.rly !== undefined ? { rly: dto.rly } : {}),
        ...(dto.mod !== undefined ? { mod: dto.mod } : {}),
        ...(dto.built_year !== undefined ? { built_year: dto.built_year } : {}),
        ...(dto.action !== undefined ? { action: dto.action } : {}),
      };
    }

    const updated = await this.prisma.asset.update({
      where: { id: existing.id },
      data: updateData,
    });

    this.logger.log(`Updated asset #${cleanNumber}: ${JSON.stringify(dto)}`);
    return {
      success: true,
      data: updated,
    };
  }

  /**
   * Delete asset (soft delete or hard delete)
   */
  async remove(assetNumber: string, hard = false) {
    const cleanNumber = assetNumber.trim().toUpperCase();
    const existing = await this.prisma.asset.findUnique({
      where: { asset_number: cleanNumber },
    });

    if (!existing) {
      throw new NotFoundException(`Asset #${cleanNumber} not found.`);
    }

    if (hard) {
      // Hard delete: Clean cascade dependencies first
      await this.prisma.$transaction([
        this.prisma.movementLog.deleteMany({ where: { asset_id: existing.id } }),
        this.prisma.exception.deleteMany({ where: { asset_id: existing.id } }),
        this.prisma.allocation.deleteMany({ where: { asset_id: existing.id } }),
        this.prisma.qAInspection.deleteMany({ where: { asset_id: existing.id } }),
        this.prisma.repairHold.deleteMany({
          where: { repair_cycle: { asset_id: existing.id } },
        }),
        this.prisma.repairWorkLog.deleteMany({
          where: { repair_cycle: { asset_id: existing.id } },
        }),
        this.prisma.repairAssessment.deleteMany({
          where: { repair_cycle: { asset_id: existing.id } },
        }),
        this.prisma.repairCycle.deleteMany({ where: { asset_id: existing.id } }),
        this.prisma.manufacturingWorkLog.deleteMany({
          where: { order: { asset_id: existing.id } },
        }),
        this.prisma.manufacturingOrder.deleteMany({ where: { asset_id: existing.id } }),
        this.prisma.asset.delete({ where: { id: existing.id } }),
      ]);

      this.logger.log(`Hard deleted asset #${cleanNumber}`);
      return {
        success: true,
        message: `Asset #${cleanNumber} permanently deleted.`,
      };
    } else {
      // Soft delete: set is_active = false
      const updated = await this.prisma.asset.update({
        where: { id: existing.id },
        data: { is_active: false },
      });

      this.logger.log(`Soft deleted asset #${cleanNumber}`);
      return {
        success: true,
        data: updated,
        message: `Asset #${cleanNumber} deactivated.`,
      };
    }
  }
}
