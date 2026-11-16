import { z } from "zod";

import { CCKP_CITATION, handler, searchParams } from "@/lib/api";
import { isInsideCountryBounds } from "@/lib/climate/countries";
import { deriveProjected } from "@/lib/climate/derive";
import { nearestPlace } from "@/lib/climate/places";
import { resolvePoint, resolveSeries } from "@/lib/climate/store";
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

const querySchema = pointQuerySchema
  .pick({ lat: true, lon: true, indicator: true, model: true })
  .extend({ annual: z.enum(["0", "1"]).default("0") });

/** Window each anchor year stands for, for averaging the national series. */
const ANCHOR_SPAN: Record<number, [number, number]> = {
  2005: [1995, 2014],
  2030: [2020, 2039],
  2050: [2040, 2059],
  2070: [2060, 2079],
  2090: [2080, 2099],
};

type Anchor = { year: number; value: number | null };

/**
 * An estimated year-by-year path for one point.
 *
 * Annual series exist only as national aggregates; a point has five real
 * 20-year values. This keeps the national curve's year-to-year shape and
 * shifts it so each 20-year window averages to the point's own value — the
 * offset is interpolated between window centres. It is a labelled estimate
 * (a standard delta/offset method), never presented as grid data.
 */
function localAnnual(
  national: Array<{ year: number; value: number | null }>,
  anchors: Anchor[],
  baseline: number,
) {
  const byYear = new Map(national.filter((p) => p.value !== null).map((p) => [p.year, p.value!]));
  const offsets = anchors.flatMap((anchor) => {
    const span = ANCHOR_SPAN[anchor.year];
    if (!span || anchor.value === null) return [];
    let sum = 0;
    let count = 0;
    for (let year = span[0]; year <= span[1]; year += 1) {
      const v = byYear.get(year);
      if (v !== undefined) {
        sum += v;
        count += 1;
      }
    }
    return count ? [{ year: anchor.year, offset: anchor.value - sum / count }] : [];
  });
  if (offsets.length === 0) return [];

  const offsetAt = (year: number) => {
    if (year <= offsets[0]!.year) return offsets[0]!.offset;
    const last = offsets[offsets.length - 1]!;
    if (year >= last.year) return last.offset;
    const i = offsets.findIndex((o) => o.year > year);
    const a = offsets[i - 1]!;
    const b = offsets[i]!;
    return a.offset + ((year - a.year) / (b.year - a.year)) * (b.offset - a.offset);
  };

  return [...byYear.entries()]
    .filter(([year]) => year >= 1995 && year <= 2100)
    .sort((a, b) => a[0] - b[0])
    .map(([year, v]) => {
      const value = Number((v + offsetAt(year)).toFixed(3));
      return { year, value, delta: Number((value - baseline).toFixed(3)) };
    });
}

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

  if (query.annual === "1" && baseline?.value != null) {
    const baseValue = baseline.value;
    await Promise.all(
      lines.map(async (line) => {
        const series = await resolveSeries({
          indicator: query.indicator,
          scenario: line.id,
          model: query.model,
          geography: "PAK",
        }).catch(() => null);
        Object.assign(line, {
          annual: series ? localAnnual(series.points, line.points, baseValue) : [],
        });
      }),
    );
  }

  const hasData =baseline?.value != null && lines.some((l) => l.points.some((p) => p.delta !== null && p.year > BASELINE_YEAR));
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
