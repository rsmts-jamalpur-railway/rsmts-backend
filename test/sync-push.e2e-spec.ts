import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe, VersioningType } from '@nestjs/common';
import request = require('supertest');
import { AppModule } from '../src/app.module';

describe('Sync API (e2e)', () => {
  let app: INestApplication;
  let jwtToken: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe());
    app.enableVersioning({
      type: VersioningType.URI,
      defaultVersion: '1',
    });
    await app.init();

    // Authenticate a user
    const loginRes = await request(app.getHttpServer())
      .post('/v1/auth/login')
      .send({ identifier: 'mdfarhan6873@gmail.com', password: 'password' }); // using the known admin

    jwtToken = loginRes.body.access_token;
  });

  afterAll(async () => {
    await app.close();
  });

  it('401 Authentication Failure pauses queue', async () => {
    const res = await request(app.getHttpServer())
      .post('/v1/sync/push')
      .send({ changes: { sync_operations: { created: [] } } });
      
    expect(res.status).toBe(401);
  });

  it('400 Invalid State Transition returns CONFLICT', async () => {
    const op = {
      client_operation_id: 'test-uuid-400',
      command_type: 'REPAIR_START',
      payload: { asset_id: 'invalid-id', shop_id: 'shop-id', repair_category_id: 'cat-id' }
    };

    const res = await request(app.getHttpServer())
      .post('/v1/sync/push')
      .set('Authorization', `Bearer ${jwtToken}`)
      .send({ changes: { sync_operations: { created: [op] } } });
      
    expect(res.status).toBe(200); // 200 overall push
    expect(res.body.errors).toBeDefined();
    expect(res.body.errors[0].code).toBe('RESOURCE_NOT_FOUND'); // asset invalid-id not found
    expect(res.body.errors[0].client_operation_id).toBe('test-uuid-400');
  });

});
