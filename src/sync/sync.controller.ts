import { Controller, Get, Post, Query, Body, Request, UseGuards, BadRequestException } from '@nestjs/common';
import type { PullSyncQuery } from './sync.service';
import { SyncService } from './sync.service';
import { SyncDispatcher } from './sync.dispatcher';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('sync')
@UseGuards(JwtAuthGuard)
export class SyncController {
  constructor(
    private readonly syncService: SyncService,
    private readonly syncDispatcher: SyncDispatcher,
  ) {}

  @Get('pull')
  async pull(@Query() query: PullSyncQuery) {
    if (!query.last_revision) {
      throw new BadRequestException('last_revision query parameter is required');
    }
    return await this.syncService.pull(query);
  }

  @Post('push')
  async push(@Request() req, @Body() data: any) {
    // WatermelonDB Push format:
    // { changes: { table_name: { created: [], updated: [], deleted: [] } } }
    // However, we strictly rely on `sync_operations` (the Outbox) to maintain business logic 
    // instead of arbitrary CRUD operations.
    
    if (!data || !data.changes || !data.changes.sync_operations) {
      // If there are no outbox operations to process, just return success
      return { message: 'Push success (no operations)' };
    }

    const operations = data.changes.sync_operations.created || [];
    
    // We process the operations sequentially to preserve causal ordering
    const results: any[] = [];
    const errors: any[] = [];

    for (const op of operations) {
      try {
        const result = await this.syncDispatcher.dispatch(req.user.userId, req.user.assignedLocationId, op);
        results.push({ 
          client_operation_id: op.client_operation_id, 
          status: result.status || 'SUCCESS', 
          server_id: result.server_id,
          entity: result.entity,
          ...result
        });
      } catch (err: any) {
        let code = 'INTERNAL_SERVER_ERROR';
        const errStr = err.message || '';
        
        if (err.status === 400 || err.status === 403 || err.status === 404 || err.status === 409) {
           if (errStr.includes('maximum capacity')) code = 'CAPACITY_EXCEEDED';
           else if (errStr.includes('Asset cannot start repair') || errStr.includes('Can only hold') || errStr.includes('Cycle must be ACTIVE') || errStr.includes('Cannot complete')) code = 'INVALID_STATE_TRANSITION';
           else if (err.status === 403) code = 'FORBIDDEN_SCOPE';
           else if (err.status === 404 || errStr.includes('not found')) code = 'RESOURCE_NOT_FOUND';
           else code = 'VALIDATION_ERROR';
        }

        errors.push({ 
          client_operation_id: op.client_operation_id, 
          status: 'ERROR', 
          message: errStr,
          code
        });
      }
    }

    return { 
      message: 'Push processed',
      results,
      errors 
    };
  }
}
