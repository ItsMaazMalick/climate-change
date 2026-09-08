import { CCKP_CITATION, handler, searchParams } from "@/lib/api";
import {
  analogueFor,
  buildNarrative,
  mechanismsFor,
} from "@/lib/climate/interpret";
import { getPlace, nearestPlace } from "@/lib/climate/places";
import { resolvePoint } from "@/lib/climate/store";
import {
  FUTURE_PERIOD_IDS,
  HEADLINE_SCENARIO_IDS,
  INDICATORS,
  SCENARIOS,
  type PeriodId,
  type ScenarioId,
} from "@/lib/climate/taxonomy";
import { ApiError } from "@/lib/errors";
import { parseSearchParams, storyQuerySchema } from "@/lib/validation";

export const runtime = "nodejs";

/** The indicators the story is told through. */
const STORY_INDICATORS = [
  "tas", "tasmax", "hd35", "hd40", "tr23", "sd",
  "pr", "rx1day", "rx5day", "r95ptot", "cdd", "cdd65",
];

/**
 * The "climate story" for a place: baseline, projection, mechanism.
 *
 * This is the endpoint that pulls the platform together — one place, one
 * pathway, one horizon, told across every indicator at once, with the
 * scenario ladder and the trajectory through time alongside it.
 */
export const GET = handler(async (request) => {
  const query = parseSearchParams(storyQuerySchema, searchParams(request));

  const place = query.place ? getPlace(query.place) : undefined;
  const lat = place?.lat ?? query.lat;
  const lon = place?.lon ?? query.lon;

  if (lat === undefined || lon === undefined) {
    throw ApiError.badRequest("Provide a known place id, or lat and lon.");
  }

  const label =
    place?.name ??
    nearestPlace({ lat, lon })?.place.name ??
    `${lat.toFixed(2)}°N, ${lon.toFixed(2)}°E`;

  const scenario = query.scenario as ScenarioId;
  const period = query.period as PeriodId;

  // ---- indicator panel -------------------------------------------------
  const indicatorRows = await Promise.all(
    STORY_INDICATORS.map(async (indicator) => {
      const [baseline, projected, anomaly] = await Promise.all([
        resolvePoint({
          lat, lon, indicator,
          scenario: "historical",
          period: "1995-2014",
          product: "climatology",
        }).catch(() => null),
        resolvePoint({ lat, lon, indicator, scenario, period, product: "climatology" }).catch(() => null),
        resolvePoint({ lat, lon, indicator, scenario, period, product: "anomaly" }).catch(() => null),
      ]);
      return {
        indicator: INDICATORS[indicator]!,
        baseline: baseline?.value ?? null,
        projected: projected?.value ?? null,
        anomaly: anomaly?.value ?? null,
        unit: baseline?.unit ?? projected?.unit ?? "",
        anomalyUnit: anomaly?.unit ?? "",
        agreement: anomaly?.meta.agreement ?? null,
        source: (anomaly ?? projected ?? baseline)?.meta.source ?? null,
        available: Boolean(baseline || projected || anomaly),
      };
    }),
  );

  const pick = (key: "baseline" | "projected" | "anomaly") =>
    Object.fromEntries(
      indicatorRows.map((row) => [row.indicator.id, row[key]]),
    ) as Record<string, number | null>;

  // ---- scenario ladder, every pathway at every horizon ------------------
  const ladder = await Promise.all(
    HEADLINE_SCENARIO_IDS.map(async (s) => ({
      scenario: SCENARIOS[s],
      byPeriod: Object.fromEntries(
        await Promise.all(
          FUTURE_PERIOD_IDS.map(async (p) => [
            p,
            (
              await resolvePoint({
                lat, lon,
                indicator: "tas",
                scenario: s,
                period: p,
                product: "anomaly",
              }).catch(() => null)
            )?.value ?? null,
          ]),
        ),
      ) as Record<PeriodId, number | null>,
    })),
  );

  const narrative = buildNarrative({
    placeName: label,
    scenario,
    period,
    baseline: pick("baseline"),
    projected: pick("projected"),
    anomaly: pick("anomaly"),
  });

  return {
    data: {
      place: place ?? { id: null, name: label, lat, lon },
      location: { lat, lon },
      scenario: SCENARIOS[scenario],
      period,
      indicators: indicatorRows,
      ladder,
      narrative,
      analogue: analogueFor(pick("anomaly").tas ?? null),
      mechanisms: mechanismsFor("tas").concat(
        indicatorRows
          .filter((row) => row.anomaly !== null && Math.abs(row.anomaly) > 0)
          .flatMap((row) => mechanismsFor(row.indicator.id)),
      ).filter(
        (chain, index, all) => all.findIndex((c) => c.id === chain.id) === index,
      ),
    },
    meta: { dataset: "cmip6-x0.25", citation: CCKP_CITATION },
  };
});
