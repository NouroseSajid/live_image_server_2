import { PrismaClient } from "@prisma/client";

declare global {
  // eslint-disable-next-line vars-on-top, no-var
  var prisma: PrismaClient | undefined;
}

const _prisma = global.prisma || new PrismaClient();

if (process.env.NODE_ENV !== "production") global.prisma = _prisma;

export default _prisma;
