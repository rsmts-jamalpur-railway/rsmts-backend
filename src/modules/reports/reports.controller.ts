import { Controller, Get, Query, Res, UseGuards } from '@nestjs/common';
import { ReportsService } from './reports.service';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { RolesGuard, Roles } from '../../auth/roles.guard';
import type { Response } from 'express';

@ApiTags('Reports')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Roles('Administrator', 'Management', 'SSE')
  @Get('movements-data')
  @ApiOperation({ summary: 'Get movement logs data for DataTable' })
  @ApiQuery({ name: 'startDate', required: false })
  @ApiQuery({ name: 'endDate', required: false })
  async getMovementsData(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    return this.reportsService.getMovementsData(startDate, endDate);
  }

  @Roles('Administrator', 'Management', 'SSE')
  @Get('distribution')
  @ApiOperation({ summary: 'Get aggregated active asset distribution data' })
  async getDistributionData() {
    return this.reportsService.getDistributionData();
  }

  @Roles('Administrator', 'Management')
  @Get('movements')
  @ApiOperation({ summary: 'Export movement logs as CSV' })
  @ApiQuery({ name: 'startDate', required: false })
  @ApiQuery({ name: 'endDate', required: false })
  async exportMovements(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @Res() res: Response,
  ) {
    const csvData = await this.reportsService.generateMovementsReport(
      startDate,
      endDate,
    );

    res.header('Content-Type', 'text/csv');
    res.attachment(
      `movement_report_${new Date().toISOString().split('T')[0]}.csv`,
    );
    return res.send(csvData);
  }
}
