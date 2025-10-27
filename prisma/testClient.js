const { PrismaClient } = require('@prisma/client');

async function main() {
  const prisma = new PrismaClient();
  try {
    const folders = await prisma.folder.findMany();
    console.log('folders:', folders);
  } catch (err) {
    console.error('Error querying DB:', err);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

main();
