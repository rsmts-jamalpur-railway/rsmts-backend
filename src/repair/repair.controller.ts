import { Controller, Post, Patch, Body, UseGuards, Request } from '@nestjs/common';
import { RepairService, StartRepairDto, CloseRepairDto, RepairHoldDto } from './repair.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';

@ApiTags('Repair')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('repair')
export class RepairController {
  constructor(private readonly repairService: RepairService) {}

  @Post('start')
  @ApiOperation({ summary: 'Initiate a new repair cycle for an asset' })
  async startRepair(@Request() req, @Body() data: StartRepairDto) {
    return this.repairService.startRepair(req.user.userId, req.user.assigned_location_id, data);
  }

  @Patch('close')
  @ApiOperation({ summary: 'Complete an active repair cycle' })
  async closeRepair(@Request() req, @Body() data: CloseRepairDto) {
    return this.repairService.closeRepair(req.user.userId, req.user.assigned_location_id, data);
  }

  @Post('hold')
  @ApiOperation({ summary: 'Put an active repair cycle on hold (TAT pause)' })
  async putOnHold(@Request() req, @Body() data: RepairHoldDto) {
    return this.repairService.putOnHold(req.user.userId, data);
  }

  @Patch('resume')
  @ApiOperation({ summary: 'Resume a repair cycle from hold' })
  async resumeRepair(@Request() req, @Body() data: RepairHoldDto) {
    return this.repairService.resumeRepair(req.user.userId, data);
  }
}
