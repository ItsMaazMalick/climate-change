import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "@/generated/prisma/client";

/**
 * Prisma client singleton.
 *
 * Prisma 7 routes every query through a driver adapter rather than its own
 * query engine binary. For Neon that means node-postgres talking to the
 * pooled endpoint, which is what lets a serverless deployment survive more
 * than a handful of concurrent requests.
 *
 * The singleton matters in development: Next.js hot-reloads modules on every
 * save, and without it each reload would open a fresh pool until Neon refused
 * new connections.
 */
const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

function createClient(): PrismaClient {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set; the database store is unavailable.");
  }

  const adapter = new PrismaPg({
    connectionString,
    // Sized for a pooled Neon endpoint. The application is read-heavy and
    // every query is short, so a small pool with a hard timeout fails fast
    // rather than queueing behind a stuck connection.
    max: 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
  });

  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });
}

export const prisma: PrismaClient = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

/** Cheap probe used by the health endpoint and by store mode selection. */
export async function databaseReachable(): Promise<boolean> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch {
    return false;
  }
}
