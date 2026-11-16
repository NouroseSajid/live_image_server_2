import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaClient } from "@prisma/client";

declare global {
  // eslint-disable-next-line vars-on-top, no-var
  var prisma: PrismaClient | undefined;
}

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("DATABASE_URL is not set");
}

const _prisma =
  global.prisma ||
  new PrismaClient({ adapter: new PrismaMariaDb(databaseUrl) });

if (process.env.NODE_ENV !== "production") global.prisma = _prisma;

export default _prisma;
