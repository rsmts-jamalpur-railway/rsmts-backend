import { Module } from '@nestjs/common';
import { DashboardController, LocationsLegacyController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [DashboardController, LocationsLegacyController],
  providers: [DashboardService],
  exports: [DashboardService],
})
export class DashboardModule {}
