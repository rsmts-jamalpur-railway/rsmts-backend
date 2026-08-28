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
import { MovementsModule } from './movements/movements.module';
import { AssetsModule } from './assets/assets.module';
import { ExceptionsModule } from './exceptions/exceptions.module';
import { YardModule } from './yard/yard.module';
import { RepairModule } from './repair/repair.module';
import { ManufacturingModule } from './manufacturing/manufacturing.module';
import { QaModule } from './qa/qa.module';

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
      useFactory: async (configService: ConfigService) => {
        const store = await redisStore({
          url: configService.get<string>('REDIS_URL'),
        });

        // Prevent unhandled error crashes on ECONNRESET
        if (store.client) {
          store.client.on('error', (err: any) => {
            console.error('Redis Client Error:', err.message);
          });
        }

        return { store };
      },
      inject: [ConfigService],
    }),

    // 4. Rate Limiting
    ThrottlerModule.forRoot([
      {
        ttl: 60000,
        limit: 1000, // 1000 requests per minute
      },
    ]),

    PrismaModule,
    CoreModule,
    HealthModule,
    AuthModule,
    MovementsModule,
    AssetsModule,
    ExceptionsModule,
    YardModule,
    RepairModule,
    ManufacturingModule,
    QaModule,
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
