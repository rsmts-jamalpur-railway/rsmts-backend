import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { ExceptionsService } from '../src/exceptions/exceptions.service';
import { YardService } from '../src/yard/yard.service';
import { randomUUID } from 'crypto';

describe('Exceptions & Audit Workflow (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let exceptionsService: ExceptionsService;
  let yardService: YardService;
  let userId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
    prisma = app.get(PrismaService);
    exceptionsService = app.get(ExceptionsService);
    yardService = app.get(YardService);

    const user = await prisma.user.findFirst();
    if (!user) throw new Error('No user found in DB');
    userId = user.id;
  });

  afterAll(async () => {
    await app.close();
  });

  it('should report an exception and then resolve it, updating asset status', async () => {
    const assetNumber = `EXC-WAG-${Date.now()}`;
    
    // Intake
    await yardService.intakeAsset(userId, 'YARD', {
      client_operation_id: randomUUID(),
      asset_number: assetNumber,
      category_id: 'BOXN',
      from_railway: 'NR'
    });
    
    const asset = await prisma.asset.findUnique({ where: { asset_number: assetNumber } });
    const assetId = asset!.id;

    // Report Exception
    const res = await exceptionsService.reportException(userId, {
      client_operation_id: randomUUID(),
      asset_id: assetId,
      type: 'DAMAGE',
      severity: 'HIGH',
      reason: 'Broken side panel'
    });
    
    const exceptionId = res.exception_id;

    let updatedAsset = await prisma.asset.findUnique({ where: { id: assetId } });
    expect(updatedAsset!.current_status).toBe('EXCEPTION_LOGGED');

    // Resolve Exception
    await exceptionsService.resolveException(userId, exceptionId, {
      resolution: 'Panel replaced',
      new_asset_status: 'RECEIVED_IN_YARD'
    });

    updatedAsset = await prisma.asset.findUnique({ where: { id: assetId } });
    expect(updatedAsset!.current_status).toBe('RECEIVED_IN_YARD');

    const exception = await prisma.exception.findUnique({ where: { id: exceptionId } });
    expect(exception!.status).toBe('RESOLVED');
    expect(exception!.resolved_by).toBe(userId);
  });
});
