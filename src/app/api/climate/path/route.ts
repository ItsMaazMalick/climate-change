import { CCKP_CITATION, handler, searchParams } from "@/lib/api";
import { isInsideCountryBounds } from "@/lib/climate/countries";
import { deriveProjected } from "@/lib/climate/derive";
import { nearestPlace } from "@/lib/climate/places";
import { resolvePoint } from "@/lib/climate/store";
import {
  FUTURE_PERIOD_IDS,
  INDICATORS,
  PERIODS,
  SCENARIOS,
  SSP_IDS,
  type PeriodId,
  type ScenarioId,
} from "@/lib/climate/taxonomy";
import { ApiError } from "@/lib/errors";
import { parseSearchParams, pointQuerySchema } from "@/lib/validation";

export const runtime = "nodejs";

const querySchema = pointQuerySchema.pick({
  lat: true,
  lon: true,
  indicator: true,
  model: true,
});

/**
 * Where each published 20-year window is drawn on a time axis. The windows
 * run 2020–2039, 2040–2059, … so each is plotted at its centre, rounded to the
 * decade. The baseline (1995–2014) sits at 2005 on the same logic.
 */
const BASELINE_YEAR = 2005;
const WINDOW_YEAR: Record<(typeof FUTURE_PERIOD_IDS)[number], number> = {
  "2020-2039": 2030,
  "2040-2059": 2050,
  "2060-2079": 2070,
  "2080-2099": 2090,
};

/**
 * One place, every pathway, every future window — the whole path to 2100 in a
 * single response.
 *
 * Clicking a map point would otherwise cost twenty round trips (five pathways
 * times four windows). Fanning out on the server lets them share the local
 * grid, which answers each in well under a millisecond.
 *
 * Annual series are only published as national aggregates, so a *point* has
 * no year-by-year trace. What it does have, from the 0.25° grid, is a real
 * value for each 20-year window. This route returns exactly those and nothing
 * interpolated: five anchors per pathway, not a manufactured annual curve.
 */
export const GET = handler(async (request) => {
  const query = parseSearchParams(querySchema, searchParams(request));

  if (!isInsideCountryBounds(query.lat, query.lon, "PAK")) {
    throw ApiError.badRequest("This view covers Pakistan only.", {
      coordinates: { lat: query.lat, lon: query.lon },
    });
  }

  const indicator = INDICATORS[query.indicator]!;
  const where = { lat: query.lat, lon: query.lon, indicator: query.indicator, model: query.model };

  const baseline = await resolvePoint({
    ...where,
    scenario: "historical" as ScenarioId,
    period: "1995-2014" as PeriodId,
    product: "climatology",
  }).catch(() => null);

  const lines = await Promise.all(
    (SSP_IDS as readonly ScenarioId[]).map(async (scenario) => {
      const windows = await Promise.all(
        FUTURE_PERIOD_IDS.map(async (period) => {
          const anomaly = await resolvePoint({
            ...where,
            scenario,
            period,
            product: "anomaly",
          }).catch(() => null);
          const delta = anomaly?.value ?? null;
          return {
            year: WINDOW_YEAR[period],
            period,
            periodLabel: PERIODS[period].shortLabel,
            delta,
            // D1: the projected absolute is always baseline + change, never an
            // independently fetched future value that could disagree with it.
            value: deriveProjected(baseline?.value ?? null, delta),
          };
        }),
      );
      return {
        id: scenario,
        label: SCENARIOS[scenario].label,
        color: SCENARIOS[scenario].color,
        points: [
          {
            year: BASELINE_YEAR,
            period: "1995-2014",
            periodLabel: PERIODS["1995-2014"].shortLabel,
            delta: baseline?.value === null || baseline === null ? null : 0,
            value: baseline?.value ?? null,
          },
          ...windows,
        ],
      };
    }),
  );

  const hasData = baseline?.value != null && lines.some((l) => l.points.some((p) => p.delta !== null && p.year > BASELINE_YEAR));
  const nearest = nearestPlace({ lat: query.lat, lon: query.lon }, 150, "PAK");

  return {
    data: {
      location: {
        lat: query.lat,
        lon: query.lon,
        nearestPlace: nearest
          ? { id: nearest.place.id, name: nearest.place.name, distanceKm: Math.round(nearest.distanceKm) }
          : null,
      },
      indicator,
      unit: baseline?.unit ?? indicator.unit,
      model: query.model,
      baseline: baseline ? { value: baseline.value, period: "1995-2014" } : null,
      available: hasData,
      lines: hasData ? lines : [],
    },
    meta: {
      source: baseline?.meta.source,
      dataset: "cmip6-x0.25",
      citation: CCKP_CITATION,
    },
  };
});
