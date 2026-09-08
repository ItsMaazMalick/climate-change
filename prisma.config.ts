import "dotenv/config";

import { defineConfig, env } from "prisma/config";

/**
 * Prisma configuration.
 *
 * From v7 the connection string lives here rather than in the datasource
 * block, which is what allows the pooled URL and the direct URL to be chosen
 * per command: migrations and introspection need a direct connection, while
 * the application runs through Neon's pooler.
 */
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    // Schema changes must bypass the connection pooler: PgBouncer in
    // transaction mode cannot hold the advisory locks migrations rely on.
    url: env("DIRECT_DATABASE_URL"),
  },
});
