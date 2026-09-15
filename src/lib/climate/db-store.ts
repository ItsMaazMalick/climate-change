import { prisma } from "@/lib/db";

import type { AggregationId, PercentileId, ProductId, ScenarioId } from "./taxonomy";

/**
 * PostgreSQL/PostGIS read path.
 *
 * This layer answers the questions the flat grid arrays cannot: anything that
 * needs a join, a spatial predicate, or a ranking across many areas at once.
 * "Which twenty districts warm most under SSP3-7.0" is one indexed query
 * here; from the arrays it is 126 scans plus a sort in application code.
 *
 * It is optional by design. When `DATABASE_URL` is unset the store falls
 * through to the grid and the upstream API, and the platform still works.
 */

const DATASET_ID = "cmip6-x0.25";

export interface DbLookup {
  indicator: string;
  scenario: ScenarioId;
  period: string;
  model: string;
  percentile: PercentileId;
  product: ProductId;
  aggregation: AggregationId;
  areaId: string;
}

export interface DbValue {
  value: number | null;
  unit: string;
  min: number | null;
  max: number | null;
  cellCount: number;
  agreement: number | null;
}

/** One aggregated value for an administrative unit. */
export async function lookupArea(query: DbLookup): Promise<DbValue | null> {
  const row = await prisma.projection.findUnique({
    where: {
      projection_identity: {
        datasetId: DATASET_ID,
        indicatorId: query.indicator,
        scenarioId: query.scenario,
        modelId: query.model,
        periodId: query.period,
        product: query.product,
        aggregation: query.aggregation,
        percentile: query.percentile,
        areaId: query.areaId,
      },
    },
    select: {
      value: true,
      unit: true,
      minValue: true,
      maxValue: true,
      cellCount: true,
      agreement: true,
    },
  });

  if (!row) return null;
  return {
    value: row.value,
    unit: row.unit,
    min: row.minValue,
    max: row.maxValue,
    cellCount: row.cellCount,
    agreement: row.agreement,
  };
}

export interface AreaRanking {
  areaId: string;
  name: string;
  level: number;
  value: number;
  unit: string;
  agreement: number | null;
  centroid: { lat: number; lon: number };
}

/**
 * Rank administrative units by a projected change.
 *
 * This is the query that makes the database worth having: "where in Pakistan
 * does this get worst, and by how much" answered across all 126 districts in
 * a single index scan, ordered in the database rather than in Node.
 */
export async function rankAreas(options: {
  indicator: string;
  scenario: ScenarioId;
  period: string;
  product?: ProductId;
  model?: string;
  percentile?: PercentileId;
  level?: number;
  direction?: "asc" | "desc";
  limit?: number;
  country?: string;
}): Promise<AreaRanking[]> {
  const rows = await prisma.projection.findMany({
    where: {
      datasetId: DATASET_ID,
      indicatorId: options.indicator,
      scenarioId: options.scenario,
      periodId: options.period,
      product: options.product ?? "anomaly",
      aggregation: "annual",
      modelId: options.model ?? "ensemble-all",
      percentile: options.percentile ?? "median",
      value: { not: null },
      area: options.level !== undefined
        ? options.country && options.country !== "all"
          ? options.level === 1
            ? { level: 1, parentId: options.country }
            : { level: options.level, parent: { parentId: options.country } }
          : { level: options.level }
        : undefined,
    },
    select: {
      areaId: true,
      value: true,
      unit: true,
      agreement: true,
      area: {
        select: { name: true, level: true, centroidLat: true, centroidLon: true },
      },
    },
    orderBy: { value: options.direction ?? "desc" },
    take: options.limit ?? 20,
  });

  return rows.flatMap((row) =>
    row.area && row.areaId && row.value !== null
      ? [
          {
            areaId: row.areaId,
            name: row.area.name,
            level: row.area.level,
            value: row.value,
            unit: row.unit,
            agreement: row.agreement,
            centroid: { lat: row.area.centroidLat, lon: row.area.centroidLon },
          },
        ]
      : [],
  );
}

export interface CellHit {
  index: number;
  lat: number;
  lon: number;
  areaId: string | null;
  areaName: string | null;
  distanceKm: number;
}

/**
 * Nearest grid cell to a coordinate, resolved by PostGIS.
 *
 * `ST_Distance` on geography rather than a bounding-box approximation, so the
 * answer is correct near the poles of the extent and along the coast where a
 * degree of longitude is much shorter than a degree of latitude. The GiST
 * index on `point` makes the KNN operator (`<->`) an index scan rather than a
 * sequential one.
 */
export async function nearestCell(lat: number, lon: number): Promise<CellHit | null> {
  const rows = await prisma.$queryRaw<
    Array<{
      index: number;
      lat: number;
      lon: number;
      areaId: string | null;
      areaName: string | null;
      distance_m: number;
    }>
  >`
    SELECT
      c."index"                                   AS "index",
      c.lat                                       AS "lat",
      c.lon                                       AS "lon",
      c."areaId"                                  AS "areaId",
      a.name                                      AS "areaName",
      ST_Distance(
        c.point::geography,
        ST_SetSRID(ST_MakePoint(${lon}::double precision, ${lat}::double precision), 4326)::geography
      )                                           AS distance_m
    FROM grid_cells c
    LEFT JOIN areas a ON a.id = c."areaId"
    ORDER BY c.point <-> ST_SetSRID(
      ST_MakePoint(${lon}::double precision, ${lat}::double precision), 4326
    )
    LIMIT 1
  `;

  const hit = rows[0];
  if (!hit) return null;
  return {
    index: hit.index,
    lat: hit.lat,
    lon: hit.lon,
    areaId: hit.areaId,
    areaName: hit.areaName,
    distanceKm: Number((hit.distance_m / 1000).toFixed(1)),
  };
}

/**
 * Which administrative units contain a point.
 *
 * Returns the full hierarchy — country, province, district — because a click
 * on the map should be able to say "Larkana, Sindh" without three queries.
 */
export async function areasContaining(
  lat: number,
  lon: number,
): Promise<Array<{ id: string; name: string; level: number }>> {
  return prisma.$queryRaw`
    SELECT id, name, level
    FROM areas
    WHERE geometry IS NOT NULL
      AND ST_Intersects(
        geometry,
        ST_SetSRID(ST_MakePoint(${lon}::double precision, ${lat}::double precision), 4326)
      )
    ORDER BY level
  `;
}

export interface CoverageSummary {
  projections: number;
  areas: number;
  cells: number;
  indicators: string[];
  scenarios: string[];
  lastRun: { plan: string; status: string; finishedAt: Date | null } | null;
}

/** What the database actually holds, for the health and methodology surfaces. */
export async function dbCoverage(): Promise<CoverageSummary> {
  const [projections, areas, cells, indicators, scenarios, lastRun] = await Promise.all([
    prisma.projection.count(),
    prisma.area.count(),
    prisma.gridCell.count(),
    prisma.projection.findMany({
      distinct: ["indicatorId"],
      select: { indicatorId: true },
      orderBy: { indicatorId: "asc" },
    }),
    prisma.projection.findMany({
      distinct: ["scenarioId"],
      select: { scenarioId: true },
      orderBy: { scenarioId: "asc" },
    }),
    prisma.ingestionRun.findFirst({
      orderBy: { startedAt: "desc" },
      select: { plan: true, status: true, finishedAt: true },
    }),
  ]);

  return {
    projections,
    areas,
    cells,
    indicators: indicators.map((row) => row.indicatorId),
    scenarios: scenarios.map((row) => row.scenarioId),
    lastRun,
  };
}
