import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { argon2id } from 'hash-wasm';
import * as crypto from 'crypto';
import 'dotenv/config';

const connectionString = process.env.DATABASE_URL;
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

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

async function main() {
  console.log('Seeding master data...');
  
  // 1. Roles
  const roles = [
    { name: 'SYSTEM_ADMIN', description: 'System administration', is_system_role: true },
    { name: 'YARD_CONTROLLER', description: 'NSY + allocation + dispatch', is_system_role: false },
    { name: 'REPAIR_SUPERVISOR', description: 'Repair operations', is_system_role: false },
    { name: 'MANUFACTURING_SUPERVISOR', description: 'Manufacturing operations', is_system_role: false },
    { name: 'QA_INSPECTOR', description: 'WRS-5 QA', is_system_role: false },
    { name: 'MANAGEMENT', description: 'Monitoring + analytics + approvals', is_system_role: false },
    { name: 'VIEWER', description: 'Read-only access', is_system_role: false },
  ];

  for (const r of roles) {
    await prisma.role.upsert({
      where: { name: r.name },
      update: {},
      create: r,
    });
  }

  // 2. Locations
  const locations = [
    { location_id: 'NSY', location_type: 'YARD', max_capacity: 500, zone: 'Central' },
    { location_id: 'WRS-1', location_type: 'REPAIR_SHOP', max_capacity: 50, zone: 'Repair' },
    { location_id: 'WRS-2', location_type: 'REPAIR_SHOP', max_capacity: 50, zone: 'Repair' },
    { location_id: 'WRS-3', location_type: 'REPAIR_SHOP', max_capacity: 50, zone: 'Repair' },
    { location_id: 'WRS-4', location_type: 'REPAIR_SHOP', max_capacity: 50, zone: 'Repair' },
    { location_id: 'WRS-5', location_type: 'QA_SHOP', max_capacity: 20, zone: 'Testing' },
    { location_id: 'GIF', location_type: 'MFG_SHOP', max_capacity: 100, zone: 'Manufacturing' },
    { location_id: 'CRANE', location_type: 'MFG_SHOP', max_capacity: 10, zone: 'Manufacturing' },
  ];

  for (const loc of locations) {
    await prisma.location.upsert({
      where: { location_id: loc.location_id },
      update: {},
      create: loc,
    });
  }

  // 3. Asset Categories
  const categories = [
    { id: 'BOXNHL', category: 'WAGON', subtype: 'BOXNHL', id_length: 11, requires_check_digit: true },
    { id: '140T_CRANE', category: 'CRANE', subtype: '140T', id_length: 6, requires_check_digit: false },
  ];

  for (const cat of categories) {
    await prisma.assetCategoryMaster.upsert({
      where: { id: cat.id },
      update: {},
      create: cat,
    });
  }

  // 4. Default Admin User
  const adminRole = await prisma.role.findUnique({ where: { name: 'SYSTEM_ADMIN' } });
  
  if (adminRole) {
    const pwdHash = await hashPassword('Admin@123!');
    
    const adminEmployee = await prisma.employee.upsert({
      where: { employee_number: 'ADM-001' },
      update: {},
      create: {
        employee_number: 'ADM-001',
        first_name: 'System',
        last_name: 'Administrator',
      }
    });

    const adminUser = await prisma.user.upsert({
      where: { employee_id: adminEmployee.id },
      update: {
        password_hash: pwdHash // Ensure password gets updated if script re-runs
      },
      create: {
        employee_id: adminEmployee.id,
        password_hash: pwdHash,
        status: 'ACTIVE'
      }
    });

    await prisma.userIdentifier.upsert({
      where: { type_normalized_value: { type: 'EMAIL', normalized_value: 'admin@rsmts.gov.in' } },
      update: {},
      create: {
        user_id: adminUser.id,
        type: 'EMAIL',
        value: 'admin@rsmts.gov.in',
        normalized_value: 'admin@rsmts.gov.in',
        is_primary: true,
        is_verified: true
      }
    });

    // Assign Admin Role
    const userRoleExists = await prisma.userRole.findUnique({
      where: { user_id_role_id: { user_id: adminUser.id, role_id: adminRole.id } }
    });

    if (!userRoleExists) {
      await prisma.userRole.create({
        data: {
          user_id: adminUser.id,
          role_id: adminRole.id,
        }
      });
    }
  }

  console.log('Master data seeded successfully.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
