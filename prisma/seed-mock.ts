import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import 'dotenv/config';

const connectionString = process.env.DATABASE_URL;
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('Starting complex mock data seeding...');

  const admin = await prisma.user.findUnique({ where: { email: 'mdfarhan6873@gmail.com' } });
  if (!admin) {
    console.error('Admin user not found.');
    return;
  }

  const assetTypes = ['BOXN', 'BCNA', 'BTPN', 'BOBRN'];
  
  // We will generate 3 specific assets with deep lifecycles for timeline testing.
  const complexAssets = ['99999999901', '99999999902', '99999999903'];

  // Delete them if they exist to start fresh
  await prisma.movementLog.deleteMany({
    where: { asset_number: { in: complexAssets } }
  });
  await prisma.asset.deleteMany({
    where: { asset_number: { in: complexAssets } }
  });

  const now = new Date();
  
  for (let i = 0; i < complexAssets.length; i++) {
    const assetNumber = complexAssets[i];
    const type = assetTypes[i];
    
    // Day 0
    const d0 = new Date(now.getTime() - (5 * 24 * 60 * 60 * 1000));
    // Day 1
    const d1 = new Date(now.getTime() - (4 * 24 * 60 * 60 * 1000));
    // Day 2
    const d2 = new Date(now.getTime() - (3 * 24 * 60 * 60 * 1000));
    // Day 3
    const d3 = new Date(now.getTime() - (2 * 24 * 60 * 60 * 1000));
    // Day 4
    const d4 = new Date(now.getTime() - (24 * 60 * 60 * 1000));
    // Day 5 (Today, right now)
    const d5 = now;

    // Create Asset
    await prisma.asset.create({
      data: {
        asset_number: assetNumber,
        asset_type: type,
        origin: 'REPAIR',
        current_location: 'NSY',
        current_status: 'Dispatched', // Final state
        createdAt: d0,
        updatedAt: d5,
      }
    });

    // Log 1: Arrive at Yard
    await prisma.movementLog.create({
      data: {
        asset_number: assetNumber,
        to_location: 'NSY',
        new_status: 'Waiting_Repair',
        handled_by: admin.id,
        timestamp: d0,
        remarks: 'Received at Yard for initial inspection. Damaged side panels.',
      }
    });

    // Log 2: Moved to WRS-1 for Repair
    await prisma.movementLog.create({
      data: {
        asset_number: assetNumber,
        from_location: 'NSY',
        to_location: 'WRS-1',
        previous_status: 'Waiting_Repair',
        new_status: 'Under_Repair',
        handled_by: admin.id,
        timestamp: d1,
        remarks: 'Started welding and panel replacement.',
      }
    });

    // Log 3: Sent for Inspection
    await prisma.movementLog.create({
      data: {
        asset_number: assetNumber,
        from_location: 'WRS-1',
        to_location: 'WRS-5',
        previous_status: 'Under_Repair',
        new_status: 'Waiting_Inspection',
        handled_by: admin.id,
        timestamp: d2,
        remarks: 'Repairs completed, moved to WRS-5 for NTXR inspection.',
      }
    });

    // Log 4: Inspection Failed (Sent back)
    await prisma.movementLog.create({
      data: {
        asset_number: assetNumber,
        from_location: 'WRS-5',
        to_location: 'WRS-1',
        previous_status: 'Waiting_Inspection',
        new_status: 'Under_Repair',
        handled_by: admin.id,
        timestamp: d3,
        remarks: 'Not Fit. Brake cylinders leaking. Sent back to WRS-1.',
      }
    });

    // Log 5: Ready for Outturn
    await prisma.movementLog.create({
      data: {
        asset_number: assetNumber,
        from_location: 'WRS-1',
        to_location: 'NSY', // Yard for dispatch
        previous_status: 'Under_Repair',
        new_status: 'Ready_For_Outturn',
        handled_by: admin.id,
        timestamp: d4,
        remarks: 'Brakes fixed. FIT for service.',
      }
    });

    // Log 6: Dispatched
    await prisma.movementLog.create({
      data: {
        asset_number: assetNumber,
        from_location: 'NSY',
        to_location: 'NSY', // Dispatched from Yard
        previous_status: 'Ready_For_Outturn',
        new_status: 'Dispatched',
        handled_by: admin.id,
        timestamp: d5,
        remarks: 'Asset dispatched successfully.',
      }
    });
  }

  console.log('Complex Asset Lifecycles seeded successfully!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
