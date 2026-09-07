import { Injectable, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  constructor() {
    const connectionString =
      process.env.DATABASE_URL ||
      process.env.DATABASE_PRIVATE_URL ||
      process.env.POSTGRES_URL;
    if (connectionString) {
      const pool = new Pool({ connectionString });
      const adapter = new PrismaPg(pool);
      super({ adapter });
    } else {
      super();
    }
  }

  async onModuleInit() {
    await this.$connect();
  }
}
