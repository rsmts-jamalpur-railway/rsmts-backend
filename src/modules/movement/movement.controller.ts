import { Controller, Post, Body, UseGuards, Request } from '@nestjs/common';
import { MovementService } from './movement.service';
import { CreateMovementDto } from './dto/create-movement.dto';
import { WorkflowMovementDto } from './dto/workflow-movement.dto';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { RolesGuard, Roles } from '../../auth/roles.guard';

@ApiTags('Movement & Tracking (Workflows)')
@ApiBearerAuth()
@UseGuards(RolesGuard)
@Controller('movement')
export class MovementController {
  constructor(private readonly movementService: MovementService) {}

  @Roles(
    'Administrator',
    'Management',
    'SSE',
    'WRS_5_Inspector',
    'Shop_InCharge',
    'Yard_Master',
  )
  @Post()
  @ApiOperation({ summary: 'Record a raw state transition (Generic)' })
  recordMovement(@Body() createMovementDto: CreateMovementDto, @Request() req) {
    return this.movementService.recordMovement(
      createMovementDto,
      req.user.userId,
    );
  }

  // --- Phase 12-15 Explicit Workflows ---

  @Roles('Administrator', 'Management', 'SSE')
  @Post('allocate')
  @ApiOperation({ summary: 'Allocate a wagon to a specific shop' })
  allocate(@Body() dto: WorkflowMovementDto, @Request() req) {
    return this.movementService.recordMovement(
      { ...dto, new_status: 'Allocated' },
      req.user.userId,
    );
  }

  @Roles('Administrator', 'Management', 'Shop_InCharge')
  @Post('accept')
  @ApiOperation({ summary: 'Accept a wagon into the shop' })
  accept(@Body() dto: WorkflowMovementDto, @Request() req) {
    return this.movementService.recordMovement(
      { ...dto, new_status: 'Accepted' },
      req.user.userId,
    );
  }

  @Roles('Administrator', 'Management', 'Shop_InCharge')
  @Post('repair')
  @ApiOperation({ summary: 'Mark wagon as under repair' })
  repair(@Body() dto: WorkflowMovementDto, @Request() req) {
    return this.movementService.recordMovement(
      { ...dto, new_status: 'Repair' },
      req.user.userId,
    );
  }

  @Roles('Administrator', 'Management', 'Shop_InCharge')
  @Post('shop-out')
  @ApiOperation({ summary: 'Mark wagon as shop out (Ready for WRS-5 testing)' })
  shopOut(@Body() dto: WorkflowMovementDto, @Request() req) {
    return this.movementService.recordMovement(
      { ...dto, new_status: 'Shop Out' },
      req.user.userId,
    );
  }

  @Roles('Administrator', 'Management', 'WRS_5_Inspector')
  @Post('wrs5-fit')
  @ApiOperation({ summary: 'WRS-5 tests passed, mark as Fit' })
  wrs5Fit(@Body() dto: WorkflowMovementDto, @Request() req) {
    return this.movementService.recordMovement(
      { ...dto, new_status: 'Fit' },
      req.user.userId,
    );
  }

  @Roles('Administrator', 'Management', 'WRS_5_Inspector')
  @Post('wrs5-reject')
  @ApiOperation({ summary: 'WRS-5 tests failed, send back to Repair' })
  wrs5Reject(@Body() dto: WorkflowMovementDto, @Request() req) {
    return this.movementService.recordMovement(
      { ...dto, new_status: 'Repair' },
      req.user.userId,
    );
  }

  @Roles('Administrator', 'Management', 'SSE')
  @Post('dispatch')
  @ApiOperation({ summary: 'Final dispatch of the wagon from the workshop' })
  dispatch(@Body() dto: WorkflowMovementDto, @Request() req) {
    return this.movementService.recordMovement(
      { ...dto, new_status: 'Dispatched' },
      req.user.userId,
    );
  }
}
