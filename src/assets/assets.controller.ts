import { Controller, Get, Post, Patch, Delete, Param, Query, Body, UseGuards, Request } from '@nestjs/common';
import { AssetsService, CreateAssetDto, UpdateAssetDto } from './assets.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiParam, ApiQuery } from '@nestjs/swagger';

@ApiTags('Assets')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('assets')
export class AssetsController {
  constructor(private readonly assetsService: AssetsService) {}

  @Get()
  @ApiOperation({ summary: 'Get paginated list of workshop assets with filter support' })
  @ApiQuery({ name: 'page', required: false, example: 1 })
  @ApiQuery({ name: 'limit', required: false, example: 20 })
  @ApiQuery({ name: 'active', required: false, example: 'true' })
  @ApiQuery({ name: 'search', required: false, example: '21021845128' })
  @ApiQuery({ name: 'category', required: false, example: 'WAGON' })
  @ApiQuery({ name: 'status', required: false, example: 'IN_REPAIR' })
  @ApiQuery({ name: 'location', required: false, example: 'WRS-1' })
  async getAssets(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('active') active?: string,
    @Query('search') search?: string,
    @Query('category') category?: string,
    @Query('status') status?: string,
    @Query('location') location?: string,
  ) {
    return this.assetsService.findAll({
      page,
      limit,
      active,
      search,
      category,
      status,
      location,
    });
  }

  @Get(':assetNumber')
  @ApiOperation({ summary: 'Get complete asset details and historical lifecycle timeline' })
  @ApiParam({ name: 'assetNumber', example: '21021845128' })
  async getAssetDetail(@Param('assetNumber') assetNumber: string) {
    return this.assetsService.findOne(assetNumber);
  }

  @Get(':assetNumber/status')
  @ApiOperation({ summary: 'Get the comprehensive operational status of an asset' })
  @ApiParam({ name: 'assetNumber', example: '21021845128' })
  async getAssetStatus(@Param('assetNumber') assetNumber: string) {
    return this.assetsService.getAssetStatus(assetNumber);
  }

  @Post()
  @ApiOperation({ summary: 'Register a new rolling stock asset' })
  async createAsset(@Request() req, @Body() data: CreateAssetDto) {
    return this.assetsService.create(data, req.user?.userId);
  }

  @Patch(':assetNumber')
  @ApiOperation({ summary: 'Update asset location, status, active flag, or custom metadata' })
  @ApiParam({ name: 'assetNumber', example: '21021845128' })
  async updateAsset(
    @Request() req,
    @Param('assetNumber') assetNumber: string,
    @Body() data: UpdateAssetDto,
  ) {
    return this.assetsService.update(assetNumber, data, req.user?.userId);
  }

  @Delete(':assetNumber')
  @ApiOperation({ summary: 'Deactivate (soft) or permanently delete (hard) an asset' })
  @ApiParam({ name: 'assetNumber', example: '21021845128' })
  @ApiQuery({ name: 'hard', required: false, example: 'false' })
  async deleteAsset(
    @Param('assetNumber') assetNumber: string,
    @Query('hard') hard?: string,
  ) {
    return this.assetsService.remove(assetNumber, hard === 'true');
  }
}
