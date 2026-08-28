import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { AssetsService } from './assets.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiParam } from '@nestjs/swagger';

@ApiTags('Assets')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('assets')
export class AssetsController {
  constructor(private readonly assetsService: AssetsService) {}

  @Get(':assetNumber/status')
  @ApiOperation({ summary: 'Get the comprehensive operational status of an asset' })
  @ApiParam({ name: 'assetNumber', example: 'BOXNHL12345' })
  async getAssetStatus(@Param('assetNumber') assetNumber: string) {
    return this.assetsService.getAssetStatus(assetNumber);
  }
}
