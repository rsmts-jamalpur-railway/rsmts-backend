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

  // 2. Locations (All 68 Jamalpur Workshop Nodes)
  const locations: Array<{ location_id: string; location_type: string; max_capacity: number; zone: string }> = [
    // Primary Operational Shops & QA (7)
    { location_id: 'WRS-1', location_type: 'REPAIR_SHOP', max_capacity: 50, zone: 'Repair Shops' },
    { location_id: 'WRS-2', location_type: 'REPAIR_SHOP', max_capacity: 50, zone: 'Repair Shops' },
    { location_id: 'WRS-3', location_type: 'REPAIR_SHOP', max_capacity: 50, zone: 'Repair Shops' },
    { location_id: 'WRS-4', location_type: 'REPAIR_SHOP', max_capacity: 50, zone: 'Repair Shops' },
    { location_id: 'DPS', location_type: 'LOCO_SHED', max_capacity: 25, zone: 'Locomotive Shed' },
    { location_id: 'GIF', location_type: 'MFG_SHOP', max_capacity: 100, zone: 'Manufacturing Shops' },
    { location_id: 'CRANE', location_type: 'CRANE_SHOP', max_capacity: 15, zone: 'Manufacturing Shops' },
    { location_id: 'WRS-5', location_type: 'QA_SHOP', max_capacity: 20, zone: 'Quality Assurance' },

    // Primary Yards & Test Tracks (3)
    { location_id: 'NSY', location_type: 'YARD', max_capacity: 500, zone: 'Primary Yards' },
    { location_id: 'Exit Yard', location_type: 'YARD', max_capacity: 100, zone: 'Primary Yards' },
    { location_id: 'Trial Yard', location_type: 'YARD', max_capacity: 30, zone: 'Primary Yards' },

    // Specialty Lines (2)
    { location_id: 'Tower Car Line', location_type: 'YARD_LINE', max_capacity: 15, zone: 'Specialty Lines' },
    { location_id: 'Wheel Park Line', location_type: 'YARD_LINE', max_capacity: 40, zone: 'Specialty Lines' },
  ];

  // Workshop Track & Parking Lines (Line-01 to Line-56 to reach 68 total nodes)
  for (let i = 1; i <= 56; i++) {
    const numStr = i < 10 ? `0${i}` : `${i}`;
    locations.push({
      location_id: `Line-${numStr}`,
      location_type: 'YARD_LINE',
      max_capacity: 15,
      zone: i <= 28 ? 'Yard North Lines' : 'Yard South Lines',
    });
  }

  for (const loc of locations) {
    await prisma.location.upsert({
      where: { location_id: loc.location_id },
      update: {
        location_type: loc.location_type,
        max_capacity: loc.max_capacity,
        zone: loc.zone,
      },
      create: loc,
    });
  }

  // 3. Asset Categories (Jamalpur Workshop Rolling Stock)
  const categories = [
    // Freight Wagons (11-Digit Indian Railways Scheme with Modulo-10 Check Digit)
    { id: 'BOXNHL', category: 'WAGON', subtype: 'BOXNHL', id_length: 11, requires_check_digit: true },
    { id: 'BCNHL', category: 'WAGON', subtype: 'BCNHL', id_length: 11, requires_check_digit: true },
    { id: 'BVZI', category: 'WAGON', subtype: 'BVZI', id_length: 11, requires_check_digit: true },
    { id: 'BTPN', category: 'WAGON', subtype: 'BTPN', id_length: 11, requires_check_digit: true },
    { id: 'BOBRN', category: 'WAGON', subtype: 'BOBRN', id_length: 11, requires_check_digit: true },
    // Locomotives (5-Digit Indian Railways Road Number)
    { id: 'WAP7', category: 'LOCO', subtype: 'WAP7', id_length: 5, requires_check_digit: false },
    { id: 'WAG9', category: 'LOCO', subtype: 'WAG9', id_length: 5, requires_check_digit: false },
    { id: 'WDG4', category: 'LOCO', subtype: 'WDG4', id_length: 5, requires_check_digit: false },
    // Heavy Breakdown Cranes (6-Digit Jamalpur Built Cranes)
    { id: '140T_CRANE', category: 'CRANE', subtype: '140T_GOTTWALD', id_length: 6, requires_check_digit: false },
    { id: '175T_CRANE', category: 'CRANE', subtype: '175T_HYDRAULIC', id_length: 6, requires_check_digit: false },
    // Tower Cars / OHE Inspection Cars (3 to 6 Digits)
    { id: '8W_DETC', category: 'TOWER_CAR', subtype: '8W_DETC', id_length: 6, requires_check_digit: false },
    { id: '4W_DHTC', category: 'TOWER_CAR', subtype: '4W_DHTC', id_length: 3, requires_check_digit: false },
  ];

  for (const cat of categories) {
    await prisma.assetCategoryMaster.upsert({
      where: { id: cat.id },
      update: {
        category: cat.category,
        subtype: cat.subtype,
        id_length: cat.id_length,
        requires_check_digit: cat.requires_check_digit,
      },
      create: cat,
    });
  }

  // Repair Categories
  const repairCategories = [
    { id: 'POH', standard_tat_hours: 120 },
    { id: 'ROH', standard_tat_hours: 48 },
    { id: 'NPOH', standard_tat_hours: 72 },
    { id: 'SPECIAL_REPAIR', standard_tat_hours: 96 },
  ];

  for (const rc of repairCategories) {
    await prisma.repairCategoryMaster.upsert({
      where: { id: rc.id },
      update: { standard_tat_hours: rc.standard_tat_hours },
      create: rc,
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

    // 4b. Farhan Aiyyar System Admin User
    const farhanEmp = await prisma.employee.upsert({
      where: { employee_number: 'FARHAN-01' },
      update: {},
      create: {
        employee_number: 'FARHAN-01',
        first_name: 'Farhan',
        last_name: 'Aiyyar',
      }
    });

    const farhanUser = await prisma.user.upsert({
      where: { employee_id: farhanEmp.id },
      update: {
        password_hash: pwdHash,
      },
      create: {
        employee_id: farhanEmp.id,
        password_hash: pwdHash,
        status: 'ACTIVE'
      }
    });

    await prisma.userIdentifier.upsert({
      where: { type_normalized_value: { type: 'EMAIL', normalized_value: 'farhanaiyyar04@gmail.com' } },
      update: {},
      create: {
        user_id: farhanUser.id,
        type: 'EMAIL',
        value: 'farhanaiyyar04@gmail.com',
        normalized_value: 'farhanaiyyar04@gmail.com',
        is_primary: true,
        is_verified: true
      }
    });

    const farhanRoleExists = await prisma.userRole.findUnique({
      where: { user_id_role_id: { user_id: farhanUser.id, role_id: adminRole.id } }
    });

    if (!farhanRoleExists) {
      await prisma.userRole.create({
        data: {
          user_id: farhanUser.id,
          role_id: adminRole.id,
        }
      });
    }
  }

  // 5. Seed Demonstration Rolling Stock across Categories & 68 Locations
  const demoAssets = [
    // 11-Digit Wagons with Verified IR Check Digits
    { asset_number: '21021845128', category_id: 'BOXNHL', location: 'WRS-1', status: 'IN_REPAIR', pipeline: 'REPAIR', repair_cat: 'POH' },
    { asset_number: '31022204916', category_id: 'BCNHL', location: 'WRS-5', status: 'PENDING_QA', pipeline: 'REPAIR', repair_cat: 'ROH' },
    { asset_number: '85022010459', category_id: 'BVZI', location: 'NSY', status: 'Received NSY', pipeline: 'REPAIR', repair_cat: 'POH' },
    { asset_number: '40021932010', category_id: 'BTPN', location: 'WRS-2', status: 'Shop In', pipeline: 'REPAIR', repair_cat: 'SPECIAL_REPAIR', hold: 'Waiting for CBC draft gear components from store' },
    { asset_number: '21022401057', category_id: 'BOXNHL', location: 'GIF', status: 'IN_MANUFACTURING', pipeline: 'MFG', shop: 'GIF' },

    // 5-Digit Locomotives (Indian Railways 5-Digit Road Numbers)
    { asset_number: '30215', category_id: 'WAP7', location: 'DPS', status: 'IN_REPAIR', pipeline: 'REPAIR', repair_cat: 'POH' },
    { asset_number: '31102', category_id: 'WAG9', location: 'Trial Yard', status: 'FIT', pipeline: 'REPAIR', repair_cat: 'ROH' },

    // 6-Digit Heavy Breakdown Cranes (Jamalpur 140T / 175T)
    { asset_number: '140012', category_id: '140T_CRANE', location: 'CRANE', status: 'IN_REPAIR', pipeline: 'REPAIR', repair_cat: 'SPECIAL_REPAIR' },
    { asset_number: '175001', category_id: '175T_CRANE', location: 'CRANE', status: 'IN_MANUFACTURING', pipeline: 'MFG', shop: 'CRANE' },

    // 3 to 6-Digit Tower Cars (OHE Inspection)
    { asset_number: '080012', category_id: '8W_DETC', location: 'Tower Car Line', status: 'IN_REPAIR', pipeline: 'REPAIR', repair_cat: 'ROH' },
  ];

  for (const item of demoAssets) {
    const asset = await prisma.asset.upsert({
      where: { asset_number: item.asset_number },
      update: {
        current_location: item.location,
        current_status: item.status,
        category_id: item.category_id,
      },
      create: {
        asset_number: item.asset_number,
        category_id: item.category_id,
        current_location: item.location,
        current_status: item.status,
        is_active: true,
      },
    });

    if (item.pipeline === 'REPAIR') {
      const existingCycle = await prisma.repairCycle.findFirst({
        where: { asset_id: asset.id },
      });

      if (!existingCycle) {
        const cycle = await prisma.repairCycle.create({
          data: {
            asset_id: asset.id,
            repair_category_id: item.repair_cat || 'POH',
            status: item.status === 'FIT' ? 'COMPLETED' : 'ACTIVE',
            started_at: new Date(Date.now() - 48 * 3600 * 1000), // 2 days ago
          },
        });

        if (item.hold && adminRole) {
          const admin = await prisma.user.findFirst();
          if (admin) {
            await prisma.repairHold.create({
              data: {
                repair_cycle_id: cycle.cycle_id,
                reason: 'MATERIAL_SHORTAGE',
                remarks: item.hold,
                created_by: admin.id,
              },
            });
          }
        }
      }
    } else if (item.pipeline === 'MFG') {
      const existingOrder = await prisma.manufacturingOrder.findFirst({
        where: { asset_id: asset.id },
      });

      if (!existingOrder) {
        await prisma.manufacturingOrder.create({
          data: {
            asset_id: asset.id,
            production_type: 'NEW_BUILD',
            built_by_shop: item.shop || 'GIF',
            status: 'ACTIVE',
            started_at: new Date(Date.now() - 72 * 3600 * 1000),
          },
        });
      }
    }
  }

  // 6. Seed System Settings
  const settingsList = [
    {
      key: 'WORKSHOP_NAME',
      value: 'Jamalpur Locomotive & Carriage Workshop',
      description: 'Primary Indian Railways manufacturing and POH/ROH facility name',
    },
    {
      key: 'WORKSHOP_CODE',
      value: 'JMP',
      description: 'Three-letter Indian Railways workshop identifier',
    },
    {
      key: 'DEFAULT_RAILWAY_ZONE',
      value: 'ER',
      description: 'Host zonal railway code (Eastern Railway)',
    },
    {
      key: 'CHECK_DIGIT_ENFORCEMENT',
      value: 'STRICT',
      description: 'Enforce Indian Railways 6-Step Modulo-10 check digit verification on 11-digit wagons',
    },
    {
      key: 'ACTIVE_ASSET_CATEGORIES',
      value: 'WAGON,LOCO,CRANE,TOWER_CAR',
      description: 'Supported rolling stock categories active in command center',
    },
    {
      key: 'SESSION_TIMEOUT_MINS',
      value: '60',
      description: 'Inactivity period before requiring user re-authentication',
    },
  ];

  for (const s of settingsList) {
    await prisma.setting.upsert({
      where: { key: s.key },
      update: { value: s.value, description: s.description },
      create: s,
    });
  }

  // 7. Seed Initial Audit Logs
  const anyUser = await prisma.user.findFirst();
  if (anyUser) {
    const existingLogs = await prisma.auditLog.count();
    if (existingLogs === 0) {
      await prisma.auditLog.createMany({
        data: [
          {
            user_id: anyUser.id,
            action: 'SYSTEM_BOOTSTRAP',
            details: { message: 'RSMTS System Initialized with Jamalpur 68 Location Network' },
            timestamp: new Date(Date.now() - 24 * 3600 * 1000),
          },
          {
            user_id: anyUser.id,
            action: 'SETTINGS_CONFIGURED',
            details: { check_digit_algorithm: 'Indian Railways 6-Step Modulo-10' },
            timestamp: new Date(Date.now() - 12 * 3600 * 1000),
          },
          {
            user_id: anyUser.id,
            action: 'SECURITY_AUDIT',
            details: { compliance: 'Indian Railways Cyber Security Framework & Role Scoping' },
            timestamp: new Date(Date.now() - 2 * 3600 * 1000),
          },
        ],
      });
    }
  }

  console.log('Master data, users, settings & audit logs seeded successfully.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
