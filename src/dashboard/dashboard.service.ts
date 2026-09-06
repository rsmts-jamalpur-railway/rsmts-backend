import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface PipelineQuery {
  pipeline?: string;
  shop_id?: string;
  category?: string;
  status?: string;
  search?: string;
}

@Injectable()
export class DashboardService {
  private readonly logger = new Logger(DashboardService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * High-level KPI overview across all operational domains and 68 locations
   */
  async getOverview() {
    const [
      totalActiveAssets,
      activeRepairCycles,
      activeMfgOrders,
      activeHolds,
      openExceptions,
      dispatchedTodayCount,
      allLocations,
    ] = await Promise.all([
      this.prisma.asset.count({ where: { is_active: true } }),
      this.prisma.repairCycle.count({ where: { status: 'ACTIVE' } }),
      this.prisma.manufacturingOrder.count({ where: { status: 'ACTIVE' } }),
      this.prisma.repairHold.count({ where: { released_at: null } }),
      this.prisma.exception.count({ where: { status: 'OPEN' } }),
      this.prisma.movementLog.count({
        where: {
          new_status: { in: ['Dispatched', 'DISPATCHED', 'OUT'] },
          timestamp: {
            gte: new Date(new Date().setHours(0, 0, 0, 0)),
          },
        },
      }),
      this.prisma.location.findMany(),
    ]);

    // Occupancy per location
    const occupancyByLocation = await this.prisma.asset.groupBy({
      by: ['current_location'],
      where: { is_active: true },
      _count: { id: true },
    });

    const occupancyMap: Record<string, number> = {};
    for (const item of occupancyByLocation) {
      if (item.current_location) {
        occupancyMap[item.current_location] = item._count.id;
      }
    }

    // Delayed assets (TAT breached)
    const activeCyclesWithCategory = await this.prisma.repairCycle.findMany({
      where: { status: 'ACTIVE' },
      include: {
        repair_category: true,
        holds: true,
      },
    });

    let delayedCount = 0;
    const now = Date.now();
    for (const cycle of activeCyclesWithCategory) {
      if (cycle.started_at && cycle.repair_category?.standard_tat_hours) {
        // Subtract hold duration
        let holdMs = 0;
        for (const hold of cycle.holds) {
          const start = new Date(hold.started_at).getTime();
          const end = hold.released_at ? new Date(hold.released_at).getTime() : now;
          holdMs += (end - start);
        }
        const activeDurationHours = (now - new Date(cycle.started_at).getTime() - holdMs) / (1000 * 60 * 60);
        if (activeDurationHours > cycle.repair_category.standard_tat_hours) {
          delayedCount++;
        }
      }
    }

    return {
      success: true,
      data: {
        total_active_assets: totalActiveAssets,
        repair_active: activeRepairCycles,
        manufacturing_active: activeMfgOrders,
        on_hold_count: activeHolds,
        open_exceptions_count: openExceptions,
        dispatched_today: dispatchedTodayCount,
        delayed_assets_count: delayedCount,
        total_locations_count: allLocations.length || 68,
        occupancy_by_location: occupancyMap,
      },
    };
  }

  /**
   * State-centric pipeline data
   * Groups assets by pipeline (REPAIR vs MANUFACTURING vs EXCEPTION) and state
   */
  async getPipelineData(query: PipelineQuery) {
    const whereClause: any = { is_active: true };

    if (query.shop_id && query.shop_id !== 'ALL') {
      whereClause.current_location = query.shop_id;
    }

    if (query.category && query.category !== 'ALL') {
      whereClause.category_id = query.category;
    }

    if (query.search) {
      whereClause.asset_number = {
        contains: query.search.trim(),
        mode: 'insensitive',
      };
    }

    const assets = await this.prisma.asset.findMany({
      where: whereClause,
      include: {
        category: true,
        location: true,
        repair_cycles: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          include: {
            repair_category: true,
            holds: {
              where: { released_at: null },
            },
          },
        },
        manufacturing_orders: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          include: {
            current_stage: true,
          },
        },
        qa_inspections: {
          orderBy: { inspected_at: 'desc' },
          take: 1,
          include: {
            certificates: true,
          },
        },
        exceptions: {
          where: { status: 'OPEN' },
        },
        photos: {
          orderBy: { createdAt: 'desc' },
          take: 3,
        },
        movements: {
          orderBy: { timestamp: 'desc' },
          take: 3,
          include: {
            handler: {
              select: {
                id: true,
                employee: {
                  select: {
                    first_name: true,
                    last_name: true,
                    employee_number: true,
                  },
                },
              },
            },
          },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });

    const now = Date.now();

    const formattedAssets = assets.map((asset) => {
      const activeRepair = asset.repair_cycles.find((c) => c.status === 'ACTIVE') || asset.repair_cycles[0];
      const activeMfg = asset.manufacturing_orders.find((m) => m.status === 'ACTIVE') || asset.manufacturing_orders[0];
      const openHold = activeRepair?.holds?.[0] || null;
      const latestQA = asset.qa_inspections[0] || null;
      const latestMovement = asset.movements[0] || null;

      // Determine Operational Pipeline
      let pipeline = 'REPAIR';
      if (asset.exceptions.length > 0) {
        pipeline = 'EXCEPTION';
      } else if (activeMfg && activeMfg.status === 'ACTIVE') {
        pipeline = 'MANUFACTURING';
      } else if (activeRepair && activeRepair.status === 'ACTIVE') {
        pipeline = 'REPAIR';
      }

      // Calculate TAT status
      let tatStatus: 'NORMAL' | 'WARNING' | 'BREACHED' = 'NORMAL';
      let elapsedHours = 0;
      let standardHours = 0;

      if (activeRepair && activeRepair.started_at) {
        standardHours = activeRepair.repair_category?.standard_tat_hours || 120; // 5 days default
        elapsedHours = Math.max(0, (now - new Date(activeRepair.started_at).getTime()) / (1000 * 60 * 60));
        const ratio = standardHours > 0 ? elapsedHours / standardHours : 0;
        if (ratio >= 1.0) {
          tatStatus = 'BREACHED';
        } else if (ratio >= 0.8) {
          tatStatus = 'WARNING';
        }
      }

      const handlerName = latestMovement?.handler?.employee
        ? `${latestMovement.handler.employee.first_name} ${latestMovement.handler.employee.last_name || ''}`.trim()
        : 'Station Staff';

      return {
        id: asset.id,
        asset_number: asset.asset_number,
        category: asset.category?.category || 'WAGON',
        subtype: asset.category?.subtype || asset.category_id,
        current_location: asset.current_location || 'NSY',
        location_zone: asset.location?.zone || 'Yard',
        current_status: asset.current_status,
        pipeline,
        tat_status: tatStatus,
        elapsed_hours: Math.round(elapsedHours),
        standard_tat_hours: standardHours,
        is_on_hold: !!openHold,
        hold_reason: openHold?.reason || null,
        active_repair: activeRepair
          ? {
              cycle_id: activeRepair.cycle_id,
              category: activeRepair.repair_category_id,
              status: activeRepair.status,
              started_at: activeRepair.started_at,
            }
          : null,
        active_manufacturing: activeMfg
          ? {
              order_id: activeMfg.order_id,
              built_by_shop: activeMfg.built_by_shop,
              status: activeMfg.status,
              current_stage: activeMfg.current_stage?.stage_name || 'Assembly',
              started_at: activeMfg.started_at,
            }
          : null,
        qa_status: latestQA
          ? {
              result: latestQA.result,
              certificate_number: latestQA.certificates?.[0]?.certificate_number || null,
              inspected_at: latestQA.inspected_at,
            }
          : null,
        open_exceptions: asset.exceptions.map((ex) => ({
          id: ex.id,
          type: ex.type,
          severity: ex.severity,
          reason: ex.reason,
        })),
        latest_movement: latestMovement
          ? {
              from: latestMovement.from_location,
              to: latestMovement.to_location,
              timestamp: latestMovement.timestamp,
              handler: handlerName,
              remarks: latestMovement.remarks,
            }
          : null,
        photos: asset.photos.map((p) => p.photo_url),
        last_updated: asset.updatedAt,
      };
    });

    return {
      success: true,
      count: formattedAssets.length,
      data: formattedAssets,
    };
  }

  /**
   * Deep-dive asset details snapshot for the Asset Detail Modal
   */
  async getAssetDetails(assetNumber: string) {
    const asset = await this.prisma.asset.findUnique({
      where: { asset_number: assetNumber },
      include: {
        category: true,
        location: true,
        repair_cycles: {
          orderBy: { createdAt: 'desc' },
          include: {
            repair_category: true,
            holds: {
              include: {
                creator: { select: { employee: true } },
                releaser: { select: { employee: true } },
              },
            },
            assessments: {
              include: {
                user: { select: { employee: true } },
              },
            },
            work_logs: {
              include: {
                user: { select: { employee: true } },
              },
            },
          },
        },
        manufacturing_orders: {
          orderBy: { createdAt: 'desc' },
          include: {
            current_stage: true,
            work_logs: {
              include: {
                user: { select: { employee: true } },
                stage: true,
              },
            },
          },
        },
        qa_inspections: {
          orderBy: { inspected_at: 'desc' },
          include: {
            inspector: { select: { employee: true } },
            test_results: true,
            certificates: true,
          },
        },
        exceptions: {
          orderBy: { createdAt: 'desc' },
          include: {
            reporter: { select: { employee: true } },
            assignee: { select: { employee: true } },
            resolver: { select: { employee: true } },
          },
        },
        photos: {
          orderBy: { createdAt: 'desc' },
        },
        movements: {
          orderBy: { timestamp: 'desc' },
          include: {
            handler: {
              select: {
                id: true,
                employee: {
                  select: {
                    first_name: true,
                    last_name: true,
                    employee_number: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!asset) {
      throw new NotFoundException(`Asset ${assetNumber} not found.`);
    }

    return {
      success: true,
      data: asset,
    };
  }

  /**
   * Returns all workshop locations (the full 68-location topology)
   */
  async getLocations() {
    let locations = await this.prisma.location.findMany({
      orderBy: { location_id: 'asc' },
    });

    // If locations haven't been fully seeded with all 68 locations yet,
    // ensure all 68 workshop locations exist in DB so the system is fully equipped.
    if (locations.length < 20) {
      this.logger.log('Seeding missing workshop locations to ensure all 68 locations are available...');
      await this.ensure68LocationsSeeded();
      locations = await this.prisma.location.findMany({
        orderBy: { location_id: 'asc' },
      });
    }

    // Fetch occupancy for each
    const occupancy = await this.prisma.asset.groupBy({
      by: ['current_location'],
      where: { is_active: true },
      _count: { id: true },
    });

    const occMap = new Map<string, number>();
    occupancy.forEach((o) => {
      if (o.current_location) occMap.set(o.current_location, o._count.id);
    });

    const enrichedLocations = locations.map((loc) => {
      const currentCount = occMap.get(loc.location_id) || 0;
      const isParkingLine = loc.location_id.startsWith('Line-') || loc.location_id.startsWith('Line ') || loc.location_type === 'YARD_LINE';

      return {
        location_id: loc.location_id,
        location_type: loc.location_type,
        max_capacity: loc.max_capacity,
        zone: loc.zone || (isParkingLine ? 'Yard Lines' : 'Workshop'),
        current_occupancy: currentCount,
        available_space: Math.max(0, loc.max_capacity - currentCount),
        is_overloaded: currentCount > loc.max_capacity,
        is_parking_line: isParkingLine,
      };
    });

    return {
      success: true,
      count: enrichedLocations.length,
      data: enrichedLocations,
    };
  }

  async createLocation(data: { location_id: string; location_type?: string; max_capacity: number; zone?: string }) {
    const loc = await this.prisma.location.create({
      data: {
        location_id: data.location_id.trim(),
        location_type: data.location_type || (data.location_id.startsWith('Line-') ? 'YARD_LINE' : 'SHOP'),
        max_capacity: Number(data.max_capacity) || 20,
        zone: data.zone || 'Workshop',
      },
    });
    return { success: true, data: loc };
  }

  async updateLocation(locationId: string, data: { max_capacity?: number; standard_tat_hours?: number; location_type?: string; zone?: string }) {
    const updateData: any = {};
    if (data.max_capacity !== undefined) updateData.max_capacity = Number(data.max_capacity);
    if (data.location_type !== undefined) updateData.location_type = data.location_type;
    if (data.zone !== undefined) updateData.zone = data.zone;

    const loc = await this.prisma.location.update({
      where: { location_id: locationId },
      data: updateData,
    });
    return { success: true, data: loc };
  }

  async deleteLocation(locationId: string) {
    const loc = await this.prisma.location.delete({
      where: { location_id: locationId },
    });
    return { success: true, data: loc };
  }

  /**
   * Seeds the 68 Jamalpur Workshop locations
   */
  private async ensure68LocationsSeeded() {
    const list: Array<{ location_id: string; location_type: string; max_capacity: number; zone: string }> = [
      // Primary Shops & QA (7)
      { location_id: 'WRS-1', location_type: 'REPAIR_SHOP', max_capacity: 50, zone: 'Repair Shops' },
      { location_id: 'WRS-2', location_type: 'REPAIR_SHOP', max_capacity: 50, zone: 'Repair Shops' },
      { location_id: 'WRS-3', location_type: 'REPAIR_SHOP', max_capacity: 50, zone: 'Repair Shops' },
      { location_id: 'WRS-4', location_type: 'REPAIR_SHOP', max_capacity: 50, zone: 'Repair Shops' },
      { location_id: 'DPS', location_type: 'LOCO_SHED', max_capacity: 25, zone: 'Locomotive Shed' },
      { location_id: 'GIF', location_type: 'MFG_SHOP', max_capacity: 100, zone: 'Manufacturing Shops' },
      { location_id: 'CRANE', location_type: 'CRANE_SHOP', max_capacity: 15, zone: 'Manufacturing Shops' },
      { location_id: 'WRS-5', location_type: 'QA_SHOP', max_capacity: 20, zone: 'Quality Assurance' },

      // Primary Yards & Test Tracks (3)
      { location_id: 'NSY', location_type: 'YARD', max_capacity: 500, zone: 'Primary Yards' },
      { location_id: 'Exit Yard', location_type: 'YARD', max_capacity: 100, zone: 'Primary Yards' },
      { location_id: 'Trial Yard', location_type: 'YARD', max_capacity: 30, zone: 'Primary Yards' },

      // Dedicated Specialty Lines (2)
      { location_id: 'Tower Car Line', location_type: 'YARD_LINE', max_capacity: 15, zone: 'Specialty Lines' },
      { location_id: 'Wheel Park Line', location_type: 'YARD_LINE', max_capacity: 40, zone: 'Specialty Lines' },
    ];

    // Workshop Track & Parking Lines (Line-01 to Line-56 to reach 68 total nodes)
    for (let i = 1; i <= 56; i++) {
      const numStr = i < 10 ? `0${i}` : `${i}`;
      list.push({
        location_id: `Line-${numStr}`,
        location_type: 'YARD_LINE',
        max_capacity: 15,
        zone: i <= 28 ? 'Yard North Lines' : 'Yard South Lines',
      });
    }

    for (const item of list) {
      await this.prisma.location.upsert({
        where: { location_id: item.location_id },
        update: {
          location_type: item.location_type,
          max_capacity: item.max_capacity,
          zone: item.zone,
        },
        create: {
          location_id: item.location_id,
          location_type: item.location_type,
          max_capacity: item.max_capacity,
          zone: item.zone,
        },
      });
    }

    await this.ensureMasterCategoriesSeeded();
  }

  /**
   * Returns all available rolling stock categories with length requirements and check digit rules
   */
  async getCategories() {
    await this.ensureMasterCategoriesSeeded();
    const categories = await this.prisma.assetCategoryMaster.findMany({
      orderBy: [{ category: 'asc' }, { id: 'asc' }],
    });
    return {
      success: true,
      data: categories,
    };
  }

  /**
   * Seeds categories, repair categories, and demo rolling stock if not present
   */
  public async ensureMasterCategoriesSeeded() {
    const categories = [
      { id: 'BOXNHL', category: 'WAGON', subtype: 'BOXNHL', id_length: 11, requires_check_digit: true },
      { id: 'BCNHL', category: 'WAGON', subtype: 'BCNHL', id_length: 11, requires_check_digit: true },
      { id: 'BVZI', category: 'WAGON', subtype: 'BVZI', id_length: 11, requires_check_digit: true },
      { id: 'BTPN', category: 'WAGON', subtype: 'BTPN', id_length: 11, requires_check_digit: true },
      { id: 'BOBRN', category: 'WAGON', subtype: 'BOBRN', id_length: 11, requires_check_digit: true },
      { id: 'WAP7', category: 'LOCO', subtype: 'WAP7', id_length: 5, requires_check_digit: false },
      { id: 'WAG9', category: 'LOCO', subtype: 'WAG9', id_length: 5, requires_check_digit: false },
      { id: 'WDG4', category: 'LOCO', subtype: 'WDG4', id_length: 5, requires_check_digit: false },
      { id: '140T_CRANE', category: 'CRANE', subtype: '140T_GOTTWALD', id_length: 6, requires_check_digit: false },
      { id: '175T_CRANE', category: 'CRANE', subtype: '175T_HYDRAULIC', id_length: 6, requires_check_digit: false },
      { id: '8W_DETC', category: 'TOWER_CAR', subtype: '8W_DETC', id_length: 6, requires_check_digit: false },
      { id: '4W_DHTC', category: 'TOWER_CAR', subtype: '4W_DHTC', id_length: 3, requires_check_digit: false },
    ];

    for (const cat of categories) {
      await this.prisma.assetCategoryMaster.upsert({
        where: { id: cat.id },
        update: {
          category: cat.category,
          subtype: cat.subtype,
          id_length: cat.id_length,
          requires_check_digit: cat.requires_check_digit,
        },
        create: cat,
      });
    }

    const repairCategories = [
      { id: 'POH', standard_tat_hours: 120 },
      { id: 'ROH', standard_tat_hours: 48 },
      { id: 'NPOH', standard_tat_hours: 72 },
      { id: 'SPECIAL_REPAIR', standard_tat_hours: 96 },
    ];

    for (const rc of repairCategories) {
      await this.prisma.repairCategoryMaster.upsert({
        where: { id: rc.id },
        update: { standard_tat_hours: rc.standard_tat_hours },
        create: rc,
      });
    }

    // Check if any assets exist; if none, seed initial demo set
    const count = await this.prisma.asset.count();
    if (count === 0) {
      const demoAssets = [
        { asset_number: '21021845128', category_id: 'BOXNHL', location: 'WRS-1', status: 'IN_REPAIR', pipeline: 'REPAIR', repair_cat: 'POH' },
        { asset_number: '31022204916', category_id: 'BCNHL', location: 'WRS-5', status: 'PENDING_QA', pipeline: 'REPAIR', repair_cat: 'ROH' },
        { asset_number: '85022010459', category_id: 'BVZI', location: 'NSY', status: 'Received NSY', pipeline: 'REPAIR', repair_cat: 'POH' },
        { asset_number: '40021932010', category_id: 'BTPN', location: 'WRS-2', status: 'Shop In', pipeline: 'REPAIR', repair_cat: 'SPECIAL_REPAIR', hold: 'Waiting for CBC draft gear components from store' },
        { asset_number: '21022401057', category_id: 'BOXNHL', location: 'GIF', status: 'IN_MANUFACTURING', pipeline: 'MFG', shop: 'GIF' },
        { asset_number: '30215', category_id: 'WAP7', location: 'DPS', status: 'IN_REPAIR', pipeline: 'REPAIR', repair_cat: 'POH' },
        { asset_number: '31102', category_id: 'WAG9', location: 'Trial Yard', status: 'FIT', pipeline: 'REPAIR', repair_cat: 'ROH' },
        { asset_number: '140012', category_id: '140T_CRANE', location: 'CRANE', status: 'IN_REPAIR', pipeline: 'REPAIR', repair_cat: 'SPECIAL_REPAIR' },
        { asset_number: '175001', category_id: '175T_CRANE', location: 'CRANE', status: 'IN_MANUFACTURING', pipeline: 'MFG', shop: 'CRANE' },
        { asset_number: '080012', category_id: '8W_DETC', location: 'Tower Car Line', status: 'IN_REPAIR', pipeline: 'REPAIR', repair_cat: 'ROH' },
      ];

      const adminUser = await this.prisma.user.findFirst();

      for (const item of demoAssets) {
        const asset = await this.prisma.asset.create({
          data: {
            asset_number: item.asset_number,
            category_id: item.category_id,
            current_location: item.location,
            current_status: item.status,
            is_active: true,
          },
        });

        if (item.pipeline === 'REPAIR') {
          const cycle = await this.prisma.repairCycle.create({
            data: {
              asset_id: asset.id,
              repair_category_id: item.repair_cat || 'POH',
              status: item.status === 'FIT' ? 'COMPLETED' : 'ACTIVE',
              started_at: new Date(Date.now() - 48 * 3600 * 1000),
            },
          });

          if (item.hold && adminUser) {
            await this.prisma.repairHold.create({
              data: {
                repair_cycle_id: cycle.cycle_id,
                reason: 'MATERIAL_SHORTAGE',
                remarks: item.hold,
                created_by: adminUser.id,
              },
            });
          }
        } else if (item.pipeline === 'MFG') {
          await this.prisma.manufacturingOrder.create({
            data: {
              asset_id: asset.id,
              production_type: 'NEW_BUILD',
              built_by_shop: item.shop || 'GIF',
              status: 'ACTIVE',
              started_at: new Date(Date.now() - 72 * 3600 * 1000),
            },
          });
        }
      }
    }
  }
}
