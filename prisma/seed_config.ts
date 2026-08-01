import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import * as dotenv from 'dotenv';

dotenv.config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  const config = {
    origins: {
      REPAIR: { label: 'Repair (NSY)', assetTypes: ['BOXNHL', 'BCNA'] },
      GIF: { label: 'New Manufacturing (GIF)', assetTypes: ['BTPN', 'FMP', 'BLC'] },
      CRANE: { label: 'New Manufacturing (Crane Shop)', assetTypes: ['140T Crane', 'DETC'] }
    },
    actions: [
      { value: 'POH', label: 'POH (Periodic Overhaul)' },
      { value: 'ROH', label: 'ROH (Routine Overhaul)' },
      { value: 'NPOH', label: 'NPOH (Non-Periodic Overhaul)' },
      { value: 'NEW', label: 'New Build' }
    ],
    customFields: [
      { key: 'contractor_name', label: 'Contractor Name', type: 'text' }
    ]
  };

  await prisma.setting.upsert({
    where: { key: 'ASSET_FORM_CONFIG' },
    update: { value: JSON.stringify(config) },
    create: {
      key: 'ASSET_FORM_CONFIG',
      value: JSON.stringify(config),
      description: 'Dynamic configuration for the Assets forms and table'
    }
  });

  console.log('Successfully inserted ASSET_FORM_CONFIG');
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
