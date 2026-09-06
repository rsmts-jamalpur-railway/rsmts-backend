import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SettingsService {
  private readonly logger = new Logger(SettingsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Default system settings for RSMTS Jamalpur Workshop
   */
  private readonly defaultSettings = [
    {
      key: 'WORKSHOP_NAME',
      value: 'Jamalpur Locomotive & Carriage Workshop',
      description: 'Primary Indian Railways manufacturing and POH/ROH facility name',
    },
    {
      key: 'WORKSHOP_CODE',
      value: 'JMP',
      description: 'Three-letter Indian Railways workshop identifier',
    },
    {
      key: 'DEFAULT_RAILWAY_ZONE',
      value: 'ER',
      description: 'Host zonal railway code (Eastern Railway)',
    },
    {
      key: 'CHECK_DIGIT_ENFORCEMENT',
      value: 'STRICT',
      description: 'Enforce Indian Railways 6-Step Modulo-10 check digit verification on 11-digit wagons',
    },
    {
      key: 'ACTIVE_ASSET_CATEGORIES',
      value: 'WAGON,LOCO,CRANE,TOWER_CAR',
      description: 'Supported rolling stock categories active in command center',
    },
    {
      key: 'SESSION_TIMEOUT_MINS',
      value: '60',
      description: 'Inactivity period before requiring user re-authentication',
    },
    {
      key: 'SYNC_INTERVAL_SECONDS',
      value: '30',
      description: 'Background polling interval for offline mobile terminal synchronization',
    },
  ];

  /**
   * Get all system configuration settings
   */
  async findAll() {
    let settings = await this.prisma.setting.findMany({
      orderBy: { key: 'asc' },
    });

    // Auto-seed default settings if table is empty
    if (settings.length === 0) {
      this.logger.log('Initializing default RSMTS system settings...');
      for (const def of this.defaultSettings) {
        await this.prisma.setting.upsert({
          where: { key: def.key },
          update: {},
          create: def,
        });
      }
      settings = await this.prisma.setting.findMany({
        orderBy: { key: 'asc' },
      });
    }

    return {
      success: true,
      data: settings,
    };
  }

  /**
   * Update a specific system configuration setting
   */
  async update(key: string, value: string, userId?: string) {
    const updated = await this.prisma.setting.upsert({
      where: { key },
      update: { value },
      create: {
        key,
        value,
        description: `Configured parameter for ${key}`,
      },
    });

    // Record audit log entry if user context is available
    if (userId) {
      await this.logAudit(userId, 'SETTING_UPDATED', {
        setting_key: key,
        new_value: value,
      });
    }

    this.logger.log(`Setting ${key} updated to "${value}" by user ${userId || 'SYSTEM'}`);

    return {
      success: true,
      message: `Setting ${key} successfully updated.`,
      data: updated,
    };
  }

  /**
   * Get security audit log history with user profile information
   */
  async getAuditLogs(limit = 50) {
    const logs = await this.prisma.auditLog.findMany({
      take: limit,
      orderBy: { timestamp: 'desc' },
      include: {
        user: {
          include: {
            employee: true,
          },
        },
      },
    });

    return {
      success: true,
      count: logs.length,
      data: logs.map((log) => ({
        id: log.id,
        user_id: log.user_id,
        action: log.action,
        details: log.details,
        timestamp: log.timestamp.toISOString(),
        user: log.user
          ? {
              employee_id: log.user.employee?.employee_number || 'SYS',
              full_name: `${log.user.employee?.first_name || 'System'} ${log.user.employee?.last_name || 'Admin'}`.trim(),
            }
          : undefined,
      })),
    };
  }

  /**
   * Helper to write an audit log entry
   */
  async logAudit(userId: string, action: string, details?: any) {
    try {
      await this.prisma.auditLog.create({
        data: {
          user_id: userId,
          action,
          details: details || {},
        },
      });
    } catch (err: any) {
      this.logger.warn(`Failed to write audit log: ${err.message}`);
    }
  }
}
