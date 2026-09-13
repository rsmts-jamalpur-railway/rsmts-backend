const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

process.env.NODE_ENV = 'production';

let dbUrl =
  process.env.DATABASE_PUBLIC_URL ||
  process.env.DATABASE_PRIVATE_URL ||
  process.env.DATABASE_URL ||
  process.env.POSTGRES_URL ||
  process.env.POSTGRES_PRISMA_URL;

if (dbUrl) {
  dbUrl = dbUrl.replace(/^"|"$/g, '').replace(/^'|'$/g, '');
}

let redisUrl =
  process.env.REDIS_PUBLIC_URL ||
  process.env.REDIS_PRIVATE_URL ||
  process.env.REDIS_URL;

if (redisUrl) {
  redisUrl = redisUrl.replace(/^"|"$/g, '').replace(/^'|'$/g, '');
  process.env.REDIS_URL = redisUrl;
}

console.log('🔍 Environment check:');
console.log('   PORT:', process.env.PORT || '3001 (default)');
console.log('   DATABASE_URL defined:', !!process.env.DATABASE_URL);
console.log('   DATABASE_PRIVATE_URL defined:', !!process.env.DATABASE_PRIVATE_URL);
console.log('   DATABASE_PUBLIC_URL defined:', !!process.env.DATABASE_PUBLIC_URL);
console.log('   PG_URL defined:', !!process.env.PG_URL);
console.log('   JWT_SECRET defined:', !!process.env.JWT_SECRET);
console.log('   REDIS_URL defined:', !!process.env.REDIS_URL);

const dbUrlKeys = Object.keys(process.env).filter(k => k.includes('URL') || k.includes('DATABASE') || k.includes('POSTGRES'));
console.log('   Available DB-related env keys:', dbUrlKeys.join(', '));

const redisKeys = Object.keys(process.env).filter(k => k.includes('REDIS'));
console.log('   Available Redis-related env keys:', redisKeys.join(', '));

if (dbUrl) {
  console.log('🚀 Running database migrations (prisma migrate deploy)...');
  process.env.DATABASE_URL = dbUrl;
  try {
    execSync('npx prisma migrate deploy', { stdio: 'inherit' });
    console.log('✅ Database migrations applied successfully.');

    if (process.env.SEED_DB === 'true' && fs.existsSync(path.join(__dirname, '../prisma/seed.js'))) {
      console.log('🌱 Running database seed (node prisma/seed.js)...');
      try {
        execSync('node prisma/seed.js', { stdio: 'inherit' });
        console.log('✅ Database seeded successfully.');
      } catch (seedErr) {
        console.error('⚠️ Database seed failed but continuing:', seedErr.message);
      }
    } else {
      console.log('⏩ Skipping database seed (SEED_DB=true is not set).');
      console.warn('⚠️ seed.js not found. Make sure it was compiled during the build step.');
    }
  } catch (err) {
    console.error('❌ Database migration failed:', err.message);
    // Continue instead of exiting, to see if app can at least start
  }
} else {
  console.warn('⚠️ WARNING: Neither DATABASE_URL nor DATABASE_PRIVATE_URL is configured in environment variables.');
  console.warn('👉 In Railway, ensure a PostgreSQL service exists and DATABASE_URL is set in this service\'s Variables tab.');
  console.warn('⚠️ Skipping "prisma migrate deploy"...');
}

// Find compiled entrypoint
const candidatePaths = [
  path.join(__dirname, '../dist/src/main.js'),
  path.join(__dirname, '../dist/main.js'),
];

let entrypoint = candidatePaths.find((p) => fs.existsSync(p));

if (!entrypoint) {
  console.error('❌ Could not find compiled main.js in dist/src/ or dist/!');
  process.exit(1);
}

console.log(`🚀 Starting application from ${entrypoint}...`);
require(entrypoint);
