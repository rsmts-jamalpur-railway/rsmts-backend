import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import * as Joi from 'joi';
import { LoggerModule } from 'nestjs-pino';
import { CacheModule } from '@nestjs/cache-manager';
import { redisStore } from 'cache-manager-redis-yet';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { CoreModule } from './core/core.module';
import { HealthModule } from './health/health.module';
import { AuthModule } from './auth/auth.module';
import { WagonValidationModule } from './shared/wagon-validation/wagon-validation.module';
import { UploadModule } from './shared/upload/upload.module';
import { AuditModule } from './shared/audit/audit.module';
import { NotificationModule } from './shared/notification/notification.module';
import { UsersModule } from './modules/users/users.module';
import { RolesModule } from './modules/roles/roles.module';
import { LocationsModule } from './modules/locations/locations.module';
import { SettingsModule } from './modules/settings/settings.module';
import { AssetsModule } from './modules/assets/assets.module';
import { StateMachineModule } from './modules/state-machine/state-machine.module';
import { MovementModule } from './modules/movement/movement.module';
import { OfflineSyncModule } from './modules/offline-sync/offline-sync.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { ReportsModule } from './modules/reports/reports.module';
import { EventsModule } from './events/events.module';

@Module({
  imports: [
    // 1. Environment Config & Validation
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema: Joi.object({
        PORT: Joi.number().default(3001),
        DATABASE_URL: Joi.string().required(),
        JWT_SECRET: Joi.string().required(),
        REDIS_URL: Joi.string().default('redis://localhost:6379'),
      }),
    }),

    // 2. Logger (Pino)
    LoggerModule.forRoot({
      pinoHttp: {
        transport:
          process.env.NODE_ENV !== 'production'
            ? { target: 'pino-pretty' }
            : undefined,
        level: process.env.NODE_ENV !== 'production' ? 'debug' : 'info',
      },
    }),

    // 3. Redis Cache
    CacheModule.registerAsync({
      isGlobal: true,
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        store: await redisStore({
          url: configService.get<string>('REDIS_URL'),
        }),
      }),
      inject: [ConfigService],
    }),

    // 4. Rate Limiting
    ThrottlerModule.forRoot([
      {
        ttl: 60000,
        limit: 100, // 100 requests per minute
      },
    ]),

    PrismaModule,
    CoreModule,
    HealthModule,
    AuthModule,
    WagonValidationModule,
    UploadModule,
    AuditModule,
    NotificationModule,
    UsersModule,
    RolesModule,
    LocationsModule,
    SettingsModule,
    AssetsModule,
    StateMachineModule,
    MovementModule,
    OfflineSyncModule,
    DashboardModule,
    ReportsModule,
    EventsModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
