const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const count = await prisma.movementLog.count({
    where: {
      new_status: 'Dispatched',
      timestamp: {
        gte: new Date('2026-07-30T18:30:00Z') // midnight IST in UTC
      }
    }
  });
  console.log('Dispatches today:', count);
  
  const logs = await prisma.movementLog.findMany({
    where: { new_status: 'Dispatched' },
    orderBy: { timestamp: 'desc' },
    take: 5
  });
  console.log('Recent Dispatches:', logs.map(l => l.timestamp));
}
main().then(()=>prisma.$disconnect());
