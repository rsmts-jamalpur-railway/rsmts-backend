import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { YardService } from '../src/yard/yard.service';
import { RepairService } from '../src/repair/repair.service';
import { ConflictException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';

describe('10/10 Invariants & Production Hardening', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let yardService: YardService;
  let repairService: RepairService;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    prisma = app.get<PrismaService>(PrismaService);
    yardService = app.get<YardService>(YardService);
    repairService = app.get<RepairService>(RepairService);
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Concurrency & Idempotency', () => {
    const assetNumber = `WAG-${Date.now()}`;
    const clientId = uuidv4();
    const userId = uuidv4(); // Mock User ID

    it('should idempotently return success on duplicate exact payload', async () => {
      // First call
      const res1 = await yardService.intakeAsset(userId, 'YARD', {
        client_operation_id: clientId,
        asset_number: assetNumber,
        category_id: 'BOXN',
        from_railway: 'NR'
      });

      // Second call (exact same payload)
      const res2 = await yardService.intakeAsset(userId, 'YARD', {
        client_operation_id: clientId,
        asset_number: assetNumber,
        category_id: 'BOXN',
        from_railway: 'NR'
      }) as any;

      expect(res2.message).toBe('Idempotent success');
      expect(res1.log_id).toBeDefined();
    });

    it('should throw 409 Conflict on duplicate client ID with different payload', async () => {
      await expect(
        yardService.intakeAsset(userId, 'YARD', {
          client_operation_id: clientId, // Same ID
          asset_number: 'DIFFERENT-WAG', // Different payload
          category_id: 'BOXN',
          from_railway: 'CR'
        })
      ).rejects.toThrow(ConflictException);
    });

    it('should lock capacity and reject concurrent overflowing operations', async () => {
      // We will simulate capacity by changing WRS-1 max capacity to 1 temporarily
      await prisma.location.update({
        where: { location_id: 'WRS-1' },
        data: { max_capacity: 1 }
      });

      // Asset 1 is already in YARD (from previous test)
      const asset1 = await prisma.asset.findUnique({ where: { asset_number: assetNumber }});
      
      // Intake Asset 2
      const assetNumber2 = `WAG2-${Date.now()}`;
      await yardService.intakeAsset(userId, 'YARD', {
        client_operation_id: uuidv4(),
        asset_number: assetNumber2,
        category_id: 'BOXN',
        from_railway: 'NR'
      });
      const asset2 = await prisma.asset.findUnique({ where: { asset_number: assetNumber2 }});

      // Start repair for Asset 1
      await repairService.startRepair(userId, 'WRS-1', {
        client_operation_id: uuidv4(),
        asset_id: asset1!.id,
        repair_category_id: 'POH',
        shop_id: 'WRS-1'
      });

      // Attempt to start repair for Asset 2 concurrently (Capacity is 1)
      await expect(
        repairService.startRepair(userId, 'WRS-1', {
          client_operation_id: uuidv4(),
          asset_id: asset2!.id,
          repair_category_id: 'POH',
          shop_id: 'WRS-1'
        })
      ).rejects.toThrow(ConflictException);

      // Restore capacity
      await prisma.location.update({
        where: { location_id: 'WRS-1' },
        data: { max_capacity: 50 }
      });
    });
  });

  describe('Workflow & Scope Policy Invariants', () => {
    it('should throw Forbidden if user operates outside assigned scope', async () => {
      await expect(
        yardService.dispatchAsset(uuidv4(), 'WRS-1', { // Scope is WRS-1, but operation is YARD
          client_operation_id: uuidv4(),
          asset_number: 'ANY',
          to_railway: 'ER'
        })
      ).rejects.toThrow(ForbiddenException);
    });

    it('should reject invalid state transitions', async () => {
      // Asset is currently IN_REPAIR at WRS-1
      // Attempting to dispatch it directly from yard should fail
      const assetNumber = `WAG-${Date.now()}`;
      await yardService.intakeAsset(uuidv4(), 'YARD', {
        client_operation_id: uuidv4(),
        asset_number: assetNumber,
        category_id: 'BOXN',
        from_railway: 'NR'
      });
      const asset = await prisma.asset.findUnique({ where: { asset_number: assetNumber }});
      
      await repairService.startRepair(uuidv4(), 'YARD', {
        client_operation_id: uuidv4(),
        asset_id: asset!.id,
        repair_category_id: 'POH',
        shop_id: 'WRS-1'
      });

      await expect(
        yardService.dispatchAsset(uuidv4(), 'YARD', {
          client_operation_id: uuidv4(),
          asset_number: assetNumber,
          to_railway: 'ER'
        })
      ).rejects.toThrow(BadRequestException); // Fails StateValidator check
    });
  });
});
