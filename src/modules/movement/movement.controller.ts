import { Controller, Post, Body, UseGuards, Request } from '@nestjs/common';
import { MovementService } from './movement.service';
import { CreateMovementDto } from './dto/create-movement.dto';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { RolesGuard, Roles } from '../../auth/roles.guard';

@ApiTags('Movement & Tracking')
@ApiBearerAuth()
@UseGuards(RolesGuard)
@Controller('movement')
export class MovementController {
  constructor(private readonly movementService: MovementService) {}

  @Roles('Administrator', 'Management', 'SSE', 'WRS_5_Inspector', 'Shop_InCharge', 'Yard_Master')
  @Post()
  @ApiOperation({ summary: 'Record a state transition for an asset' })
  recordMovement(@Body() createMovementDto: CreateMovementDto, @Request() req) {
    return this.movementService.recordMovement(createMovementDto, req.user.userId);
  }
}
