import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import * as bcrypt from 'bcrypt';
import 'dotenv/config';

const connectionString = process.env.DATABASE_URL;
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

function randomInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomDate(start: Date, end: Date) {
  return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
}

async function main() {
  console.log('Starting realistic production-like seeding...');

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
  let adminUserId = '';
  if (adminRole) {
    const adminPassword = await bcrypt.hash('admin123', 10);
    const admin = await prisma.user.upsert({
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
    adminUserId = admin.id;
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
    { location_id: 'OUT', max_capacity: 9999, standard_tat_hours: 0 },
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

  // 5. Generate Realistic Assets & Movement Logs
  const assetTypes = ['BOXN', 'BCN', 'BTPN', 'WAG-9', 'WAP-7'];
  const shops = ['WRS-1', 'WRS-2', 'WRS-3', 'WRS-4', 'WRS-5', 'GIF', 'CRANE'];
  const now = new Date();
  
  // Clean up any existing data for a clean slate
  await prisma.movementLog.deleteMany();
  await prisma.asset.deleteMany();

  console.log('Generating 60 realistic assets with lifecycle histories...');

  for (let i = 1; i <= 60; i++) {
    const isDispatched = i <= 20; // First 20 are completed (dispatched)
    const isWaitingRepair = i > 20 && i <= 35; // Next 15 just arrived
    const isUnderRepair = i > 35 && i <= 55; // Next 20 in repair
    const isReadyOutturn = i > 55; // Last 5 ready

    const assetNumber = `RW-${assetTypes[i % assetTypes.length]}-${7000 + i}`;
    
    let currentStatus = '';
    let currentLocation = '';
    let isActive = true;

    if (isDispatched) {
      currentStatus = 'Workshop Out';
      currentLocation = 'OUT';
      isActive = false;
    } else if (isWaitingRepair) {
      currentStatus = 'Workshop In';
      currentLocation = 'NSY';
    } else if (isUnderRepair) {
      currentStatus = 'Shop In';
      currentLocation = shops[randomInt(0, shops.length - 1)];
    } else if (isReadyOutturn) {
      currentStatus = 'Fit';
      currentLocation = 'GIF';
    }

    // Determine the timeline based on state
    // Dispatched: Started 5-30 days ago, ended 0-5 days ago.
    // In progress: Started 1-15 days ago.
    let startDate: Date;
    let endDate: Date;

    if (isDispatched) {
      const daysAgoStart = randomInt(5, 30);
      const daysAgoEnd = randomInt(0, 5);
      startDate = new Date(now.getTime() - (daysAgoStart * 24 * 60 * 60 * 1000));
      endDate = new Date(now.getTime() - (daysAgoEnd * 24 * 60 * 60 * 1000));
    } else {
      const daysAgoStart = randomInt(1, 15);
      startDate = new Date(now.getTime() - (daysAgoStart * 24 * 60 * 60 * 1000));
      endDate = randomDate(startDate, now); // Most recent action
    }

    // Create Asset
    const asset = await prisma.asset.create({
      data: {
        asset_number: assetNumber,
        asset_type: assetTypes[i % assetTypes.length],
        origin: i % 3 === 0 ? 'NEW_MFG' : 'REPAIR',
        current_status: currentStatus,
        current_location: currentLocation,
        is_active: isActive,
        createdAt: startDate,
        updatedAt: endDate,
      }
    });

    // Create Movement logs to simulate timeline
    const logs: any[] = [];
    
    // Step 1: Always arrives at NSY
    logs.push({
      asset_number: assetNumber,
      to_location: 'NSY',
      new_status: 'Workshop In',
      handled_by: adminUserId,
      timestamp: startDate,
      remarks: 'Arrived at sick yard.',
    });

    if (!isWaitingRepair) {
      // Step 2: Moved to a repair shop
      const moveDate = randomDate(startDate, endDate);
      const repairShop = isUnderRepair ? currentLocation : shops[randomInt(0, shops.length - 1)];
      logs.push({
        asset_number: assetNumber,
        from_location: 'NSY',
        to_location: repairShop,
        previous_status: 'Workshop In',
        new_status: 'Shop In',
        handled_by: adminUserId,
        timestamp: moveDate,
        remarks: 'Transferred for repair.',
      });

      if (!isUnderRepair) {
        // Step 3: Fit or Not Fit
        // 20% chance of failing initially to simulate 'Not Fit'
        const isFailure = Math.random() < 0.2;
        let readyDate = randomDate(moveDate, endDate);
        
        if (isFailure) {
          logs.push({
            asset_number: assetNumber,
            from_location: repairShop,
            to_location: repairShop,
            previous_status: 'Shop In',
            new_status: 'Not Fit',
            handled_by: adminUserId,
            timestamp: readyDate,
            remarks: 'Failed WRS-5 brake test. Needs rework.',
          });
          // After rework, it becomes Fit
          readyDate = randomDate(readyDate, endDate);
          logs.push({
            asset_number: assetNumber,
            from_location: repairShop,
            to_location: 'GIF',
            previous_status: 'Not Fit',
            new_status: 'Fit',
            handled_by: adminUserId,
            timestamp: readyDate,
            remarks: 'Repairs completed, passed final inspection.',
          });
        } else {
          logs.push({
            asset_number: assetNumber,
            from_location: repairShop,
            to_location: 'GIF',
            previous_status: 'Shop In',
            new_status: 'Fit',
            handled_by: adminUserId,
            timestamp: readyDate,
            remarks: 'Repairs completed, passed final inspection.',
          });
        }

        if (isDispatched) {
          // Step 4: Workshop Out
          logs.push({
            asset_number: assetNumber,
            from_location: 'GIF',
            to_location: 'OUT',
            previous_status: 'Fit',
            new_status: 'Workshop Out',
            handled_by: adminUserId,
            timestamp: endDate,
            remarks: 'Dispatched to main line.',
          });
        }
      }
    }

    // Insert all logs sequentially
    for (const log of logs) {
      await prisma.movementLog.create({
        data: log
      });
    }
  }

  console.log('Successfully seeded 60 assets with realistic lifecycle timelines.');
  console.log('Seeding completed successfully.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
