import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { RepairService } from '../src/repair/repair.service';
import { YardService } from '../src/yard/yard.service';
import { randomUUID } from 'crypto';

describe('Repair Workflow (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let repairService: RepairService;
  let yardService: YardService;
  let userId: string;
  let assetId: string;
  let assetNumber: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
    prisma = app.get(PrismaService);
    repairService = app.get(RepairService);
    yardService = app.get(YardService);

    const user = await prisma.user.findFirst();
    if (!user) throw new Error('No user found in DB');
    userId = user.id;
  });

  afterAll(async () => {
    await app.close();
  });

  it('should complete a full repair cycle', async () => {
    assetNumber = `REP-${Date.now()}`;
    
    // 1. Intake the asset
    await yardService.intakeAsset(userId, 'YARD', {
      client_operation_id: randomUUID(),
      asset_number: assetNumber,
      category_id: 'BOXN',
      from_railway: 'NR'
    });
    
    const asset = await prisma.asset.findUnique({ where: { asset_number: assetNumber } });
    assetId = asset!.id;

    // 2. Allocate
    await yardService.allocateAsset(userId, {
      client_operation_id: randomUUID(),
      asset_id: assetId,
      shop_id: 'WRS-1'
    });

    // 3. Start Repair
    const startRes = await repairService.startRepair(userId, 'WRS-1', {
      client_operation_id: randomUUID(),
      asset_id: assetId,
      repair_category_id: 'POH',
      shop_id: 'WRS-1'
    });
    expect(startRes).toBeDefined();
    const cycleId = startRes.cycle_id;

    let assetState = await prisma.asset.findUnique({ where: { id: assetId } });
    expect(assetState!.current_status).toBe('IN_REPAIR');

    // 4. Hold Repair
    await repairService.putOnHold(userId, {
      client_operation_id: randomUUID(),
      cycle_id: cycleId,
      asset_id: assetId
    });

    assetState = await prisma.asset.findUnique({ where: { id: assetId } });
    expect(assetState!.current_status).toBe('ON_HOLD');

    // 5. Resume Repair
    await repairService.resumeRepair(userId, {
      client_operation_id: randomUUID(),
      cycle_id: cycleId,
      asset_id: assetId
    });

    assetState = await prisma.asset.findUnique({ where: { id: assetId } });
    expect(assetState!.current_status).toBe('IN_REPAIR');

    // 6. Close Repair
    await repairService.closeRepair(userId, 'WRS-1', {
      client_operation_id: randomUUID(),
      cycle_id: cycleId,
      asset_id: assetId,
      shop_id: 'WRS-1'
    } as any); // Type cast if CloseRepairDto doesn't have shop_id or asset_id

    assetState = await prisma.asset.findUnique({ where: { id: assetId } });
    expect(assetState!.current_status).toBe('PENDING_QA');
  });
});
