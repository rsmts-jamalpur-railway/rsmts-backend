import { Injectable, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  constructor() {
    let connectionString =
      process.env.DATABASE_PUBLIC_URL ||
      process.env.DATABASE_PRIVATE_URL ||
      process.env.DATABASE_URL ||
      process.env.POSTGRES_URL;

    if (connectionString) {
      connectionString = connectionString.replace(/^"|"$/g, '').replace(/^'|'$/g, '');
    }

    if (!connectionString) {
      throw new Error(
        'DATABASE_URL is not defined in the environment variables. Please configure it in your Railway service variables.',
      );
    }

    const pool = new Pool({ connectionString });
    const adapter = new PrismaPg(pool);
    super({
      adapter,
    });
  }

  async onModuleInit() {
    await this.$connect();
  }
}
