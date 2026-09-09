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

function getClient(): PrismaClient {
  const existing = globalForPrisma.prisma;
  if (existing) return existing;

  const created = createClient();
  if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = created;
  return created;
}

/**
 * The client is constructed on first use, not on import.
 *
 * `db-store.ts` is imported unconditionally by `climate/store.ts`, which every
 * climate route handler pulls in. If the client were built at module scope, a
 * deployment without `DATABASE_URL` would throw during module evaluation and
 * *every* climate endpoint would 500 before running a line of its own code —
 * even though the database is optional and the grid can answer on its own.
 *
 * Deferring construction keeps that failure where it belongs: at the moment
 * something actually tries to query, which only happens behind `hasDatabase`.
 */
export const prisma: PrismaClient = new Proxy({} as PrismaClient, {
  get(_target, property) {
    const client = getClient();
    const value = Reflect.get(client, property) as unknown;
    // Bind to the real client, not the proxy: Prisma's methods and model
    // delegates rely on their own internal `this`, and handing them the proxy
    // would break them in ways that only surface at query time.
    return typeof value === "function" ? value.bind(client) : value;
  },
  has(_target, property) {
    return Reflect.has(getClient(), property);
  },
});

/** Cheap probe used by the health endpoint and by store mode selection. */
export async function databaseReachable(): Promise<boolean> {
  if (!process.env.DATABASE_URL) return false;
  try {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch {
    return false;
  }
}
