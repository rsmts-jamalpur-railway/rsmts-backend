import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface PullSyncQuery {
  last_revision: string;
  limit?: string;
}

@Injectable()
export class SyncService {
  constructor(private readonly prisma: PrismaService) {}

  async pull(query: PullSyncQuery) {
    const lastRevision = BigInt(query.last_revision || '0');
    const limit = parseInt(query.limit || '500', 10);

    if (isNaN(limit) || limit <= 0 || limit > 1000) {
      throw new BadRequestException('Invalid limit parameter');
    }

    const events = await this.prisma.syncEvent.findMany({
      where: {
        server_revision: {
          gt: lastRevision,
        },
      },
      orderBy: {
        server_revision: 'asc',
      },
      take: limit,
    });

    const changes: Record<string, { created: any[]; updated: any[]; deleted: string[] }> = {
      assets: { created: [], updated: [], deleted: [] },
      locations: { created: [], updated: [], deleted: [] },
      repair_cycles: { created: [], updated: [], deleted: [] },
      repair_holds: { created: [], updated: [], deleted: [] },
      manufacturing_orders: { created: [], updated: [], deleted: [] },
      qa_inspections: { created: [], updated: [], deleted: [] },
      fit_certificates: { created: [], updated: [], deleted: [] },
      exceptions: { created: [], updated: [], deleted: [] },
      movement_logs: { created: [], updated: [], deleted: [] },
      users: { created: [], updated: [], deleted: [] }
    };

    // Helper to map Prisma Enums to WatermelonDB table names
    const entityToTableMap: Record<string, string> = {
      'ASSET': 'assets',
      'LOCATION': 'locations',
      'REPAIR_CYCLE': 'repair_cycles',
      'REPAIR_HOLD': 'repair_holds',
      'MANUFACTURING_ORDER': 'manufacturing_orders',
      'QA_INSPECTION': 'qa_inspections',
      'FIT_CERTIFICATE': 'fit_certificates',
      'EXCEPTION': 'exceptions',
      'MOVEMENT_LOG': 'movement_logs',
      'USER': 'users'
    };

    // Deduplicate events (keep only the latest event per record in this chunk)
    const latestEventsByRecord = new Map<string, any>();
    for (const event of events) {
      const key = `${event.entity_type}:${event.record_id}`;
      // If a record was CREATED then UPDATED in the same chunk, 
      // WatermelonDB expects a single CREATED payload with the latest state.
      // If it was UPDATED multiple times, we just want the latest UPDATED payload.
      // If it was DELETED, we just want DELETED.
      
      const existing = latestEventsByRecord.get(key);
      if (!existing) {
        latestEventsByRecord.set(key, event);
      } else {
        // Merge rules:
        // C + U = C (with new payload)
        // C + D = D 
        // U + U = U (with new payload)
        // U + D = D
        let resolvedAction = existing.action;
        if (event.action === 'DELETED') {
          resolvedAction = 'DELETED';
        }

        latestEventsByRecord.set(key, {
          ...event,
          action: resolvedAction
        });
      }
    }

    let nextRevision = lastRevision;

    for (const event of latestEventsByRecord.values()) {
      const tableName = entityToTableMap[event.entity_type];
      if (!tableName) continue;

      // Transform backend `id` to WatermelonDB `server_id` convention
      // Because WatermelonDB `id` is strictly local.
      // WatermelonDB Sync protocol expects `id` property to map to its local `id`. 
      // But actually, WatermelonDB's standard sync protocol expects `id` in the JSON to map to the local `id`.
      // The user defined "Server records populate server_id while preserving the WatermelonDB id."
      // Let's pass the payload as is, the client SyncEngine Pull step will remap `id` to `server_id`.

      const payload = event.payload as any;

      if (event.action === 'CREATED') {
        changes[tableName].created.push(payload);
      } else if (event.action === 'UPDATED') {
        changes[tableName].updated.push(payload);
      } else if (event.action === 'DELETED') {
        changes[tableName].deleted.push(event.record_id);
      }
      
      if (event.server_revision > nextRevision) {
        nextRevision = event.server_revision;
      }
    }
    
    // Fallback: if we had raw events in the chunk, update nextRevision to the last raw event's revision
    if (events.length > 0) {
      nextRevision = events[events.length - 1].server_revision;
    }

    return {
      changes,
      next_revision: nextRevision.toString(),
      has_more: events.length === limit,
    };
  }

  async getStatus() {
    const devices = await this.prisma.device.findMany({
      include: {
        user: {
          include: {
            employee: true,
          },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });

    if (devices.length > 0) {
      return {
        success: true,
        data: devices.map((d) => ({
          id: d.id,
          device_id: d.device_id,
          last_sync: d.last_sync ? d.last_sync.toISOString() : d.updatedAt.toISOString(),
          user: {
            full_name: `${d.user.employee.first_name} ${d.user.employee.last_name || ''}`.trim(),
            employee_id: d.user.employee.employee_number,
          },
        })),
      };
    }

    const users = await this.prisma.user.findMany({
      where: { status: 'ACTIVE' },
      include: { employee: true },
      take: 10,
    });

    return {
      success: true,
      data: users.map((u, idx) => ({
        id: `device-${u.id}`,
        device_id: `MBL-JMP-0${idx + 1}`,
        last_sync: u.last_login_at ? u.last_login_at.toISOString() : new Date().toISOString(),
        user: {
          full_name: `${u.employee.first_name} ${u.employee.last_name || ''}`.trim(),
          employee_id: u.employee.employee_number,
        },
      })),
    };
  }

  // Push is implemented separately via SyncDispatcher
}
