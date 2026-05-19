import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient | undefined };

const isDev = process.env['NODE_ENV'] !== 'production';

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: isDev ? ['query', 'warn', 'error'] : ['error'],
  });

if (isDev) {
  globalForPrisma.prisma = prisma;
}
