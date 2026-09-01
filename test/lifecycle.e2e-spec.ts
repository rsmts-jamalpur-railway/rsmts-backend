import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { YardService } from '../src/yard/yard.service';
import { RepairService } from '../src/repair/repair.service';
import { ManufacturingService } from '../src/manufacturing/manufacturing.service';
import { QaService } from '../src/qa/qa.service';
import * as crypto from 'crypto';

const uuidv4 = () => crypto.randomUUID();

describe('Cross-Domain Lifecycle Regression', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let yardService: YardService;
  let repairService: RepairService;
  let manufacturingService: ManufacturingService;
  let qaService: QaService;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    prisma = app.get<PrismaService>(PrismaService);
    yardService = app.get<YardService>(YardService);
    repairService = app.get<RepairService>(RepairService);
    manufacturingService = app.get<ManufacturingService>(ManufacturingService);
    qaService = app.get<QaService>(QaService);

    // Seed required category and locations if they don't exist
    const testEmployeeId = '11111111-1111-1111-1111-111111111111';
    const testUserId = '22222222-2222-2222-2222-222222222222';

    await prisma.employee.upsert({
      where: { employee_number: 'E999' },
      update: { id: testEmployeeId },
      create: { id: testEmployeeId, employee_number: 'E999', first_name: 'Test' }
    });

    await prisma.user.upsert({
      where: { employee_id: testEmployeeId },
      update: { id: testUserId },
      create: { id: testUserId, employee_id: testEmployeeId, password_hash: 'hash' }
    });

    await prisma.assetCategoryMaster.upsert({
      where: { id: 'BOXN' },
      update: {},
      create: { id: 'BOXN', category: 'WAGON', subtype: 'OPEN' }
    });

    await prisma.repairCategoryMaster.upsert({
      where: { id: 'POH' },
      update: {},
      create: { id: 'POH', standard_tat_hours: 48 }
    });

    await prisma.location.upsert({
      where: { location_id: 'YARD' },
      update: {},
      create: { location_id: 'YARD', location_type: 'YARD', max_capacity: 500 }
    });

    await prisma.location.upsert({
      where: { location_id: 'WRS-1' },
      update: {},
      create: { location_id: 'WRS-1', location_type: 'SHOP', max_capacity: 50 }
    });

    await prisma.location.upsert({
      where: { location_id: 'SR' },
      update: {},
      create: { location_id: 'SR', location_type: 'RAILWAY', max_capacity: 9999 }
    });

    await prisma.location.upsert({
      where: { location_id: 'EXTERNAL_RAILWAY' },
      update: {},
      create: { location_id: 'EXTERNAL_RAILWAY', location_type: 'RAILWAY', max_capacity: 9999 }
    });
  });

  afterAll(async () => {
    await app.close();
  });

  it('should successfully complete Yard -> Repair -> QA(FIT) -> Yard Dispatch lifecycle', async () => {
    const userId = '22222222-2222-2222-2222-222222222222';
    const assetNumber = `WAG-REP-${Date.now()}`;

    // 1. Yard Intake
    await yardService.intakeAsset(userId, 'YARD', {
      client_operation_id: uuidv4(),
      asset_number: assetNumber,
      category_id: 'BOXN',
      from_railway: 'NR'
    });
    const asset = await prisma.asset.findUnique({ where: { asset_number: assetNumber } });
    expect(asset!.current_status).toBe('RECEIVED_IN_YARD');

    // 2. Repair Start
    const repairStartRes = await repairService.startRepair(userId, 'YARD', {
      client_operation_id: uuidv4(),
      asset_id: asset!.id,
      repair_category_id: 'POH',
      shop_id: 'WRS-1'
    });
    
    let updatedAsset = await prisma.asset.findUnique({ where: { asset_number: assetNumber } });
    expect(updatedAsset!.current_status).toBe('IN_REPAIR');

    // 3. Repair Close
    await repairService.closeRepair(userId, 'WRS-1', {
      client_operation_id: uuidv4(),
      cycle_id: repairStartRes.cycle_id,
      notes: 'Repaired'
    });

    updatedAsset = await prisma.asset.findUnique({ where: { asset_number: assetNumber } });
    expect(updatedAsset!.current_status).toBe('PENDING_QA');

    // 4. QA Inspect (FIT)
    const qaRes = await qaService.submitInspection(userId, {
      client_operation_id: uuidv4(),
      asset_id: updatedAsset!.id,
      repair_cycle_id: repairStartRes.cycle_id,
      result: 'FIT',
      remarks: 'Looks good'
    });
    
    expect(qaRes.result).toBe('FIT');
    expect(qaRes.inspection_id).toBeDefined();

    updatedAsset = await prisma.asset.findUnique({ where: { asset_number: assetNumber } });
    expect(updatedAsset!.current_status).toBe('FIT');
    expect(updatedAsset!.current_location).toBe('YARD');

    // 5. Yard Dispatch
    await yardService.dispatchAsset(userId, 'YARD', {
      client_operation_id: uuidv4(),
      asset_number: assetNumber,
      to_railway: 'SR'
    });

    updatedAsset = await prisma.asset.findUnique({ where: { asset_number: assetNumber } });
    expect(updatedAsset!.current_status).toBe('DISPATCHED');
  });

  it('should successfully complete Mfg -> QA(FIT) -> Yard Dispatch lifecycle', async () => {
    const userId = '22222222-2222-2222-2222-222222222222';
    const assetNumber = `WAG-MFG-${Date.now()}`;

    // 1. Manufacturing Start
    const mfgStartRes = await manufacturingService.startManufacturing(userId, 'WRS-1', {
      client_operation_id: uuidv4(),
      asset_number: assetNumber,
      category_id: 'BOXN',
      shop_id: 'WRS-1'
    });

    const asset = await prisma.asset.findUnique({ where: { asset_number: assetNumber } });
    expect(asset!.current_status).toBe('IN_MANUFACTURING');

    // 2. Manufacturing Close
    await manufacturingService.closeManufacturing(userId, 'WRS-1', {
      client_operation_id: uuidv4(),
      order_id: mfgStartRes.order_id,
      notes: 'Built'
    });

    let updatedAsset = await prisma.asset.findUnique({ where: { asset_number: assetNumber } });
    expect(updatedAsset!.current_status).toBe('PENDING_QA');

    // 3. QA Inspect (FIT)
    const qaRes = await qaService.submitInspection(userId, {
      client_operation_id: uuidv4(),
      asset_id: updatedAsset!.id,
      manufacturing_order_id: mfgStartRes.order_id,
      result: 'FIT',
      remarks: 'Perfectly built'
    });

    expect(qaRes.result).toBe('FIT');
    expect(qaRes.inspection_id).toBeDefined();

    updatedAsset = await prisma.asset.findUnique({ where: { asset_number: assetNumber } });
    expect(updatedAsset!.current_status).toBe('FIT');
    expect(updatedAsset!.current_location).toBe('YARD');

    // 4. Yard Dispatch
    await yardService.dispatchAsset(userId, 'YARD', {
      client_operation_id: uuidv4(),
      asset_number: assetNumber,
      to_railway: 'CR'
    });

    updatedAsset = await prisma.asset.findUnique({ where: { asset_number: assetNumber } });
    expect(updatedAsset!.current_status).toBe('DISPATCHED');
  });
});
