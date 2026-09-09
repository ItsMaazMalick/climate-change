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
    <div className="flex flex-col divide-y divide-slate-200">
      {/* ---- header ---- */}
      <section className="p-4 bg-gradient-to-b from-slate-50/90 to-white">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="truncate text-[19px] font-extrabold tracking-tight text-slate-900 leading-tight">
                {nearest && nearest.distanceKm < 40
                  ? nearest.name
                  : `${Math.abs(lat).toFixed(2)}°N, ${Math.abs(lon).toFixed(2)}°E`}
              </h2>
              {nearest && nearest.province && (
                <span className="rounded-full bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 text-[11px] font-mono font-bold text-emerald-800">
                  {nearest.province}
                </span>
              )}
            </div>
            <p className="tnum mt-1 text-[11.5px] font-mono text-slate-500">
              {lat.toFixed(3)}°N, {lon.toFixed(3)}°E
              {nearest && nearest.distanceKm >= 40 && (
                <> · {nearest.distanceKm} km from {nearest.name}</>
              )}
            </p>
          </div>
          {nearest && nearest.distanceKm < 40 && (
            <Link
              href={`/places/${nearest.id}?scenario=${scenario}&period=${period}`}
              className="shrink-0 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-[11.5px] font-bold text-emerald-800 transition-all hover:bg-emerald-100 shadow-xs"
            >
              Full Profile →
            </Link>
          )}
        </div>

        {point.data?.meta?.note && (
          <p className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-[11px] leading-snug text-slate-600 shadow-xs">
            ℹ️ {point.data.meta.note}
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
              info={point.data?.indicator?.description}
              loading={point.loading}
            />
          </>
        )}
      </section>

      {/* ---- model uncertainty ---- */}
      {!isBaseline && (
        <section className="p-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
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
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
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
                  <p className="mt-3 text-[11.5px] leading-relaxed text-slate-600">
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
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
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
                <p className="mt-2.5 text-[11.5px] leading-relaxed text-slate-600">
                  July–September accounts for{" "}
                  <span className="tnum font-bold text-slate-900">
                    {cycle.data.monsoonSharePercent.baseline}%
                  </span>{" "}
                  of the annual total in the baseline and{" "}
                  <span className="tnum font-bold text-emerald-700">
                    {cycle.data.monsoonSharePercent.projected}%
                  </span>{" "}
                  by {PERIODS[period].shortLabel}.
                </p>
              )}
            {cycle.data.extremes?.baseline && cycle.data.extremes.projected && (
              <p className="mt-2.5 text-[11.5px] leading-relaxed text-slate-600">
                Warmest month shifts from{" "}
                <span className="tnum font-bold text-slate-900">
                  {formatValue(cycle.data.extremes.baseline.max, indicator)}
                </span>{" "}
                to{" "}
                <span className="tnum font-bold text-emerald-700">
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
          <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4 shadow-xs">
            <SectionTitle title="Scientific Variable Methodology" />
            <p className="text-[12px] leading-relaxed text-slate-600 font-medium">
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

function SectionTitle({ title, hint }: { title: string; hint?: string }) {
  return (
    <h3 className="label mb-2.5 flex items-center gap-1.5 text-ink-muted">
      {title}
      {hint && (
        <span
          title={hint}
          className="inline-flex h-3.5 w-3.5 cursor-help items-center justify-center rounded-(--radius-pill) border border-border-strong bg-surface-recessed text-[8px] font-bold normal-case text-ink-faint"
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
      className="animate-pulse rounded-xl bg-slate-100"
      style={{ height }}
    />
  );
}

function ErrorNote({ message }: { message: string }) {
  return (
    <p className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2 text-[11.5px] leading-snug text-rose-700 shadow-xs">
      {message}
    </p>
  );
}
