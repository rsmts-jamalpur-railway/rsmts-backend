import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import 'dotenv/config';

async function verify() {
  const connectionString = process.env.DATABASE_URL;
  const pool = new Pool({ connectionString });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });

  console.log('\n--- Verifying Database Seed ---');
  
  const rolesCount = await prisma.role.count();
  console.log(`Roles created: ${rolesCount}`);

  const adminUser = await prisma.user.findUnique({ where: { email: 'mdfarhan6873@gmail.com' }, include: { role: true } });
  console.log(`Admin User created: ${adminUser?.full_name} (${adminUser?.role?.role_name})`);

  const locationsCount = await prisma.location.count();
  console.log(`Locations created: ${locationsCount}`);

  const settingsCount = await prisma.setting.count();
  console.log(`Settings created: ${settingsCount}`);

  console.log('--- Verification Complete ---\n');

  await prisma.$disconnect();
}
verify().catch(console.error);
