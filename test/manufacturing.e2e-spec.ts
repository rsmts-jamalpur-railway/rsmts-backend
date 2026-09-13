import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { ManufacturingService } from '../src/manufacturing/manufacturing.service';
import { randomUUID } from 'crypto';

describe('Manufacturing Workflow (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let manufacturingService: ManufacturingService;
  let userId: string;
  let assetNumber: string;
  let orderId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
    prisma = app.get(PrismaService);
    manufacturingService = app.get(ManufacturingService);

    const user = await prisma.user.findFirst();
    if (!user) throw new Error('No user found in DB');
    userId = user.id;
  });

  afterAll(async () => {
    await app.close();
  });

  it('should complete a manufacturing cycle', async () => {
    assetNumber = `NEW-WAG-${Date.now()}`;
    
    // 1. Start Manufacturing
    const startRes = await manufacturingService.startManufacturing(userId, 'GIF', {
      client_operation_id: randomUUID(),
      asset_number: assetNumber,
      category_id: 'BOXN',
      shop_id: 'GIF'
    });
    expect(startRes).toBeDefined();
    orderId = startRes.order_id;

    let assetState = await prisma.asset.findUnique({ where: { asset_number: assetNumber } });
    expect(assetState!.current_status).toBe('IN_MANUFACTURING');

    // 2. Close Manufacturing
    await manufacturingService.closeManufacturing(userId, 'GIF', {
      client_operation_id: randomUUID(),
      order_id: orderId,
      notes: 'Completed build'
    });

    assetState = await prisma.asset.findUnique({ where: { asset_number: assetNumber } });
    expect(assetState!.current_status).toBe('PENDING_QA');
  });
});
