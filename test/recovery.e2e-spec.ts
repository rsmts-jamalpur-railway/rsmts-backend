import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('Failure & Recovery (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    await app.close();
  });

  it('should gracefully handle database errors and reject invalid foreign keys', async () => {
    // Attempting to create an asset with an invalid category ID should throw a Prisma error which is caught by global filter
    try {
      await prisma.asset.create({
        data: {
          asset_number: 'INVALID_WAGON_NUMBER',
          category_id: 'NON_EXISTENT_CATEGORY',
          current_status: 'RECEIVED_IN_YARD',
        },
      });
      // Should not reach here
      expect(true).toBe(false);
    } catch (e: any) {
      expect(e.code).toBeDefined();
    }
  });

  it('should gracefully handle transaction rollbacks on constraint failures', async () => {
    const fakeId = '00000000-0000-0000-0000-000000000001';
    try {
      await prisma.$transaction(async (tx) => {
        await tx.user.create({
          data: {
            id: fakeId,
            employee_id: '00000000-0000-0000-0000-000000000002', // Invalid employee ID
            password_hash: 'hash',
          }
        });
      });
      expect(true).toBe(false);
    } catch (e: any) {
      expect(e.code).toBeDefined(); // Prisma error
    }
    
    // Ensure the insert was rolled back
    const user = await prisma.user.findUnique({ where: { id: fakeId }});
    expect(user).toBeNull();
  });
});
