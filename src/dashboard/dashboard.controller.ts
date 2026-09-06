import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';

@ApiTags('Dashboard')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('overview')
  @ApiOperation({ summary: 'Get workshop high-level KPI overview' })
  async getOverview() {
    return this.dashboardService.getOverview();
  }

  @Get('pipeline')
  @ApiOperation({ summary: 'Get assets grouped and filtered by operational state and pipeline' })
  @ApiQuery({ name: 'pipeline', required: false, enum: ['ALL', 'REPAIR', 'MANUFACTURING', 'EXCEPTION'] })
  @ApiQuery({ name: 'shop_id', required: false })
  @ApiQuery({ name: 'category', required: false })
  @ApiQuery({ name: 'search', required: false })
  async getPipeline(
    @Query('pipeline') pipeline?: string,
    @Query('shop_id') shop_id?: string,
    @Query('category') category?: string,
    @Query('search') search?: string,
  ) {
    return this.dashboardService.getPipelineData({
      pipeline,
      shop_id,
      category,
      search,
    });
  }

  @Get('asset/:assetNumber')
  @ApiOperation({ summary: 'Get full operational asset details for deep-dive modal' })
  async getAssetDetails(@Param('assetNumber') assetNumber: string) {
    return this.dashboardService.getAssetDetails(assetNumber);
  }

  @Get('locations')
  @ApiOperation({ summary: 'Get all 68 workshop locations with live occupancy' })
  async getLocations() {
    return this.dashboardService.getLocations();
  }

  @Get('categories')
  @ApiOperation({ summary: 'Get all rolling stock categories with length rules and check digit config' })
  async getCategories() {
    return this.dashboardService.getCategories();
  }
}

// Also provide top-level /locations for direct calls
@ApiTags('Locations')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('locations')
export class LocationsLegacyController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get()
  @ApiOperation({ summary: 'Get all 68 workshop locations with live occupancy' })
  async getAllLocations() {
    return this.dashboardService.getLocations();
  }

  @Post()
  @ApiOperation({ summary: 'Create a new workshop location' })
  async createLocation(@Body() body: any) {
    return this.dashboardService.createLocation(body);
  }

  @Patch(':locationId')
  @ApiOperation({ summary: 'Update location capacity or zone' })
  async updateLocation(@Param('locationId') locationId: string, @Body() body: any) {
    return this.dashboardService.updateLocation(locationId, body);
  }

  @Delete(':locationId')
  @ApiOperation({ summary: 'Delete a location' })
  async deleteLocation(@Param('locationId') locationId: string) {
    return this.dashboardService.deleteLocation(locationId);
  }
}

