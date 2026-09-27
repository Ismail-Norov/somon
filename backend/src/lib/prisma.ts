import { PrismaClient } from '@prisma/client';

// passwordHash never leaves the database layer unless explicitly selected (see auth login).
function createClient() {
  return new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
    omit: { user: { passwordHash: true } },
  });
}

type SomonPrismaClient = ReturnType<typeof createClient>;

const globalForPrisma = globalThis as unknown as { prisma?: SomonPrismaClient };

export const prisma = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
