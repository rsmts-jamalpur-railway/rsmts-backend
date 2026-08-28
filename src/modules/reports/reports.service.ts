import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { parse } from 'json2csv';

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async getMovementsData(startDate?: string, endDate?: string) {
    const where: any = {};
    if (startDate && endDate) {
      where.timestamp = {
        gte: new Date(startDate),
        lte: new Date(`${endDate}T23:59:59.999Z`),
      };
    }

    return this.prisma.movementLog.findMany({
      where,
      include: { 
        handler: { select: { full_name: true } },
        asset: { select: { asset_category: true } },
        photos: { select: { photo_url: true, createdAt: true } }
      },
      orderBy: { timestamp: 'desc' },
    });
  }

  async getDistributionData() {
    const locations = await this.prisma.asset.groupBy({
      by: ['current_location', 'asset_category'],
      where: { is_active: true },
      _count: {
        current_location: true,
      },
    });

    const statuses = await this.prisma.asset.groupBy({
      by: ['current_status', 'asset_category'],
      where: { is_active: true },
      _count: {
        current_status: true,
      },
    });

    return {
      locations: locations.map((l) => ({
        name: l.current_location,
        category: l.asset_category,
        value: l._count.current_location,
      })),
      statuses: statuses.map((s) => ({
        name: s.current_status,
        category: s.asset_category,
        value: s._count.current_status,
      })),
    };
  }

  async generateMovementsReport(
    startDate?: string,
    endDate?: string,
  ): Promise<string> {
    const where: any = {};
    if (startDate && endDate) {
      where.timestamp = {
        gte: new Date(startDate),
        lte: new Date(`${endDate}T23:59:59.999Z`),
      };
    }

    const logs = await this.prisma.movementLog.findMany({
      where,
      include: { handler: { select: { full_name: true } } },
      orderBy: { timestamp: 'desc' },
    });

    if (logs.length === 0) {
      return ''; // Return empty CSV
    }

    const flattened = logs.map((log) => ({
      'Log ID': log.log_id,
      'Asset Number': log.asset_number,
      'From Location': log.from_location || 'N/A',
      'To Location': log.to_location,
      'Previous Status': log.previous_status || 'N/A',
      'New Status': log.new_status,
      'Handled By': log.handler.full_name,
      Timestamp: log.timestamp.toISOString(),
      Remarks: log.remarks || '',
    }));

    const fields = [
      'Log ID',
      'Asset Number',
      'From Location',
      'To Location',
      'Previous Status',
      'New Status',
      'Handled By',
      'Timestamp',
      'Remarks',
    ];

    return parse(flattened, { fields });
  }

  async getTatAnalytics(startDate?: string, endDate?: string) {
    const where: any = {
      tat_days: { not: null } // Only completed cycles
    };
    
    if (startDate && endDate) {
      where.nsy_out_date = {
        gte: new Date(startDate),
        lte: new Date(`${endDate}T23:59:59.999Z`),
      };
    }

    const completedCycles = await this.prisma.repairCycle.findMany({
      where,
      include: {
        asset: {
          select: { asset_category: true }
        }
      }
    });

    let wagonTotal = 0, wagonCount = 0;
    let otherTotal = 0, otherCount = 0;

    completedCycles.forEach(cycle => {
      if (cycle.asset.asset_category === 'WAGON') {
        wagonTotal += cycle.tat_days || 0;
        wagonCount++;
      } else {
        otherTotal += cycle.tat_days || 0;
        otherCount++;
      }
    });

    return {
      wagonTat: wagonCount > 0 ? (wagonTotal / wagonCount).toFixed(1) : 0,
      otherTat: otherCount > 0 ? (otherTotal / otherCount).toFixed(1) : 0,
      wagonCompleted: wagonCount,
      otherCompleted: otherCount
    };
  }
}
