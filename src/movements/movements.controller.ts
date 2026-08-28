import { Controller, Post, Body, UseGuards, Request } from '@nestjs/common';
import { MovementsService, CreateMovementDto } from './movements.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';

@ApiTags('Movements')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('movements')
export class MovementsController {
  constructor(private readonly movementsService: MovementsService) {}

  @Post()
  @ApiOperation({ summary: 'Log a new movement for an asset' })
  async createMovement(@Request() req, @Body() data: Omit<CreateMovementDto, 'handled_by'>) {
    return this.movementsService.createMovement({
      ...data,
      handled_by: req.user.userId,
    });
  }
}
