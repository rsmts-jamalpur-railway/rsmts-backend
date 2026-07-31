import { Controller, Get, UseGuards } from '@nestjs/common';
import { AuditService } from './audit.service';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { RolesGuard, Roles } from '../../auth/roles.guard';

@ApiTags('Audit Logs (Admin Only)')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('Administrator')
@Controller('audit')
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  @ApiOperation({ summary: 'Get recent audit logs' })
  getAuditLogs() {
    return this.auditService.getAuditLogs();
  }
}
