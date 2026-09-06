import { Controller, Post, Get, Body, Query, UseGuards, Request } from '@nestjs/common';
import { MovementsService, CreateMovementDto } from './movements.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';

@ApiTags('Movements')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller(['movements', 'movement'])
export class MovementsController {
  constructor(private readonly movementsService: MovementsService) {}

  @Get()
  @ApiOperation({ summary: 'Get recent movement logs' })
  @ApiQuery({ name: 'limit', required: false, example: 50 })
  async getMovements(@Query('limit') limit?: number) {
    return this.movementsService.findRecent(limit);
  }

  @Post()
  @ApiOperation({ summary: 'Log a new movement for an asset' })
  async createMovement(@Request() req, @Body() data: Omit<CreateMovementDto, 'handled_by'>) {
    return this.movementsService.createMovement({
      ...data,
      handled_by: req.user.userId,
    });
  }
}
