import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('Asset & Wagon Validation (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let adminToken: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe());
    await app.init();

    prisma = app.get<PrismaService>(PrismaService);

    // Get admin token
    const res = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ identifier: 'admin@rsmts.gov.in', password: 'Admin@123!' })
      .expect(200);

    adminToken = res.body.tokens.access_token;
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Wagon Check Digit Validation', () => {
    it('should allow valid 11-digit wagon number', async () => {
      // 21021845137 -> Even: 1+2+8+5+3=19, Odd: 2+0+1+4+1=8 -> 8*3=24 -> 19+24=43 -> Next multiple is 50 -> 50-43=7 (Valid)
      await request(app.getHttpServer())
        .post('/assets')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          asset_number: '21021845137',
          category_id: 'BOXNHL',
          current_location: 'NSY',
          current_status: 'Received NSY',
          origin: 'REPAIR'
        })
        .expect((res) => {
          if (res.status !== 201 && res.status !== 409) { // 409 if already seeded
            throw new Error(`Expected 201 or 409, got ${res.status}`);
          }
        });
    });

    it('should reject invalid 11-digit wagon number', async () => {
      // 21021845138 -> Invalid check digit
      await request(app.getHttpServer())
        .post('/assets')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          asset_number: '21021845138',
          category_id: 'BOXNHL',
          current_location: 'NSY',
          current_status: 'Received NSY',
          origin: 'REPAIR'
        })
        .expect(400); // Bad Request
    });

    it('should allow 5-digit locomotive (no check digit required)', async () => {
      await request(app.getHttpServer())
        .post('/assets')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          asset_number: '30220',
          category_id: 'WAP7',
          current_location: 'DPS',
          current_status: 'IN_REPAIR',
          origin: 'REPAIR'
        })
        .expect((res) => {
          if (res.status !== 201 && res.status !== 409) {
            throw new Error(`Expected 201 or 409, got ${res.status}`);
          }
        });
    });
  });
});
