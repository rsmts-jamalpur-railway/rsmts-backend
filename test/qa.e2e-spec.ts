import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { QaService } from '../src/qa/qa.service';
import { RepairService } from '../src/repair/repair.service';
import { YardService } from '../src/yard/yard.service';
import { randomUUID } from 'crypto';

describe('QA Workflow (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let qaService: QaService;
  let repairService: RepairService;
  let yardService: YardService;
  let userId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
    prisma = app.get(PrismaService);
    qaService = app.get(QaService);
    repairService = app.get(RepairService);
    yardService = app.get(YardService);

    const user = await prisma.user.findFirst();
    if (!user) throw new Error('No user found in DB');
    userId = user.id;
  });

  afterAll(async () => {
    await app.close();
  });

  it('should send asset back to repair on MINOR_FIX', async () => {
    const assetNumber = `QA-WAG-${Date.now()}`;
    
    // Intake
    await yardService.intakeAsset(userId, 'YARD', {
      client_operation_id: randomUUID(),
      asset_number: assetNumber,
      category_id: 'BOXN',
      from_railway: 'NR'
    });
    
    const asset = await prisma.asset.findUnique({ where: { asset_number: assetNumber } });
    const assetId = asset!.id;

    // Allocate & Start Repair
    await yardService.allocateAsset(userId, {
      client_operation_id: randomUUID(),
      asset_id: assetId,
      shop_id: 'WRS-1'
    });

    const startRes = await repairService.startRepair(userId, 'WRS-1', {
      client_operation_id: randomUUID(),
      asset_id: assetId,
      repair_category_id: 'POH',
      shop_id: 'WRS-1'
    });
    
    const cycleId = startRes.cycle_id;

    // Close Repair
    await repairService.closeRepair(userId, 'WRS-1', {
      client_operation_id: randomUUID(),
      cycle_id: cycleId,
      asset_id: assetId,
      shop_id: 'WRS-1'
    } as any);

    // QA Inspection - MINOR_FIX
    await qaService.submitInspection(userId, {
      client_operation_id: randomUUID(),
      asset_id: assetId,
      repair_cycle_id: cycleId,
      result: 'MINOR_FIX'
    });

    const updatedAsset = await prisma.asset.findUnique({ where: { id: assetId } });
    expect(updatedAsset!.current_status).toBe('IN_REPAIR');
    
    const repairCycle = await prisma.repairCycle.findUnique({ where: { cycle_id: cycleId } });
    expect(repairCycle!.status).toBe('IN_PROGRESS');
  });

  it('should mark asset FIT and issue certificate', async () => {
    const assetNumber = `QA-FIT-${Date.now()}`;
    
    // Intake
    await yardService.intakeAsset(userId, 'YARD', {
      client_operation_id: randomUUID(),
      asset_number: assetNumber,
      category_id: 'BOXN',
      from_railway: 'NR'
    });
    
    const asset = await prisma.asset.findUnique({ where: { asset_number: assetNumber } });
    const assetId = asset!.id;

    // Allocate & Start Repair
    await yardService.allocateAsset(userId, {
      client_operation_id: randomUUID(),
      asset_id: assetId,
      shop_id: 'WRS-1'
    });

    const startRes = await repairService.startRepair(userId, 'WRS-1', {
      client_operation_id: randomUUID(),
      asset_id: assetId,
      repair_category_id: 'POH',
      shop_id: 'WRS-1'
    });
    
    const cycleId = startRes.cycle_id;

    // Close Repair
    await repairService.closeRepair(userId, 'WRS-1', {
      client_operation_id: randomUUID(),
      cycle_id: cycleId,
      asset_id: assetId,
      shop_id: 'WRS-1'
    } as any);

    // QA Inspection - FIT
    const qaRes = await qaService.submitInspection(userId, {
      client_operation_id: randomUUID(),
      asset_id: assetId,
      repair_cycle_id: cycleId,
      result: 'FIT'
    });

    const updatedAsset = await prisma.asset.findUnique({ where: { id: assetId } });
    expect(updatedAsset!.current_status).toBe('FIT');
    expect(updatedAsset!.current_location).toBe('YARD');

    const fitCert = await prisma.fitCertificate.findFirst({ where: { inspection_id: qaRes.inspection_id } });
    expect(fitCert).toBeDefined();
    expect(fitCert!.issued_by).toBe(userId);
  });
});
