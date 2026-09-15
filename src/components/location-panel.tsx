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


  const cycle = useApi<CycleResponse>(
    isBaselineParam(period)
      ? null
      : `/api/climate/cycle?${base}&scenario=${scenario}&period=${period}`,
  );

  const nearest = point.data?.location.nearestPlace;

  return (
    <div className="flex flex-col">
      {/* ---- header ---- */}
      <section className="border-b border-border px-4 py-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="truncate text-lg font-semibold leading-tight tracking-tight text-ink">
              {nearest && nearest.distanceKm < 40
                ? nearest.name
                : `${Math.abs(lat).toFixed(2)}°N, ${Math.abs(lon).toFixed(2)}°E`}
            </h2>
            <p className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-2xs text-ink-faint">
              {nearest?.province && (
                <span className="font-medium text-ink-muted">{nearest.province}</span>
              )}
              {nearest?.province && <span aria-hidden>·</span>}
              <span className="tabular-nums" data-numeric>
                {lat.toFixed(3)}°N, {lon.toFixed(3)}°E
              </span>
              {nearest && nearest.distanceKm >= 40 && (
                <>
                  <span aria-hidden>·</span>
                  <span className="tabular-nums" data-numeric>
                    {nearest.distanceKm} km from {nearest.name}
                  </span>
                </>
              )}
            </p>
          </div>
          {nearest && nearest.distanceKm < 40 && (
            <Link
              href={`/places/${nearest.id}?scenario=${scenario}&period=${period}`}
              className="btn btn-secondary shrink-0 px-3! py-1.5! text-xs"
            >
              Profile →
            </Link>
          )}
        </div>

        {point.data?.meta && <ScopeBadge scope={point.data.meta.spatialScope} />}

        {point.data?.meta?.note && (
          <p className="mt-2 border-l-2 border-border-strong pl-2.5 text-2xs leading-snug text-ink-faint">
            {point.data.meta.note}
          </p>
        )}
      </section>

      {/* ---- headline readout ---- */}
      <section className="space-y-3 px-4 py-4" data-tour="readout">
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





      {/* ---- seasonal cycle ---- */}
      {!isBaseline && cycle.data && (
        <section className="px-4 pb-4">
          <Panel
            title="Seasonality"
            hint="Monthly climatology at this point, baseline against projection."
          >
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
          </Panel>
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

/**
 * One readout section: a card with a header strip carrying the title and an
 * optional definition, and the content on the panel surface below it.
 */
function Panel({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="card">
      <div className="card-head justify-between">
        <span className="text-xs font-semibold text-ink">{title}</span>
        {hint && (
          <span
            title={hint}
            aria-label={hint}
            className="inline-flex h-4 w-4 shrink-0 cursor-help items-center justify-center rounded-(--radius-pill) border border-border-strong bg-surface-panel text-[9px] font-bold text-ink-faint transition-colors hover:text-ink"
          >
            ?
          </span>
        )}
      </div>
      <div className="card-body">{children}</div>
    </div>
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
