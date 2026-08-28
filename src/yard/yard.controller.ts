import { Controller, Post, Body, UseGuards, Request } from '@nestjs/common';
import { YardService, IntakeAssetDto, DispatchAssetDto } from './yard.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';

@ApiTags('Yard')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('yard')
export class YardController {
  constructor(private readonly yardService: YardService) {}

  @Post('intake')
  @ApiOperation({ summary: 'Intake a new or returning asset into the Yard' })
  async intakeAsset(@Request() req, @Body() data: IntakeAssetDto) {
    return this.yardService.intakeAsset(req.user.userId, req.user.assigned_location_id, data);
  }

  @Post('dispatch')
  @ApiOperation({ summary: 'Dispatch a completed asset out of the Yard' })
  async dispatchAsset(@Request() req, @Body() data: DispatchAssetDto) {
    return this.yardService.dispatchAsset(req.user.userId, req.user.assigned_location_id, data);
  }
}
