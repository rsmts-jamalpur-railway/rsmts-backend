const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const dbUrl =
  process.env.DATABASE_URL ||
  process.env.DATABASE_PRIVATE_URL ||
  process.env.POSTGRES_URL ||
  process.env.POSTGRES_PRISMA_URL;

console.log('🔍 Environment check:');
console.log('   PORT:', process.env.PORT || '3001 (default)');
console.log('   DATABASE_URL defined:', !!process.env.DATABASE_URL);
console.log('   DATABASE_PRIVATE_URL defined:', !!process.env.DATABASE_PRIVATE_URL);
console.log('   JWT_SECRET defined:', !!process.env.JWT_SECRET);

if (dbUrl) {
  console.log('🚀 Running database migrations (prisma migrate deploy)...');
  try {
    execSync('npx prisma migrate deploy', { stdio: 'inherit' });
    console.log('✅ Database migrations applied successfully.');
  } catch (err) {
    console.error('❌ Database migration failed:', err.message);
    process.exit(1);
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
