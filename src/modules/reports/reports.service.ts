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
      include: { handler: { select: { full_name: true } } },
      orderBy: { timestamp: 'desc' },
    });
  }

  async getDistributionData() {
    const locations = await this.prisma.asset.groupBy({
      by: ['current_location'],
      where: { is_active: true },
      _count: {
        current_location: true,
      },
    });

    const statuses = await this.prisma.asset.groupBy({
      by: ['current_status'],
      where: { is_active: true },
      _count: {
        current_status: true,
      },
    });

    return {
      locations: locations.map(l => ({ name: l.current_location, value: l._count.current_location })),
      statuses: statuses.map(s => ({ name: s.current_status, value: s._count.current_status }))
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
}
