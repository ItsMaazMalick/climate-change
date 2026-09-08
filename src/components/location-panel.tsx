"use client";

import Link from "next/link";

import { ModelSpread, ScenarioComparison, SeasonalCycle, type CycleMonth } from "@/components/charts";
import { useApi } from "@/lib/hooks";
import {
  formatValue,
  PERIODS,
  SCENARIOS,
  type Indicator,
  type PeriodId,
  type ScenarioId,
} from "@/lib/climate/taxonomy";

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
  const base = `lat=${lat}&lon=${lon}&indicator=${indicator}`;
  const isBaseline = isBaselineParam(period);

  const point = useApi<PointResponse>(
    `/api/climate/point?${base}&scenario=${scenario}&period=${period}&model=${model}`,
  );
  const scenarios = useApi<ScenarioResponse>(
    `/api/climate/scenarios?${base}&period=${period}`,
  );
  const spread = useApi<SpreadResponse>(
    `/api/climate/models?${base}&scenario=${scenario}&period=${period}`,
  );
  const cycle = useApi<CycleResponse>(
    isBaselineParam(period)
      ? null
      : `/api/climate/cycle?${base}&scenario=${scenario}&period=${period}`,
  );

  const nearest = point.data?.location.nearestPlace;

  return (
    <div className="flex flex-col divide-y divide-[var(--color-border)]">
      {/* ---- header ---- */}
      <section className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="truncate text-[17px] font-semibold leading-tight">
              {nearest && nearest.distanceKm < 40
                ? nearest.name
                : `${Math.abs(lat).toFixed(2)}°N, ${Math.abs(lon).toFixed(2)}°E`}
            </h2>
            <p className="tnum mt-0.5 text-[11.5px] text-[var(--color-ink-faint)]">
              {lat.toFixed(3)}°N, {lon.toFixed(3)}°E
              {nearest && nearest.distanceKm >= 40 && (
                <> · {nearest.distanceKm} km from {nearest.name}</>
              )}
            </p>
          </div>
          {nearest && nearest.distanceKm < 40 && (
            <Link
              href={`/places/${nearest.id}?scenario=${scenario}&period=${period}`}
              className="shrink-0 rounded-md border border-[var(--color-border)] px-2 py-1 text-[11px] text-[var(--color-ink-muted)] transition-colors hover:border-[var(--color-brand)] hover:text-[var(--color-ink)]"
            >
              Full story →
            </Link>
          )}
        </div>

        {point.data?.meta?.note && (
          <p className="mt-2.5 rounded border-l-2 border-[var(--color-border-strong)] bg-[var(--color-surface)] py-1.5 pl-2.5 pr-2 text-[11px] leading-snug text-[var(--color-ink-faint)]">
            {point.data.meta.note}
          </p>
        )}
      </section>

      {/* ---- headline numbers ---- */}
      <section className="p-4">
        {point.error ? (
          <ErrorNote message={point.error} />
        ) : (
          <div className="grid grid-cols-3 gap-3">
            <Stat
              label="1995–2014"
              value={formatValue(point.data?.baseline?.value ?? null, indicator)}
              caption="baseline"
              loading={point.loading}
            />
            <Stat
              label={PERIODS[period].shortLabel}
              value={formatValue(point.data?.projected?.value ?? null, indicator)}
              caption="projected"
              loading={point.loading}
            />
            <Stat
              label="Change"
              value={
                isBaseline
                  ? "—"
                  : formatValue(point.data?.anomaly?.value ?? null, indicator, "anomaly")
              }
              caption={isBaseline ? "n/a at baseline" : "vs baseline"}
              emphasis
              // Colour by direction of concern, not by brand. Printing a
              // +2.3 °C warming in the brand green would read as good news.
              tone={toneFor(point.data?.anomaly?.value ?? null, point.data?.indicator)}
              loading={point.loading}
            />
          </div>
        )}
      </section>

      {/* ---- model uncertainty ---- */}
      {!isBaseline && (
        <section className="p-4">
          <SectionTitle
            title="Model uncertainty"
            hint="The spread across the 30 downscaled models, at this point, for this pathway and horizon."
          />
          {spread.loading ? (
            <Skeleton height={64} />
          ) : spread.data ? (
            <>
              <ModelSpread
                median={spread.data.spread.median}
                p10={spread.data.spread.p10}
                p90={spread.data.spread.p90}
                indicatorId={indicator}
                color={SCENARIOS[scenario].color}
              />
              <p className="mt-2 text-[11.5px] leading-relaxed text-[var(--color-ink-muted)]">
                {spread.data.description}
              </p>
            </>
          ) : (
            <p className="text-[11.5px] text-[var(--color-ink-faint)]">
              Percentile bounds are not published for this combination.
            </p>
          )}
        </section>
      )}

      {/* ---- scenario comparison ---- */}
      {!isBaseline && (
        <section className="p-4">
          <SectionTitle
            title={`All pathways · ${PERIODS[period].shortLabel}`}
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
                <p className="mt-2.5 text-[11.5px] leading-relaxed text-[var(--color-ink-muted)]">
                  {scenarios.data.divergence}
                </p>
              )}
            </>
          ) : null}
        </section>
      )}

      {/* ---- seasonal cycle ---- */}
      {!isBaseline && cycle.data && (
        <section className="p-4">
          <SectionTitle
            title="The shape of the year"
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
              <p className="mt-2.5 text-[11.5px] leading-relaxed text-[var(--color-ink-muted)]">
                July–September accounts for{" "}
                <span className="tnum font-semibold">
                  {cycle.data.monsoonSharePercent.baseline}%
                </span>{" "}
                of the annual total in the baseline and{" "}
                <span className="tnum font-semibold">
                  {cycle.data.monsoonSharePercent.projected}%
                </span>{" "}
                by {PERIODS[period].shortLabel}. A shift here changes exposure
                even when the annual total barely moves.
              </p>
            )}
          {cycle.data.extremes?.baseline && cycle.data.extremes.projected && (
            <p className="mt-2.5 text-[11.5px] leading-relaxed text-[var(--color-ink-muted)]">
              The warmest month shifts from{" "}
              <span className="tnum font-semibold">
                {formatValue(cycle.data.extremes.baseline.max, indicator)}
              </span>{" "}
              to{" "}
              <span className="tnum font-semibold">
                {formatValue(cycle.data.extremes.projected.max, indicator)}
              </span>
              , and the spread between the warmest and coolest month changes by{" "}
              <span className="tnum font-semibold">
                {formatValue(
                  cycle.data.extremes.projected.range - cycle.data.extremes.baseline.range,
                  indicator,
                  "anomaly",
                )}
              </span>
              .
            </p>
          )}
        </section>
      )}

      {/* ---- indicator context ---- */}
      {point.data?.indicator && (
        <section className="p-4">
          <SectionTitle title="About this indicator" />
          <p className="text-[12px] leading-relaxed text-[var(--color-ink-muted)]">
            {point.data.indicator.description}
          </p>
          {point.data.indicator.pakistanNote && (
            <p className="mt-2 border-l-2 border-[var(--color-brand)] pl-2.5 text-[12px] leading-relaxed text-[var(--color-ink-muted)]">
              {point.data.indicator.pakistanNote}
            </p>
          )}
        </section>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------

type Tone = "adverse" | "benign" | "neutral";

/**
 * Which way a change points for this indicator.
 *
 * `higherIsWorse` carries the direction of concern; "more rain" is not
 * straightforwardly good or bad, so indicators where the sign is genuinely
 * ambiguous resolve to neutral rather than being forced into a colour.
 */
function toneFor(value: number | null | undefined, indicator?: Indicator): Tone {
  if (value === null || value === undefined || !indicator) return "neutral";
  if (Math.abs(value) < 1e-9) return "neutral";
  if (indicator.family === "precipitation") return "neutral";
  return (value > 0) === indicator.higherIsWorse ? "adverse" : "benign";
}

const TONE_COLOR: Record<Tone, string> = {
  adverse: "#b91c1c",
  benign: "var(--color-brand-deep)",
  neutral: "var(--color-ink)",
};

function Stat({
  label,
  value,
  caption,
  emphasis,
  tone = "neutral",
  loading,
}: {
  label: string;
  value: string;
  caption: string;
  emphasis?: boolean;
  tone?: Tone;
  loading?: boolean;
}) {
  return (
    <div>
      <div className="label mb-1">{label}</div>
      {loading ? (
        <div className="h-6 w-16 animate-pulse rounded bg-[var(--color-surface-hover)]" />
      ) : (
        <div
          // A three-up stat row is 100px per column; "+211 mm" at 22px
          // overflows and wraps mid-value. Shrinking the emphasised figure
          // only when the string is long keeps the headline number large in
          // the common case and legible in every case.
          className={`tnum whitespace-nowrap leading-none ${
            emphasis
              ? `font-bold ${value.length > 7 ? "text-[17px]" : "text-[22px]"}`
              : `font-semibold ${value.length > 7 ? "text-[15px]" : "text-[19px]"}`
          }`}
          style={emphasis ? { color: TONE_COLOR[tone] } : undefined}
        >
          {value}
        </div>
      )}
      <div className="mt-1 text-[10px] text-[var(--color-ink-faint)]">{caption}</div>
    </div>
  );
}

function SectionTitle({ title, hint }: { title: string; hint?: string }) {
  return (
    <h3 className="label mb-2.5 flex items-center gap-1.5">
      {title}
      {hint && (
        <span
          title={hint}
          className="inline-flex h-3.5 w-3.5 cursor-help items-center justify-center rounded-full border border-[var(--color-border-strong)] text-[8px] font-bold normal-case"
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
      className="animate-pulse rounded bg-[var(--color-surface-hover)]"
      style={{ height }}
    />
  );
}

function ErrorNote({ message }: { message: string }) {
  return (
    <p className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-[11.5px] leading-snug text-[var(--color-ink-muted)]">
      {message}
    </p>
  );
}
