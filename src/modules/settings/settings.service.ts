import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { UpdateSettingDto } from './dto/update-setting.dto';
import { AuditService } from '../../shared/audit/audit.service';

@Injectable()
export class SettingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  findAll() {
    return this.prisma.setting.findMany();
  }

  async findOne(keyParam: string) {
    const setting = await this.prisma.setting.findUnique({
      where: { key: keyParam },
    });
    if (!setting) throw new NotFoundException('Setting not found');
    return setting;
  }

  async update(
    keyParam: string,
    updateSettingDto: UpdateSettingDto,
    currentUserId: string,
  ) {
    if (keyParam === 'ASSET_FORM_CONFIG') {
      try {
        const parsed = JSON.parse(updateSettingDto.setting_value);
        if (!parsed.origins || !parsed.actions || !parsed.customFields) {
          throw new BadRequestException('Invalid config structure. Must contain origins, actions, and customFields.');
        }
      } catch (e) {
        throw new BadRequestException(`Invalid JSON format: ${e.message}`);
      }
    }
    const setting = await this.prisma.setting.update({
      where: { key: keyParam },
      data: {
        value: updateSettingDto.setting_value,
      },
    });

    await this.audit.logAction(currentUserId, 'UPDATE_SETTING', {
      key: keyParam,
      value: updateSettingDto.setting_value,
    });
    return setting;
  }
}
