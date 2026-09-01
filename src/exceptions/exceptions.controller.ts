import { Controller, Post, Patch, Body, Param, UseGuards, Request } from '@nestjs/common';
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

  @Post()
  @ApiOperation({ summary: 'Report a new exception against an asset (Web)' })
  async reportException(@Request() req, @Body() data: RaiseExceptionDto) {
    // The mobile client uses outbox /sync/push, but web clients can hit this directly
    return this.exceptionsService.reportException(req.user.userId, data);
  }

  @Patch(':id/resolve')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Resolve an active exception (Web Admin only)' })
  async resolveException(@Request() req, @Param('id') exceptionId: string, @Body() data: ResolveExceptionDto) {
    return this.exceptionsService.resolveException(req.user.userId, exceptionId, data);
  }
}
