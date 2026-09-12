import { Controller, Post, Patch, Body, Param, UseGuards, Request } from '@nestjs/common';
import { YardService, IntakeAssetDto, DispatchAssetDto, UpdateAssetDto } from './yard.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';

@ApiTags('Yard')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('yard')
export class YardController {
  constructor(private readonly yardService: YardService) {}

  @Patch('asset/:id')
  @ApiOperation({ summary: 'Update an existing asset details' })
  async updateAsset(@Request() req, @Param('id') assetId: string, @Body() data: UpdateAssetDto) {
    // Inject the asset_id from the URL into the DTO for the service method
    return this.yardService.updateAsset(req.user.userId, { ...data, asset_id: assetId });
  }

  @Post('intake')
  @ApiOperation({ summary: 'Intake a new or returning asset into the Yard' })
  async intakeAsset(@Request() req, @Body() data: IntakeAssetDto) {
    return this.yardService.intakeAsset(req.user.userId, req.user.assigned_location_id, data, req.user.roles);
  }

  @Post('dispatch')
  @ApiOperation({ summary: 'Dispatch a completed asset out of the Yard' })
  async dispatchAsset(@Request() req, @Body() data: DispatchAssetDto) {
    return this.yardService.dispatchAsset(req.user.userId, req.user.assigned_location_id, data, req.user.roles);
  }
}
