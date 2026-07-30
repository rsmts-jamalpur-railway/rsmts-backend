import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { parse } from 'json2csv';

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async generateMovementsReport(
    startDate?: string,
    endDate?: string,
  ): Promise<string> {
    const where: any = {};
    if (startDate && endDate) {
      where.timestamp = {
        gte: new Date(startDate),
        lte: new Date(endDate),
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
