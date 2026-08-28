import { Controller, Post, Patch, Body, UseGuards, Request } from '@nestjs/common';
import { ManufacturingService, StartManufacturingDto, CloseManufacturingDto } from './manufacturing.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';

@ApiTags('Manufacturing')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('manufacturing')
export class ManufacturingController {
  constructor(private readonly manufacturingService: ManufacturingService) {}

  @Post('start')
  @ApiOperation({ summary: 'Initiate a new manufacturing order (e.g. Crane)' })
  async startManufacturing(@Request() req, @Body() data: StartManufacturingDto) {
    return this.manufacturingService.startManufacturing(req.user.userId, req.user.assigned_location_id, data);
  }

  @Patch('close')
  @ApiOperation({ summary: 'Complete an active manufacturing order' })
  async closeManufacturing(@Request() req, @Body() data: CloseManufacturingDto) {
    return this.manufacturingService.closeManufacturing(req.user.userId, req.user.assigned_location_id, data);
  }
}
