const { PrismaClient } = require("@prisma/client");

async function main() {
  const prisma = new PrismaClient();
  try {
    await prisma.$connect();
    console.log("connected");
  } catch (error) {
    console.error("connect failed:", error?.message || error);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

main();
