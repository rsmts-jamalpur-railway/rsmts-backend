import { Controller, Get, Patch, Param, Body, UseGuards, Req } from '@nestjs/common';
import { SettingsService } from './settings.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';

@ApiTags('Settings')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('settings')
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get()
  @ApiOperation({ summary: 'Get all system settings' })
  async getSettings() {
    return this.settingsService.findAll();
  }

  @Patch(':key')
  @ApiOperation({ summary: 'Update a specific system setting' })
  async updateSetting(
    @Param('key') key: string,
    @Body('value') value: string,
    @Req() req: any,
  ) {
    const userId = req.user?.userId || req.user?.sub;
    return this.settingsService.update(key, String(value), userId);
  }
}

@ApiTags('Audit')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('audit')
export class AuditController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get()
  @ApiOperation({ summary: 'Get recent system security audit logs' })
  async getAuditLogs() {
    return this.settingsService.getAuditLogs(100);
  }
}
