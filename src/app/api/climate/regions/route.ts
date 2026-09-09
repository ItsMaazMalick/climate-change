import { z } from "zod";

import { CCKP_CITATION, handler, searchParams } from "@/lib/api";
import { COUNTRIES, type CountryCode } from "@/lib/climate/countries";
import { aggregateCells, loadCellsFile } from "@/lib/climate/grid";
import { resolveField } from "@/lib/climate/store";
import { INDICATORS, type PeriodId, type ScenarioId } from "@/lib/climate/taxonomy";
import { ApiError } from "@/lib/errors";
import {
  indicatorSchema,
  modelSchema,
  parseSearchParams,
  percentileSchema,
  periodSchema,
  scenarioSchema,
} from "@/lib/validation";

export const runtime = "nodejs";

const querySchema = z.object({
  country: z.enum(["PAK", "UZB", "AUS", "NZL"]).default("PAK"),
  /** 1 = provinces/states/regions, 2 = districts/LGAs. */
  level: z.coerce.number().int().min(1).max(2).default(2),
  indicator: indicatorSchema.default("tas"),
  scenario: scenarioSchema.default("ssp245"),
  period: periodSchema.default("2040-2059"),
  model: modelSchema,
  percentile: percentileSchema.optional(),
  product: z.enum(["climatology", "anomaly"]).default("anomaly"),
});

/**
 * Every administrative unit of a country, valued in one request.
 *
 * This backs the choropleth. The map paints official boundary polygons rather
 * than a raster, so it needs one number per polygon — and it needs them all at
 * once, because a request per district would be 547 round trips for Australia.
 *
 * The value for a unit is the equal-weighted mean of the climate-grid cells
 * whose centres fall inside it, precomputed by `scripts/build-boundaries.ts`
 * against the full-resolution boundary. Units smaller than a 0.25° cell
 * resolve to the single cell containing their centroid, so a compact district
 * reports the value covering it rather than reporting nothing.
 */
export const GET = handler(async (request) => {
  const query = parseSearchParams(querySchema, searchParams(request));
  const country = query.country as CountryCode;
  const config = COUNTRIES[country];

  const field = await resolveField({
    indicator: query.indicator,
    scenario: query.scenario as ScenarioId,
    period: query.period as PeriodId,
    model: query.model,
    percentile: query.percentile,
    product: query.product,
    aggregation: "annual",
    country,
  });

  if (!field) {
    throw ApiError.unsupported(
      `No gridded field for ${query.indicator} / ${query.scenario} / ${query.period} in ${config.name}.`,
      "Try another indicator or pathway; not every combination is published.",
    );
  }

  const cellsFile =
    query.level === 1 ? config.geoFiles.level1Cells : config.geoFiles.level2Cells;
  const membership = await loadCellsFile(cellsFile);

  if (Object.keys(membership).length === 0) {
    throw ApiError.unsupported(
      `No cell index for ${config.name} level ${query.level}.`,
      "Run `npm run geo:build` to generate the administrative boundaries and their grid-cell membership.",
    );
  }

  const regions = Object.entries(membership).map(([id, cells]) => {
    const stats = aggregateCells(field, cells);
    return {
      id,
      value: stats.mean === null ? null : Number(stats.mean.toFixed(3)),
      min: stats.min,
      max: stats.max,
      cells: stats.cellsWithData,
      agreement: stats.agreement,
    };
  });

  // The colour scale is built from the region values, not the underlying cell
  // values: averaging pulls the extremes in, so a scale stretched over raw
  // cells would leave every polygon washed out in the middle of the ramp.
  const values = regions
    .map((r) => r.value)
    .filter((v): v is number => v !== null)
    .sort((a, b) => a - b);

  const quantile = (q: number) =>
    values.length ? values[Math.min(values.length - 1, Math.floor(q * values.length))]! : null;

  return {
    data: {
      country,
      level: query.level,
      indicator: INDICATORS[query.indicator]!,
      scenario: query.scenario,
      period: query.period,
      product: query.product,
      unit: field.units,
      regions,
      stats: {
        count: values.length,
        min: values[0] ?? null,
        max: values[values.length - 1] ?? null,
        p02: quantile(0.02),
        p98: quantile(0.98),
      },
    },
    meta: { source: "grid", dataset: "cmip6-x0.25", citation: CCKP_CITATION },
  };
});
