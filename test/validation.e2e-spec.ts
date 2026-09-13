import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';

describe('API Security & Validation (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('should reject unauthenticated request to protected endpoint (401)', () => {
    return request(app.getHttpServer())
      .get('/assets')
      .expect(401);
  });

  it('should reject malformed asset creation payload (400)', async () => {
    // Generate valid token for the test
    const loginRes = await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        identifier: 'admin@rsmts.gov.in',
        password: 'Admin@123!'
      });
      
    const token = loginRes.body.tokens.access_token;

    // Missing 'asset_number' and 'category_id'
    return request(app.getHttpServer())
      .post('/assets')
      .set('Authorization', `Bearer ${token}`)
      .send({})
      .expect(400)
      .expect(res => {
        expect(res.body.message).toEqual(expect.arrayContaining([
          'asset_number must be a string'
        ]));
      });
  });

  it('should reject unknown extra fields in payload (400) due to forbidNonWhitelisted', async () => {
    const loginRes = await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        identifier: 'admin@rsmts.gov.in',
        password: 'Admin@123!'
      });
      
    const token = loginRes.body.tokens.access_token;

    return request(app.getHttpServer())
      .post('/assets')
      .set('Authorization', `Bearer ${token}`)
      .send({
        asset_number: '11111111112', // Note: Modulo 10 validates 11111111112
        category_id: 'BOXN',
        status: 'RECEIVED_IN_YARD',
        some_extra_hacker_field: 'drop tables'
      })
      .expect(400)
      .expect(res => {
        expect(res.body.message).toEqual(expect.arrayContaining([
          'property some_extra_hacker_field should not exist'
        ]));
      });
  });
});
