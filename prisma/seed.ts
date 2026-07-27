import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import * as bcrypt from 'bcrypt';
import 'dotenv/config';

const connectionString = process.env.DATABASE_URL;
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('Starting seeding...');

  // 1. Roles
  const roles = [
    'Administrator',
    'Management',
    'SSE_TPT_Rail',
    'Shop_Incharge',
    'WRS_5_Staff',
    'GIF_Shop',
    'Crane_Shop',
  ];

  for (const roleName of roles) {
    await prisma.role.upsert({
      where: { role_name: roleName },
      update: {},
      create: { role_name: roleName },
    });
  }
  console.log('Roles seeded.');

  const adminRole = await prisma.role.findUnique({ where: { role_name: 'Administrator' } });

  // 2. Admin User
  if (adminRole) {
    const adminPassword = await bcrypt.hash('admin123', 10);
    await prisma.user.upsert({
      where: { employee_id: 'ADMIN001' },
      update: {},
      create: {
        employee_id: 'ADMIN001',
        password_hash: adminPassword,
        full_name: 'System Administrator',
        department: 'IT',
        designation: 'Admin',
        role_id: adminRole.id,
      },
    });
    console.log('Admin user seeded.');
  }

  // 3. Workshop Locations
  const locations = [
    { location_id: 'NSY', max_capacity: 50, standard_tat_hours: 24 },
    { location_id: 'WRS-1', max_capacity: 10, standard_tat_hours: 48 },
    { location_id: 'WRS-2', max_capacity: 15, standard_tat_hours: 48 },
    { location_id: 'WRS-3', max_capacity: 12, standard_tat_hours: 48 },
    { location_id: 'WRS-4', max_capacity: 10, standard_tat_hours: 48 },
    { location_id: 'WRS-5', max_capacity: 5, standard_tat_hours: 12 },
    { location_id: 'GIF', max_capacity: 20, standard_tat_hours: 72 },
    { location_id: 'CRANE', max_capacity: 5, standard_tat_hours: 96 },
  ];

  for (const loc of locations) {
    await prisma.location.upsert({
      where: { location_id: loc.location_id },
      update: {
        max_capacity: loc.max_capacity,
        standard_tat_hours: loc.standard_tat_hours,
      },
      create: loc,
    });
  }
  console.log('Workshop locations seeded.');

  // 4. Default Settings
  const defaultSettings = [
    { key: 'ALLOW_OFFLINE_SYNC', value: 'true', description: 'Enable WatermelonDB sync' },
    { key: 'MAX_SYNC_BATCH_SIZE', value: '100', description: 'Max records per sync batch' },
    { key: 'REQUIRE_GPS_LOCATION', value: 'true', description: 'Require GPS coordinates for movement logs' },
  ];

  for (const setting of defaultSettings) {
    await prisma.setting.upsert({
      where: { key: setting.key },
      update: {},
      create: setting,
    });
  }
  console.log('Default settings seeded.');

  console.log('Seeding completed.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
