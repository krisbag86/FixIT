import "server-only";

import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient | undefined };

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

// Always cache the Prisma client on globalThis to prevent connection pool exhaustion
// in both development and production environments (especially important for serverless/edge)
globalForPrisma.prisma = prisma;
