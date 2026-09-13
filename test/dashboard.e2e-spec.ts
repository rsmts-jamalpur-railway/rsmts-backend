import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';

describe('Dashboard API Verification (e2e)', () => {
  let app: INestApplication;
  let adminToken: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

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

  it('should return overall dashboard metrics with valid structure', async () => {
    const res = await request(app.getHttpServer())
      .get('/dashboard/overview')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(res.body.success).toBe(true);
    const data = res.body.data;
    
    // Check all required KPI fields are present
    expect(typeof data.total_active_assets).toBe('number');
    expect(typeof data.repair_active).toBe('number');
    expect(typeof data.manufacturing_active).toBe('number');
    expect(typeof data.on_hold_count).toBe('number');
    expect(typeof data.open_exceptions_count).toBe('number');
    expect(typeof data.dispatched_today).toBe('number');
    expect(typeof data.delayed_assets_count).toBe('number');
    expect(typeof data.total_locations_count).toBe('number');
    expect(data.occupancy_by_location).toBeInstanceOf(Object);
  });

  it('should return pipeline metrics (assets grouped by status/location)', async () => {
    const res = await request(app.getHttpServer())
      .get('/dashboard/pipeline')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
  });
});
