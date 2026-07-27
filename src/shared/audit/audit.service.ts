import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Log an action to the AuditLog table
   */
  async logAction(userId: string, action: string, details?: any) {
    return this.prisma.auditLog.create({
      data: {
        user_id: userId,
        action,
        details: details || {},
      },
    });
  }
}
