import { NextResponse } from "next/server";

import { cacheStats } from "@/lib/cache";
import { dbCoverage } from "@/lib/climate/db-store";
import { gridCoverage } from "@/lib/climate/grid";
import { activeStoreMode } from "@/lib/climate/store";
import { env, hasDatabase } from "@/lib/env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Liveness and capability probe.
 *
 * Reports which data paths are actually usable, so a deployment that lost its
 * grid volume or its database is visibly degraded rather than quietly
 * serving whole-country averages as local values.
 */
export async function GET() {
  const [coverage, database] = await Promise.all([
    gridCoverage(),
    hasDatabase
      ? dbCoverage().catch((error: Error) => ({ error: error.message }))
      : Promise.resolve(null),
  ]);

  const databaseOk = database !== null && !("error" in database);

  const checks = {
    grid: {
      status: coverage.available ? "ok" : "unavailable",
      fields: coverage.fieldCount,
      sizeMb: coverage.sizeMb,
      generatedAt: coverage.generatedAt,
    },
    database:
      database === null
        ? { status: "not_configured" }
        : "error" in database
          ? { status: "unreachable", detail: database.error }
          : {
              status: "ok",
              projections: database.projections,
              areas: database.areas,
              cells: database.cells,
              indicators: database.indicators.length,
              lastRun: database.lastRun,
            },
    upstream: {
      status: env.CLIMATE_STORE_MODE === "grid" ? "disabled" : "enabled",
      endpoint: env.CCKP_API_BASE,
    },
    cache: cacheStats(),
  };

  // The service is healthy if *any* read path can answer. Losing one is
  // degradation, not failure — which is the whole point of layering them.
  const healthy =
    coverage.available || databaseOk || env.CLIMATE_STORE_MODE !== "grid";

  return NextResponse.json(
    {
      status: healthy ? "ok" : "degraded",
      storeMode: activeStoreMode(),
      checks,
      timestamp: new Date().toISOString(),
    },
    { status: healthy ? 200 : 503, headers: { "Cache-Control": "no-store" } },
  );
}
