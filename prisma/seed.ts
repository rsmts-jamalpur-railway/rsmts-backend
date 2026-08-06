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
    'Viewer'
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
  const standardTypes = ['BOXNHL', 'BCNA', 'BOBRNHS'];
  const gifTypes = ['BTPN', 'FMP', 'BLC'];
  const craneTypes = ['140T Crane', 'DETC'];

  const allTypes = [...standardTypes, ...gifTypes, ...craneTypes];
  const rlys = ['CNCR', 'SCR', 'ER', 'SECR'];
  const actions = ['POH', 'ROH', 'NPOH'];
  const mods = ['M1', '25T', 'EL', ''];

  const repairShops = ['WRS-1', 'WRS-2', 'WRS-3', 'WRS-4'];
  const now = new Date();

  // Clean up any existing data for a clean slate
  await prisma.assetPhoto.deleteMany();
  await prisma.movementLog.deleteMany();
  await prisma.repairCycle.deleteMany();
  await prisma.asset.deleteMany();

  console.log('Generating 60 realistic assets with lifecycle histories...');

  for (let i = 1; i <= 60; i++) {
    const isDispatched = i <= 20;
    const isWaitingRepair = i > 20 && i <= 35;
    const isUnderRepair = i > 35 && i <= 55;
    const isReadyOutturn = i > 55;

    // Determine type and origin
    let assetType = standardTypes[randomInt(0, standardTypes.length - 1)];
    let origin = 'REPAIR';

    // Mix in some new manufacturing
    if (i % 5 === 0) {
      origin = 'GIF';
      assetType = gifTypes[randomInt(0, gifTypes.length - 1)];
    } else if (i % 12 === 0) {
      origin = 'CRANE';
      assetType = craneTypes[randomInt(0, craneTypes.length - 1)];
    }

    const assetNumber = `110${randomInt(10000000, 99999999)}`;
    const wagonSr = `SR-${randomInt(10000, 99999)}`;

    let currentStatus = '';
    let currentLocation = '';
    let isActive = true;

    if (isDispatched) {
      currentStatus = 'NSY OUT';
      currentLocation = 'OUT';
      isActive = false;
    } else if (isWaitingRepair) {
      currentStatus = origin === 'REPAIR' ? 'NSY IN' : (origin === 'GIF' ? 'GIF IN' : 'CRANE IN');
      currentLocation = origin === 'REPAIR' ? 'NSY' : (origin === 'GIF' ? 'GIF' : 'CRANE');
    } else if (isUnderRepair) {
      currentStatus = 'Shop In';
      currentLocation = repairShops[randomInt(0, repairShops.length - 1)];
    } else if (isReadyOutturn) {
      currentStatus = 'Fit';
      currentLocation = 'WRS-5';
    }

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
      endDate = randomDate(startDate, now);
    }

    // Determine Milestone dates based on state
    let nsy_in_date = startDate;
    let shop_in_date = (isUnderRepair || isReadyOutturn || isDispatched) ? randomDate(startDate, endDate) : null;
    let fit_date = (isReadyOutturn || isDispatched) ? randomDate(shop_in_date || startDate, endDate) : null;
    let nsy_out_date = isDispatched ? endDate : null;

    // Fast-track logic for new manufacturing going straight out
    if (origin !== 'REPAIR' && isDispatched) {
      shop_in_date = null;
      fit_date = null;
    }

    // Create Asset
    const asset = await prisma.asset.create({
      data: {
        asset_number: assetNumber,
        wagon_sr: wagonSr,
        rly: rlys[randomInt(0, rlys.length - 1)],
        asset_type: assetType,
        mod: mods[randomInt(0, mods.length - 1)],
        built_year: randomInt(2000, 2026),
        action: actions[randomInt(0, actions.length - 1)],
        origin: origin,
        current_status: currentStatus,
        current_location: currentLocation,
        nsy_in_date: nsy_in_date,
        shop_in_date: shop_in_date,
        fit_date: fit_date,
        nsy_out_date: nsy_out_date,
        is_active: isActive,
        createdAt: startDate,
        updatedAt: endDate,
      }
    });

    let tat_days: number | null = null;
    if (nsy_out_date && nsy_in_date) {
      const diffTime = Math.abs(nsy_out_date.getTime() - nsy_in_date.getTime());
      tat_days = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    }

    const currentCycleNumber = i <= 5 ? 2 : 1;

    // Simulate an old historical cycle from 1 year ago for the first 5 assets
    if (i <= 5) {
      const histStart = new Date(now.getTime() - (365 * 24 * 60 * 60 * 1000));
      const histEnd = new Date(histStart.getTime() + (randomInt(5, 15) * 24 * 60 * 60 * 1000));
      
      const histCycle = await prisma.repairCycle.create({
        data: {
          asset_number: assetNumber,
          cycle_number: 1,
          nsy_in_date: histStart,
          nsy_out_date: histEnd,
          tat_days: Math.ceil((histEnd.getTime() - histStart.getTime()) / (1000 * 60 * 60 * 24))
        }
      });

      await prisma.movementLog.create({
        data: {
          asset_number: assetNumber,
          to_location: 'NSY',
          new_status: 'NSY IN',
          handled_by: adminUserId,
          timestamp: histStart,
          remarks: 'Historical: Received last year for previous POH.',
          repair_cycle_id: histCycle.id
        }
      });

      await prisma.movementLog.create({
        data: {
          asset_number: assetNumber,
          from_location: 'NSY',
          to_location: 'OUT',
          previous_status: 'Fit',
          new_status: 'NSY OUT',
          handled_by: adminUserId,
          timestamp: histEnd,
          remarks: 'Historical: Dispatched after repairs.',
          repair_cycle_id: histCycle.id
        }
      });
    }

    const cycle = await prisma.repairCycle.create({
      data: {
        asset_number: assetNumber,
        cycle_number: currentCycleNumber,
        nsy_in_date: nsy_in_date,
        shop_in_date: shop_in_date,
        fit_date: fit_date,
        nsy_out_date: nsy_out_date,
        tat_days: tat_days
      }
    });

    // Create Movement logs to simulate timeline
    const logs: any[] = [];
    const firstStatus = origin === 'REPAIR' ? 'NSY IN' : (origin === 'GIF' ? 'GIF IN' : 'CRANE IN');
    const firstLoc = origin === 'REPAIR' ? 'NSY' : (origin === 'GIF' ? 'GIF' : 'CRANE');

    // Step 1: Arrives at NSY or Manufacturing Shop
    logs.push({
      asset_number: assetNumber,
      to_location: firstLoc,
      new_status: firstStatus,
      handled_by: adminUserId,
      timestamp: startDate,
      remarks: origin === 'REPAIR' ? 'Received at yard for repair inspection.' : `Registered new ${assetType} from assembly line.`,
    });

    if (origin === 'REPAIR') {
      if (!isWaitingRepair) {
        // Step 2: Moved to a repair shop
        const repairShop = isUnderRepair ? currentLocation : repairShops[randomInt(0, repairShops.length - 1)];
        logs.push({
          asset_number: assetNumber,
          from_location: 'NSY',
          to_location: repairShop,
          previous_status: 'NSY IN',
          new_status: 'Shop In',
          handled_by: adminUserId,
          timestamp: shop_in_date || randomDate(startDate, endDate),
          remarks: `Assigned to ${repairShop} for structural repairs and component replacements.`,
        });

        if (isReadyOutturn || isDispatched) {
          // Step 3: Moved to WRS-5 for testing
          const testDate = fit_date || randomDate(shop_in_date || startDate, endDate);
          logs.push({
            asset_number: assetNumber,
            from_location: repairShop,
            to_location: 'WRS-5',
            previous_status: 'Shop In',
            new_status: 'WRS-5 In',
            handled_by: adminUserId,
            timestamp: new Date(testDate.getTime() - 1000 * 60 * 60 * 5), // 5 hours before fit
            remarks: 'Moved to WRS-5 for air brake and quality testing.',
          });

          // Step 4: Marked Fit
          logs.push({
            asset_number: assetNumber,
            from_location: 'WRS-5',
            to_location: 'WRS-5',
            previous_status: 'WRS-5 In',
            new_status: 'Fit',
            handled_by: adminUserId,
            timestamp: testDate,
            remarks: 'Passed all final inspections. Certificate generated. Ready for dispatch.',
          });
        }
      }
    }

    if (isDispatched) {
      // Step 5: Dispatch
      logs.push({
        asset_number: assetNumber,
        from_location: origin === 'REPAIR' ? 'WRS-5' : firstLoc,
        to_location: 'OUT',
        previous_status: origin === 'REPAIR' ? 'Fit' : firstStatus,
        new_status: 'NSY OUT',
        handled_by: adminUserId,
        timestamp: endDate,
        remarks: 'Asset dispatched successfully from the facility.',
      });
    }

    // Sample photos for image proofs
    const samplePhotos = [
      'https://picsum.photos/seed/train1/600/400',
      'https://picsum.photos/seed/train2/600/400',
      'https://picsum.photos/seed/train3/600/400',
      'https://picsum.photos/seed/train4/600/400'
    ];

    // Insert logs and attach random photos
    for (const log of logs) {
      const createdLog = await prisma.movementLog.create({
        data: {
          ...log,
          repair_cycle_id: cycle.id
        }
      });

      // 40% chance to add a proof image to a log
      if (Math.random() < 0.4) {
         await prisma.assetPhoto.create({
           data: {
             movement_log_id: createdLog.log_id,
             asset_number: assetNumber,
             photo_url: samplePhotos[randomInt(0, samplePhotos.length - 1)]
           }
         });
      }
    }
  }

  console.log('Seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
