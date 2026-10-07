import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

/**
 * Real country-outline polygons for the 43 IOFS members (Natural Earth
 * 1:50m admin-0, simplified — see `scripts/build-iofs-boundaries.ts`).
 * Served as a static file rather than bundled into the client JS, since it's
 * only needed by the one map on `/iofs`.
 */
export async function GET() {
  const file = path.join(process.cwd(), "data", "iofs", "boundaries.json");
  const raw = await readFile(file, "utf8");
  return new NextResponse(raw, {
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=604800",
    },
  });
}
