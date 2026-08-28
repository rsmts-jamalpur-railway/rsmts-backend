import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { OfflineSyncService } from './offline-sync.service';
import { SyncPushDto } from './dto/sync.dto';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';

@ApiTags('Offline Sync (WatermelonDB)')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('sync')
export class OfflineSyncController {
  constructor(private readonly offlineSyncService: OfflineSyncService) {}

  @Get('pull')
  @ApiOperation({ summary: 'Pull changes from server' })
  @ApiQuery({ name: 'lastPulledAt', required: true, type: Number })
  pullChanges(@Query('lastPulledAt') lastPulledAt: number, @Request() req) {
    return this.offlineSyncService.pullChanges(
      Number(lastPulledAt),
      req.user.userId,
    );
  }

  @Post('push')
  @ApiOperation({ summary: 'Push offline changes to server' })
  pushChanges(@Body() dto: SyncPushDto, @Request() req) {
    return this.offlineSyncService.pushChanges(dto, req.user.userId);
  }

  @Get('status')
  @ApiOperation({ summary: 'Get sync health of all devices' })
  getSyncStatus() {
    return this.offlineSyncService.getSyncStatus();
  }
}
