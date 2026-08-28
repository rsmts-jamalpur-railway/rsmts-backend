import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export class RaiseExceptionDto {
  asset_id: string;
  type: string;
  severity: string;
  reason: string;
}

export class ResolveExceptionDto {
  resolution: string;
}

@Injectable()
export class ExceptionsService {
  private readonly logger = new Logger(ExceptionsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async raiseException(userId: string, data: RaiseExceptionDto) {
    const exception = await this.prisma.exception.create({
      data: {
        asset_id: data.asset_id,
        type: data.type,
        status: 'OPEN',
        severity: data.severity,
        reason: data.reason,
        reported_by: userId,
      }
    });

    // We do NOT mutate the asset's current_status! 
    // The asset remains in 'REPAIR' or 'ALLOCATED' etc, but now it has an active Exception.

    this.logger.log(`Raised exception ${exception.id} for asset ${data.asset_id}`);
    return exception;
  }

  async resolveException(userId: string, exceptionId: string, data: ResolveExceptionDto) {
    const exception = await this.prisma.exception.findUnique({
      where: { id: exceptionId }
    });

    if (!exception) {
      throw new NotFoundException(`Exception ${exceptionId} not found.`);
    }

    const resolved = await this.prisma.exception.update({
      where: { id: exceptionId },
      data: {
        status: 'RESOLVED',
        resolution: data.resolution,
        resolved_at: new Date(),
        resolved_by: userId
      }
    });

    this.logger.log(`Resolved exception ${exceptionId}`);
    return resolved;
  }
}
