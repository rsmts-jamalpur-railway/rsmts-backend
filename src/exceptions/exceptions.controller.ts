import { Controller, Get, Post, Patch, Body, Param, UseGuards, Request } from '@nestjs/common';
import { ExceptionsService, RaiseExceptionDto, ResolveExceptionDto } from './exceptions.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard, Roles } from '../auth/roles.guard';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';

@ApiTags('Exceptions')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('exceptions')
export class ExceptionsController {
  constructor(private readonly exceptionsService: ExceptionsService) {}

  @Get()
  @ApiOperation({ summary: 'Get list of reported exceptions' })
  async getExceptions(@Request() req) {
    const status = req.query?.status;
    const limit = req.query?.limit;
    return this.exceptionsService.getExceptions(status, limit);
  }

  @Post()
  @ApiOperation({ summary: 'Report a new exception against an asset (Web)' })
  async reportException(@Request() req, @Body() data: RaiseExceptionDto) {
    // The mobile client uses outbox /sync/push, but web clients can hit this directly
    return this.exceptionsService.reportException(req.user.userId, data);
  }

  @Patch(':id/resolve')
  @Roles('ADMIN', 'SYSTEM_ADMIN')
  @ApiOperation({ summary: 'Resolve an active exception (Web Admin only)' })
  async resolveException(@Request() req, @Param('id') exceptionId: string, @Body() data: ResolveExceptionDto) {
    return this.exceptionsService.resolveException(req.user.userId, exceptionId, data);
  }
}

