import { Controller, Get, Patch, Param, Body, UseGuards, Request } from '@nestjs/common';
import { SettingsService } from './settings.service';
import { UpdateSettingDto } from './dto/update-setting.dto';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { RolesGuard, Roles } from '../../auth/roles.guard';

@ApiTags('Settings (Admin Only)')
@ApiBearerAuth()
@UseGuards(RolesGuard)
@Roles('Administrator')
@Controller('settings')
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get()
  @ApiOperation({ summary: 'Get all system settings' })
  findAll() {
    return this.settingsService.findAll();
  }

  @Get(':key')
  @ApiOperation({ summary: 'Get specific setting' })
  findOne(@Param('key') key: string) {
    return this.settingsService.findOne(key);
  }

  @Patch(':key')
  @ApiOperation({ summary: 'Update system setting' })
  update(@Param('key') key: string, @Body() updateSettingDto: UpdateSettingDto, @Request() req) {
    return this.settingsService.update(key, updateSettingDto, req.user.userId);
  }
}
