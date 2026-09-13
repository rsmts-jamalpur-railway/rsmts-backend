import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { argon2id } from 'hash-wasm';
import * as crypto from 'crypto';

const uuidv4 = () => crypto.randomUUID();

async function hashPassword(password: string) {
  const salt = new Uint8Array(16);
  crypto.webcrypto.getRandomValues(salt);

  return await argon2id({
    password,
    salt,
    parallelism: 1,
    iterations: 256,
    memorySize: 512,
    hashLength: 32,
    outputType: 'encoded'
  });
}

describe('Authentication & RBAC (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let adminToken: string;
  let supervisorToken: string;
  
  const testAdminEmployeeId = 'AUTH-ADM-001';
  const testSupervisorEmployeeId = 'AUTH-SUP-001';

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe());
    await app.init();

    prisma = app.get<PrismaService>(PrismaService);

    // Ensure roles exist
    const sysAdminRole = await prisma.role.upsert({
      where: { name: 'SYSTEM_ADMIN' },
      update: {},
      create: { name: 'SYSTEM_ADMIN', description: 'System administration', is_system_role: true }
    });
    
    const shopSupRole = await prisma.role.upsert({
      where: { name: 'SHOP_SUPERVISOR' },
      update: {},
      create: { name: 'SHOP_SUPERVISOR', description: 'Shop Supervisor', is_system_role: false }
    });

    // Seed test users
    const passwordHash = await hashPassword('Test@123!');

    // 1. System Admin
    const adminEmpId = uuidv4();
    const adminEmp = await prisma.employee.upsert({
      where: { employee_number: testAdminEmployeeId },
      update: { id: adminEmpId },
      create: { id: adminEmpId, employee_number: testAdminEmployeeId, first_name: 'Auth', last_name: 'Admin' }
    });
    
    const adminUser = await prisma.user.upsert({
      where: { employee_id: adminEmpId },
      update: { password_hash: passwordHash },
      create: { 
        id: uuidv4(), 
        employee_id: adminEmpId, 
        password_hash: passwordHash,
        status: 'ACTIVE'
      }
    });
    
    await prisma.userIdentifier.upsert({
      where: { type_normalized_value: { type: 'EMPLOYEE_ID', normalized_value: testAdminEmployeeId.toLowerCase() } },
      update: {},
      create: {
        user_id: adminUser.id,
        type: 'EMPLOYEE_ID',
        value: testAdminEmployeeId,
        normalized_value: testAdminEmployeeId.toLowerCase(),
        is_primary: true,
        is_verified: true
      }
    });

    await prisma.userRole.upsert({
      where: { user_id_role_id: { user_id: adminUser.id, role_id: sysAdminRole.id } },
      update: {},
      create: { user_id: adminUser.id, role_id: sysAdminRole.id }
    });

    // 2. Shop Supervisor
    const supEmpId = uuidv4();
    const supEmp = await prisma.employee.upsert({
      where: { employee_number: testSupervisorEmployeeId },
      update: { id: supEmpId },
      create: { id: supEmpId, employee_number: testSupervisorEmployeeId, first_name: 'Auth', last_name: 'Sup' }
    });

    const supUser = await prisma.user.upsert({
      where: { employee_id: supEmpId },
      update: { password_hash: passwordHash },
      create: { 
        id: uuidv4(), 
        employee_id: supEmpId, 
        password_hash: passwordHash,
        status: 'ACTIVE'
      }
    });

    await prisma.userIdentifier.upsert({
      where: { type_normalized_value: { type: 'EMPLOYEE_ID', normalized_value: testSupervisorEmployeeId.toLowerCase() } },
      update: {},
      create: {
        user_id: supUser.id,
        type: 'EMPLOYEE_ID',
        value: testSupervisorEmployeeId,
        normalized_value: testSupervisorEmployeeId.toLowerCase(),
        is_primary: true,
        is_verified: true
      }
    });

    await prisma.userRole.upsert({
      where: { user_id_role_id: { user_id: supUser.id, role_id: shopSupRole.id } },
      update: {},
      create: { user_id: supUser.id, role_id: shopSupRole.id }
    });
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Authentication', () => {
    it('should reject invalid credentials with 401', async () => {
      await request(app.getHttpServer())
        .post('/auth/login')
        .send({ identifier: testAdminEmployeeId, password: 'WrongPassword1!' })
        .expect(401);
    });

    it('should login successfully and return JWT', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ identifier: testAdminEmployeeId, password: 'Test@123!' })
        .expect(200);

      expect(res.body).toHaveProperty('tokens');
      expect(res.body.tokens).toHaveProperty('access_token');
      adminToken = res.body.tokens.access_token;
    });

    it('should login as supervisor', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ identifier: testSupervisorEmployeeId, password: 'Test@123!' })
        .expect(200);

      supervisorToken = res.body.tokens.access_token;
    });
  });

  describe('Role-Based Access Control (RBAC)', () => {
    it('should block unauthenticated access with 401', async () => {
      await request(app.getHttpServer())
        .get('/auth/me')
        .expect(401);
    });

    it('should allow access to /auth/me for SYSTEM_ADMIN', async () => {
      const res = await request(app.getHttpServer())
        .get('/auth/me')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.roles).toContain('SYSTEM_ADMIN');
    });

    it('should block access to /auth/me for SHOP_SUPERVISOR with 403', async () => {
      // /auth/me explicitly requires 'SYSTEM_ADMIN' or 'MANAGEMENT'
      await request(app.getHttpServer())
        .get('/auth/me')
        .set('Authorization', `Bearer ${supervisorToken}`)
        .expect(403);
    });
  });
});
