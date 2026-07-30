import { Injectable, Inject } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';

@Injectable()
export class DashboardService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) { }

  async getOverview() {
    const cacheKey = 'dashboard_overview';
    const cachedData = await this.cacheManager.get(cacheKey);

    if (cachedData) {
      return cachedData;
    }

    // Calculate aggregated data
    const totalAssets = await this.prisma.asset.count({
      where: { is_active: true },
    });
    const dispatchedToday = await this.prisma.movementLog.count({
      where: {
        new_status: 'Dispatched',
        timestamp: { gte: new Date(new Date().setHours(0, 0, 0, 0)) },
      },
    });

    const locationOccupancy = await this.prisma.location.findMany({
      include: {
        _count: {
          select: { assets_current: true, assets_allocated: true },
        },
      },
    });

    const formattedOccupancy = locationOccupancy.map((loc) => ({
      location_id: loc.location_id,
      max_capacity: loc.max_capacity,
      current: loc._count.assets_current,
      allocated: loc._count.assets_allocated,
      total_load: loc._count.assets_current + loc._count.assets_allocated,
      is_overloaded:
        loc._count.assets_current + loc._count.assets_allocated >=
        loc.max_capacity,
    }));

    const data = {
      total_active_assets: totalAssets,
      dispatched_today: dispatchedToday,
      occupancy: formattedOccupancy,
      timestamp: new Date(),
    };

    // Cache for 60 seconds (60000ms)
    await this.cacheManager.set(cacheKey, data, 60000);

    return data;
  }
}
