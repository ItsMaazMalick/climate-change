"use client";

import Link from "next/link";

import { ScenarioComparison, SeasonalCycle, type CycleMonth } from "@/components/charts";
import { MetricCard } from "@/components/ui/metric-card";
import { NextStepCard } from "@/components/nav/next-step-card";
import { UncertaintyStrip } from "@/components/ui/uncertainty-strip";
import { DataProvenanceFooter } from "@/components/ui/data-provenance-footer";
import { useApi } from "@/lib/hooks";
import { scenarioColorVar } from "@/lib/climate/scenario-style";
import {
  formatValue,
  PERIODS,
  SCENARIOS,
  type Indicator,
  type PeriodId,
  type ScenarioId,
} from "@/lib/climate/taxonomy";
import { useCountry } from "@/lib/country-context";

interface PointResponse {
  location: {
    lat: number;
    lon: number;
    nearestPlace: { id: string; name: string; province: string; distanceKm: number } | null;
  };
  indicator: Indicator;
  baseline: { value: number | null; unit: string } | null;
  projected: { value: number | null; unit: string } | null;
  anomaly: { value: number | null; unit: string } | null;
  meta: {
    source: string;
    spatialScope: string;
    offsetCells?: number;
    agreement?: number | null;
    note?: string;
  } | null;
}

interface ScenarioResponse {
  results: Array<{
    scenario: { id: ScenarioId };
    anomaly: number | null;
    agreement: number | null;
  }>;
  divergence: string | null;
}

interface CycleResponse {
  months: CycleMonth[];
  unit: string;
  accumulates: boolean;
  annual: { baseline: number | null; projected: number | null } | null;
  extremes: {
    baseline: { max: number; min: number; range: number; warmestMonth: string | null } | null;
    projected: { max: number; min: number; range: number; warmestMonth: string | null } | null;
  } | null;
  monsoonSharePercent: { baseline: number | null; projected: number | null } | null;
}

interface SpreadResponse {
  spread: { median: number | null; p10: number | null; p90: number | null };
  spreadAvailable?: boolean;
  members?: Array<{ value: number | null }>;
  description: string;
  confidence: "strong" | "moderate" | "weak";
}

/**
 * The read-out for whatever the user has selected on the map.
 *
 * Ordered by what a reader needs in sequence: where am I, what is it like
 * now, what changes, how confident is that, and how does the answer depend on
 * which future we get.
 */
function isBaselineParam(period: PeriodId): boolean {
  return period === "1995-2014";
}

export function LocationPanel({
  lat,
  lon,
  indicator,
  scenario,
  period,
  model,
}: {
  lat: number;
  lon: number;
  indicator: string;
  scenario: ScenarioId;
  period: PeriodId;
  model: string;
}) {
  const { country, config } = useCountry();
  const base = `lat=${lat}&lon=${lon}&indicator=${indicator}`;
  const isBaseline = isBaselineParam(period);

  const point = useApi<PointResponse>(
    `/api/climate/point?${base}&scenario=${scenario}&period=${period}&model=${model}`,
  );
  const scenarios = useApi<ScenarioResponse>(
    `/api/climate/scenarios?${base}&period=${period}`,
  );
  const spread = useApi<SpreadResponse>(
    `/api/climate/models?${base}&scenario=${scenario}&period=${period}&country=${country}`,
  );
  const cycle = useApi<CycleResponse>(
    isBaselineParam(period)
      ? null
      : `/api/climate/cycle?${base}&scenario=${scenario}&period=${period}`,
  );

  const nearest = point.data?.location.nearestPlace;

  return (
    <div className="flex flex-col divide-y divide-border">
      {/* ---- header ---- */}
      <section className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="truncate text-lg font-semibold tracking-tight text-ink leading-tight">
                {nearest && nearest.distanceKm < 40
                  ? nearest.name
                  : `${Math.abs(lat).toFixed(2)}°N, ${Math.abs(lon).toFixed(2)}°E`}
              </h2>
              {nearest && nearest.province && (
                <span className="rounded-(--radius-pill) border border-border bg-surface-recessed px-2 py-0.5 text-2xs font-medium text-ink-muted">
                  {nearest.province}
                </span>
              )}
            </div>
            <p className="mt-1 text-2xs text-ink-faint tabular-nums">
              {lat.toFixed(3)}°N, {lon.toFixed(3)}°E
              {nearest && nearest.distanceKm >= 40 && (
                <> · {nearest.distanceKm} km from {nearest.name}</>
              )}
            </p>
          </div>
          {nearest && nearest.distanceKm < 40 && (
            <Link
              href={`/places/${nearest.id}?scenario=${scenario}&period=${period}`}
              className="btn btn-secondary shrink-0 py-1.5! px-3! text-xs"
            >
              Full Profile →
            </Link>
          )}
        </div>

        {point.data?.meta && <ScopeBadge scope={point.data.meta.spatialScope} />}

        {point.data?.meta?.note && (
          <p className="mt-2 rounded-(--radius-control) border border-border bg-surface-recessed p-2.5 text-2xs leading-snug text-ink-muted">
            {point.data.meta.note}
          </p>
        )}
      </section>

      {/* ---- headline readout ---- */}
      <section className="space-y-3 p-4" data-tour="readout">
        {point.error ? (
          <ErrorNote message={point.error} />
        ) : (
          <>
            {!isBaseline && (
              <p className="text-sm leading-relaxed text-ink">
                {point.data?.anomaly?.value !== null && point.data?.anomaly?.value !== undefined ? (
                  <>
                    Under {SCENARIOS[scenario].label},{" "}
                    {nearest && nearest.distanceKm < 40 ? nearest.name : "this location"}
                    &rsquo;s {point.data.indicator.label.toLowerCase()} is projected to{" "}
                    {(point.data.anomaly.value ?? 0) >= 0 ? "rise" : "fall"}{" "}
                    <span className="font-semibold tabular-nums" data-numeric>
                      {formatValue(Math.abs(point.data.anomaly.value ?? 0), indicator, "anomaly", { signed: false })}
                    </span>{" "}
                    by {PERIODS[period].shortLabel} relative to 1995–2014.
                  </>
                ) : (
                  `A projection for this combination isn't published for ${config.name}.`
                )}
              </p>
            )}
            <MetricCard
              label={isBaseline ? "Baseline value" : "Projected change"}
              indicatorId={indicator}
              baseline={point.data?.baseline?.value}
              projected={point.data?.projected?.value}
              delta={isBaseline ? null : point.data?.anomaly?.value}
              epochLabel={PERIODS[period].shortLabel}
              tone={toneFor(point.data?.anomaly?.value ?? null, point.data?.indicator)}
              seamColor={scenarioColorVar(scenario)}
              info={point.data?.indicator?.description}
              loading={point.loading}
            />
          </>
        )}
      </section>

      {/* ---- model uncertainty ---- */}
      {!isBaseline && (
        <section className="p-4">
          <div className="tier-flat p-4">
            <SectionTitle
              title="Multi-Model Uncertainty"
              hint="The spread across the 30 downscaled models, at this point, for this pathway and horizon."
            />
            {spread.loading ? (
              <Skeleton height={64} />
            ) : spread.data ? (
              <>
                <UncertaintyStrip
                  median={spread.data.spread.median}
                  p10={spread.data.spread.p10}
                  p90={spread.data.spread.p90}
                  members={(spread.data.members ?? [])
                    .map((m) => m.value)
                    .filter((v): v is number => v !== null)}
                  indicatorId={indicator}
                  color={scenarioColorVar(scenario)}
                />
                <DataProvenanceFooter
                  variable={indicator}
                  aggregation="annual · ensemble percentiles"
                  epoch={PERIODS[period].shortLabel}
                />
              </>
            ) : (
              <p className="text-xs text-ink-faint">
                Percentile bounds are not published for this combination.
              </p>
            )}
          </div>
        </section>
      )}

      {/* ---- scenario comparison ---- */}
      {!isBaseline && (
        <section className="p-4">
          <div className="tier-flat p-4">
            <SectionTitle
              title={`All Policy Pathways · ${PERIODS[period].shortLabel}`}
              hint="The same place and horizon under every emissions pathway. The gap between them is the part still determined by choices."
            />
            {scenarios.loading ? (
              <Skeleton height={110} />
            ) : scenarios.data ? (
              <>
                <ScenarioComparison
                  bars={scenarios.data.results.map((result) => ({
                    scenario: result.scenario.id,
                    value: result.anomaly,
                    agreement: result.agreement,
                  }))}
                  indicatorId={indicator}
                />
                {scenarios.data.divergence && (
                  <p className="mt-3 text-xs leading-relaxed text-ink-muted">
                    {scenarios.data.divergence}
                  </p>
                )}
              </>
            ) : null}
          </div>
        </section>
      )}

      {/* ---- seasonal cycle ---- */}
      {!isBaseline && cycle.data && (
        <section className="p-4">
          <div className="tier-flat p-4">
            <SectionTitle
              title="Annual Seasonality & Cycles"
              hint="Monthly climatology at this point, baseline against projection."
            />
            <SeasonalCycle
              months={cycle.data.months}
              unit={cycle.data.unit}
              indicatorId={indicator}
              color={SCENARIOS[scenario].color}
              height={168}
            />
            {cycle.data.monsoonSharePercent &&
              cycle.data.monsoonSharePercent.baseline !== null &&
              cycle.data.monsoonSharePercent.projected !== null && (
                <p className="mt-2.5 text-xs leading-relaxed text-ink-muted">
                  July–September accounts for{" "}
                  <span className="font-semibold text-ink tabular-nums">
                    {cycle.data.monsoonSharePercent.baseline}%
                  </span>{" "}
                  of the annual total in the baseline and{" "}
                  <span className="font-semibold text-accent tabular-nums">
                    {cycle.data.monsoonSharePercent.projected}%
                  </span>{" "}
                  by {PERIODS[period].shortLabel}.
                </p>
              )}
            {cycle.data.extremes?.baseline && cycle.data.extremes.projected && (
              <p className="mt-2.5 text-xs leading-relaxed text-ink-muted">
                Warmest month shifts from{" "}
                <span className="font-semibold text-ink tabular-nums">
                  {formatValue(cycle.data.extremes.baseline.max, indicator)}
                </span>{" "}
                to{" "}
                <span className="font-semibold text-accent tabular-nums">
                  {formatValue(cycle.data.extremes.projected.max, indicator)}
                </span>
                .
              </p>
            )}
          </div>
        </section>
      )}

      {/* ---- indicator context ---- */}
      {point.data?.indicator && (
        <section className="p-4">
          <div className="tier-flat p-4">
            <SectionTitle title="Scientific Variable Methodology" />
            <p className="text-xs leading-relaxed text-ink-muted">
              {point.data.indicator.description}
            </p>
            {point.data.indicator.countryNotes?.[country] && (
              <p className="mt-2.5 rounded-(--radius-control) border-l-2 border-accent bg-surface-panel p-3 text-xs leading-relaxed text-ink-muted">
                {point.data.indicator.countryNotes[country]}
              </p>
            )}
          </div>
        </section>
      )}

      {/* ---- next step ---- */}
      <section className="p-4">
        <NextStepCard
          from="explore"
          state={{
            lat: String(lat),
            lon: String(lon),
            place: nearest && nearest.distanceKm < 40 ? nearest.id : undefined,
            indicator,
            scenario,
            period,
          }}
        />
      </section>
    </div>
  );
}

// ---------------------------------------------------------------------------

type Tone = "adverse" | "benign" | "neutral";

function toneFor(value: number | null | undefined, indicator?: Indicator): Tone {
  if (value === null || value === undefined || !indicator) return "neutral";
  if (Math.abs(value) < 1e-9) return "neutral";
  if (indicator.family === "precipitation") return "neutral";
  return (value > 0) === indicator.higherIsWorse ? "adverse" : "benign";
}

/**
 * Says, in two words, what kind of claim the number below is: a real
 * rasterised grid cell, or a national value with modelled spatial detail.
 * A reviewer should never have to guess.
 */
function ScopeBadge({ scope }: { scope: string }) {
  const map: Record<string, { label: string; tone: "ok" | "warn" | "muted" }> = {
    point: { label: "Grid cell · 0.25°", tone: "ok" },
    interpolated: { label: "Interpolated from national value", tone: "warn" },
    area: { label: "Area mean of grid cells", tone: "ok" },
    national: { label: "National aggregate", tone: "warn" },
  };
  const item = map[scope] ?? { label: scope, tone: "muted" as const };
  const cls =
    item.tone === "ok"
      ? "border-leaf bg-leaf-soft text-brand-deep"
      : item.tone === "warn"
        ? "border-warn bg-warn/10 text-warn"
        : "border-border bg-surface-recessed text-ink-faint";
  return (
    <span
      className={`mt-3 inline-flex items-center gap-1.5 rounded-(--radius-pill) border px-2 py-0.5 text-2xs font-medium ${cls}`}
    >
      <span aria-hidden className="h-1.5 w-1.5 rounded-(--radius-pill) bg-current" />
      {item.label}
    </span>
  );
}

function SectionTitle({ title, hint }: { title: string; hint?: string }) {
  return (
    <h3 className="label mb-2.5 flex items-center gap-1.5 text-ink-muted">
      {title}
      {hint && (
        <span
          title={hint}
          className="inline-flex h-3.5 w-3.5 cursor-help items-center justify-center rounded-(--radius-pill) border border-border-strong bg-surface-recessed text-[8px] font-semibold normal-case text-ink-faint"
        >
          ?
        </span>
      )}
    </h3>
  );
}

function Skeleton({ height }: { height: number }) {
  return (
    <div
      className="animate-pulse rounded-(--radius-container) bg-surface-active"
      style={{ height }}
    />
  );
}

function ErrorNote({ message }: { message: string }) {
  return (
    <p className="rounded-(--radius-control) border-l-4 border-danger bg-surface-recessed px-3.5 py-2 text-xs leading-snug text-ink-muted">
      {message}
    </p>
  );
}
