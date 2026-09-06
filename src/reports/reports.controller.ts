import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ReportsService } from './reports.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';

@ApiTags('Reports')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('movements-data')
  @ApiOperation({ summary: 'Get movement logs telemetry for analytics charts' })
  @ApiQuery({ name: 'startDate', required: false })
  @ApiQuery({ name: 'endDate', required: false })
  async getMovementsData(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.reportsService.getMovementsData(startDate, endDate);
  }

  @Get('distribution')
  @ApiOperation({ summary: 'Get rolling stock distribution by location and status' })
  async getDistribution() {
    return this.reportsService.getDistribution();
  }

  @Get('movements')
  @ApiOperation({ summary: 'Export movements report as CSV file' })
  @ApiQuery({ name: 'startDate', required: false })
  @ApiQuery({ name: 'endDate', required: false })
  async exportMovements(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.reportsService.exportMovementsCsv(startDate, endDate);
  }

  @Get('workshop-analytics')
  @ApiOperation({ summary: 'Get comprehensive entire workshop analytics metrics and benchmarks' })
  @ApiQuery({ name: 'category', required: false })
  @ApiQuery({ name: 'location', required: false })
  async getWorkshopAnalytics(
    @Query('category') category?: string,
    @Query('location') location?: string,
  ) {
    return this.reportsService.getWorkshopAnalytics(category, location);
  }
}
