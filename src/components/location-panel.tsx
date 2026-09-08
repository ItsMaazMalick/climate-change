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
  const { country } = useCountry();
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

      {/* ---- headline numbers ---- */}
      <section className="p-4">
        {point.error ? (
          <ErrorNote message={point.error} />
        ) : (
          <div className="grid grid-cols-3 gap-2.5">
            <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-xs">
              <Stat
                label="Baseline"
                value={formatValue(point.data?.baseline?.value ?? null, indicator)}
                caption="1995–2014"
                loading={point.loading}
              />
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-xs">
              <Stat
                label="Projected"
                value={formatValue(point.data?.projected?.value ?? null, indicator)}
                caption={PERIODS[period].shortLabel}
                loading={point.loading}
              />
            </div>
            <div className="rounded-2xl border border-emerald-300 bg-emerald-50/60 p-3 shadow-xs ring-1 ring-emerald-500/20">
              <Stat
                label="Change (Δ)"
                value={
                  isBaseline
                    ? "—"
                    : formatValue(point.data?.anomaly?.value ?? null, indicator, "anomaly")
                }
                caption={isBaseline ? "Baseline" : `vs 1995–2014`}
                emphasis
                tone={toneFor(point.data?.anomaly?.value ?? null, point.data?.indicator)}
                loading={point.loading}
              />
            </div>
          </div>
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
                <ModelSpread
                  median={spread.data.spread.median}
                  p10={spread.data.spread.p10}
                  p90={spread.data.spread.p90}
                  indicatorId={indicator}
                  color={SCENARIOS[scenario].color}
                />
                <p className="mt-2.5 text-[11.5px] leading-relaxed text-slate-600">
                  {spread.data.description}
                </p>
              </>
            ) : (
              <p className="text-[11.5px] text-slate-500">
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

      {/* ---- sector impact intelligence ---- */}
      {!isBaseline && point.data?.anomaly?.value !== null && point.data?.anomaly?.value !== undefined && (
        <section className="p-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
            <SectionTitle
              title="Sector Impact & Vulnerability Intelligence"
              hint="Domain-specific risk assessment for this location under the selected climate pathway."
            />
            <div className="grid grid-cols-2 gap-2 mt-2">
              <SectorRiskCard
                icon="💧"
                title="Water & Basins"
                risk={getRiskLevel(indicator, point.data.anomaly.value, "water")}
                detail="Runoff timing shift & canal evaporative loss."
              />
              <SectorRiskCard
                icon="🌾"
                title="Agriculture"
                risk={getRiskLevel(indicator, point.data.anomaly.value, "agri")}
                detail="Crop heat stress & growing season shifts."
              />
              <SectorRiskCard
                icon="🌡️"
                title="Urban & Health"
                risk={getRiskLevel(indicator, point.data.anomaly.value, "urban")}
                detail="Urban heat island & heat-index exposure."
              />
              <SectorRiskCard
                icon="⚡"
                title="Energy Grid"
                risk={getRiskLevel(indicator, point.data.anomaly.value, "energy")}
                detail="Peak cooling demand & thermal line derating."
              />
            </div>
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
              <p className="mt-2.5 rounded-xl border-l-3 border-emerald-500 bg-white p-3 text-[11.5px] leading-relaxed text-slate-600 shadow-xs">
                {point.data.indicator.countryNotes[country]}
              </p>
            )}
          </div>
        </section>
      )}
    </div>
  );
}

function getRiskLevel(
  indicator: string,
  anomaly: number,
  sector: "water" | "agri" | "urban" | "energy",
): "Low" | "Moderate" | "High" | "Severe" {
  const abs = Math.abs(anomaly);
  if (indicator === "tas") {
    if (abs < 1.5) return "Low";
    if (abs < 2.5) return sector === "urban" ? "High" : "Moderate";
    if (abs < 4.0) return "High";
    return "Severe";
  }
  if (indicator === "tx40") {
    if (abs < 5) return "Low";
    if (abs < 15) return "Moderate";
    if (abs < 30) return "High";
    return "Severe";
  }
  if (indicator === "cdd") {
    if (abs < 5) return "Low";
    if (abs < 12) return "Moderate";
    return "High";
  }
  return abs > 15 ? "High" : abs > 5 ? "Moderate" : "Low";
}

const RISK_BADGES: Record<"Low" | "Moderate" | "High" | "Severe", { bg: string; text: string; ring: string }> = {
  Low: { bg: "bg-emerald-50", text: "text-emerald-700", ring: "ring-emerald-300" },
  Moderate: { bg: "bg-amber-50", text: "text-amber-700", ring: "ring-amber-300" },
  High: { bg: "bg-orange-50", text: "text-orange-700", ring: "ring-orange-300" },
  Severe: { bg: "bg-rose-50", text: "text-rose-700", ring: "ring-rose-300" },
};

function SectorRiskCard({
  icon,
  title,
  risk,
  detail,
}: {
  icon: string;
  title: string;
  risk: "Low" | "Moderate" | "High" | "Severe";
  detail: string;
}) {
  const badge = RISK_BADGES[risk];
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-2.5 shadow-xs">
      <div className="flex items-center justify-between gap-1 mb-1">
        <span className="text-[11.5px] font-bold text-slate-900 flex items-center gap-1.5 truncate">
          <span>{icon}</span>
          <span className="truncate">{title}</span>
        </span>
        <span
          className={`shrink-0 rounded-md px-1.5 py-0.5 text-[9.5px] font-mono font-bold ring-1 ${badge.bg} ${badge.text} ${badge.ring}`}
        >
          {risk}
        </span>
      </div>
      <p className="text-[10px] leading-tight text-slate-500">{detail}</p>
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

const TONE_COLOR: Record<Tone, string> = {
  adverse: "#e11d48",
  benign: "#059669",
  neutral: "#0f172a",
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
      <div className="label mb-1 text-slate-500">{label}</div>
      {loading ? (
        <div className="h-6 w-16 animate-pulse rounded bg-slate-200" />
      ) : (
        <div
          className={`tnum whitespace-nowrap leading-none font-mono ${
            emphasis
              ? `font-black ${value.length > 7 ? "text-[17px]" : "text-[23px]"}`
              : `font-extrabold ${value.length > 7 ? "text-[15px]" : "text-[20px]"} text-slate-900`
          }`}
          style={emphasis ? { color: TONE_COLOR[tone] } : undefined}
        >
          {value}
        </div>
      )}
      <div className="mt-1 text-[10px] font-mono text-slate-400">{caption}</div>
    </div>
  );
}

function SectionTitle({ title, hint }: { title: string; hint?: string }) {
  return (
    <h3 className="label mb-2.5 flex items-center gap-1.5 text-slate-700 font-bold">
      {title}
      {hint && (
        <span
          title={hint}
          className="inline-flex h-3.5 w-3.5 cursor-help items-center justify-center rounded-full border border-slate-300 bg-slate-100 text-[8px] font-bold normal-case text-slate-500"
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
