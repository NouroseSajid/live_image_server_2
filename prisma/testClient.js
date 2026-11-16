const { PrismaClient } = require("@prisma/client");
const { PrismaMariaDb } = require("@prisma/adapter-mariadb");

async function main() {
  const prisma = new PrismaClient({
    adapter: new PrismaMariaDb(process.env.DATABASE_URL),
  });
  try {
    const folders = await prisma.folder.findMany();
    console.log("folders:", folders);
  } catch (err) {
    console.error("Error querying DB:", err);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

main();
