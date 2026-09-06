import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SyncEventService } from '../sync/sync-event.service';
import { SyncEntity, SyncAction } from '@prisma/client';
import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class RaiseExceptionDto {
  @IsString()
  @IsNotEmpty()
  client_operation_id: string;

  @IsOptional()
  @IsString()
  asset_id?: string;

  @IsOptional()
  @IsString()
  asset_number?: string;

  @IsString()
  @IsNotEmpty()
  type: string;

  @IsString()
  @IsNotEmpty()
  severity: string;

  @IsString()
  @IsNotEmpty()
  reason: string;
}

export class ResolveExceptionDto {
  @IsString()
  @IsNotEmpty()
  resolution: string;
}

@Injectable()
export class ExceptionsService {
  private readonly logger = new Logger(ExceptionsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly syncEventService: SyncEventService,
  ) {}

  async reportException(userId: string, data: RaiseExceptionDto) {
    return await this.prisma.$transaction(async (tx) => {
      // Idempotency check
      const existing = await tx.exception.findFirst({
        where: { client_operation_id: data.client_operation_id }
      });
      if (existing) {
        return { message: 'Idempotent success', exception_id: existing.id };
      }

      // Reconcile asset identity
      let asset = data.asset_id ? await tx.asset.findUnique({ where: { id: data.asset_id } }) : null;
      if (!asset && data.asset_number) {
        asset = await tx.asset.findUnique({ where: { asset_number: data.asset_number } });
      }
      if (!asset) {
        throw new NotFoundException('Asset not found for exception reporting.');
      }

      const exception = await tx.exception.create({
        data: {
          client_operation_id: data.client_operation_id,
          asset_id: asset.id,
          type: data.type,
          status: 'OPEN',
          severity: data.severity,
          reason: data.reason,
          reported_by: userId,
        }
      });

      const updatedAsset = await tx.asset.update({
        where: { id: asset.id },
        data: {
          current_status: 'EXCEPTION_LOGGED'
        }
      });

      await this.syncEventService.record(tx, SyncEntity.EXCEPTION, SyncAction.CREATED, exception.id, exception);
      await this.syncEventService.record(tx, SyncEntity.ASSET, SyncAction.UPDATED, updatedAsset.id, updatedAsset);

      this.logger.log(`Reported exception ${exception.id} for asset ${asset.asset_number}`);
      return { exception_id: exception.id, asset_id: asset.id, status: 'SUCCESS' };
    });
  }

  async resolveException(userId: string, exceptionId: string, data: ResolveExceptionDto) {
    return await this.prisma.$transaction(async (tx) => {
      const exception = await tx.exception.findUnique({
        where: { id: exceptionId }
      });

      if (!exception) {
        throw new NotFoundException(`Exception ${exceptionId} not found.`);
      }

      const resolved = await tx.exception.update({
        where: { id: exceptionId },
        data: {
          status: 'RESOLVED',
          resolution: data.resolution,
          resolved_at: new Date(),
          resolved_by: userId
        }
      });

      await this.syncEventService.record(tx, SyncEntity.EXCEPTION, SyncAction.UPDATED, resolved.id, resolved);

      this.logger.log(`Resolved exception ${exceptionId}`);
      return resolved;
    });
  }

  async getExceptions(status?: string, limit = 50) {
    const where: any = {};
    if (status && status !== 'all') {
      where.status = status.toUpperCase();
    }

    const exceptions = await this.prisma.exception.findMany({
      where,
      take: Number(limit) || 50,
      orderBy: { createdAt: 'desc' },
      include: {
        asset: {
          select: {
            asset_number: true,
            current_location: true,
            current_status: true,
            category_id: true,
          },
        },
        reporter: {
          select: {
            employee: {
              select: {
                first_name: true,
                last_name: true,
                employee_number: true,
              },
            },
          },
        },
      },
    });

    return {
      success: true,
      count: exceptions.length,
      data: exceptions,
    };
  }
}
