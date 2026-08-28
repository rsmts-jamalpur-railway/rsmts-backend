import { Controller, Post, Patch, Body, Param, UseGuards, Request } from '@nestjs/common';
import { ExceptionsService, RaiseExceptionDto, ResolveExceptionDto } from './exceptions.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';

@ApiTags('Exceptions')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('exceptions')
export class ExceptionsController {
  constructor(private readonly exceptionsService: ExceptionsService) {}

  @Post()
  @ApiOperation({ summary: 'Raise a new exception against an asset' })
  async raiseException(@Request() req, @Body() data: RaiseExceptionDto) {
    return this.exceptionsService.raiseException(req.user.userId, data);
  }

  @Patch(':id/resolve')
  @ApiOperation({ summary: 'Resolve an active exception' })
  async resolveException(@Request() req, @Param('id') exceptionId: string, @Body() data: ResolveExceptionDto) {
    return this.exceptionsService.resolveException(req.user.userId, exceptionId, data);
  }
}
