"use client";

import Link from "next/link";
import { useState } from "react";

import {
  ScenarioMatrix,
  SeasonalCycle,
  TimeSeriesChart,
  type CycleMonth,
} from "@/components/charts";
import { PeriodPicker, ScenarioPicker } from "@/components/controls";
import { getCountry } from "@/lib/climate/countries";
import type { Place } from "@/lib/climate/places";
import {
  formatValue,
  PERIODS,
  SCENARIOS,
  type Indicator,
  type PeriodId,
  type ScenarioId,
} from "@/lib/climate/taxonomy";
import { useApi } from "@/lib/hooks";

interface StoryResponse {
  place: { id: string | null; name: string; lat: number; lon: number };
  scenario: (typeof SCENARIOS)[ScenarioId];
  period: PeriodId;
  indicators: Array<{
    indicator: Indicator;
    baseline: number | null;
    projected: number | null;
    anomaly: number | null;
    unit: string;
    anomalyUnit: string;
    agreement: number | null;
    source: string | null;
    available: boolean;
  }>;
  ladder: Array<{
    scenario: { id: ScenarioId };
    byPeriod: Record<string, number | null>;
  }>;
  narrative: Array<{ kind: "projection" | "mechanism"; text: string }>;
  analogue: { text: string } | null;
  mechanisms: Array<{
    id: string;
    title: string;
    steps: string[];
    requires: string;
  }>;
}

interface CycleResponse {
  months: CycleMonth[];
  unit: string;
  indicator: Indicator;
  accumulates: boolean;
  annual: { baseline: number | null; projected: number | null } | null;
  extremes: {
    baseline: { max: number; min: number; range: number; warmestMonth: string | null } | null;
    projected: { max: number; min: number; range: number; warmestMonth: string | null } | null;
  } | null;
  monsoonSharePercent: { baseline: number | null; projected: number | null } | null;
}

interface TrajectoryResponse {
  unit: string;
  scenarioStartYear: number;
  note: string;
  lines: Array<{
    id: ScenarioId;
    label: string;
    color: string;
    points: Array<{ year: number; value: number | null }>;
  }>;
}

/**
 * The climate story for one place.
 *
 * Structured as an argument rather than a dashboard: this is what the place
 * is like now, this is how it changes, this is how much that depends on which
 * pathway the world takes, this is how confident the models are, and this is
 * the physical mechanism connecting the numbers to something that matters —
 * with an explicit statement of what would be needed to go further.
 */
export function ClimateStory({ place }: { place: Place }) {
  const countryName = getCountry(place.country).name;
  const [scenario, setScenario] = useState<ScenarioId>("ssp245");
  const [period, setPeriod] = useState<PeriodId>("2040-2059");

  const story = useApi<StoryResponse>(
    `/api/climate/story?place=${place.id}&scenario=${scenario}&period=${period}`,
  );

  // All five pathways arrive in one response; fanning out on the server
  // keeps this to a single round trip and avoids fetching inside a loop.
  const trajectory = useApi<TrajectoryResponse>(
    `/api/climate/trajectory?indicator=tas&geography=${place.country}&smooth=11`,
  );
  const lines = trajectory.data?.lines ?? [];

  // The seasonal cycle is shown for both headline variables: temperature says
  // how the shape of the year changes, precipitation says whether the monsoon
  // moves. Neither is visible in an annual mean.
  const base = `lat=${place.lat}&lon=${place.lon}&scenario=${scenario}&period=${period}`;
  const tempCycle = useApi<CycleResponse>(`/api/climate/cycle?${base}&indicator=tas`);
  const rainCycle = useApi<CycleResponse>(`/api/climate/cycle?${base}&indicator=pr`);

  const available = story.data?.indicators.filter((row) => row.available) ?? [];

  return (
    <div className="mx-auto max-w-5xl px-5 py-9">
      {/* ---------------------------------------------------- header ---- */}
      <header className="mb-7">
        <Link
          href="/places"
          className="text-[12px] text-[var(--color-ink-faint)] transition-colors hover:text-[var(--color-ink)]"
        >
          ← All places
        </Link>
        <h1 className="mt-2 text-[28px] font-semibold leading-tight tracking-tight">
          {place.name}
        </h1>
        <p className="tnum mt-1 text-[13px] text-[var(--color-ink-muted)]">
          {place.province} · {place.lat.toFixed(3)}°N, {place.lon.toFixed(3)}°E ·{" "}
          {place.elevation.toLocaleString()} m
        </p>
        {place.note && (
          <p className="mt-3 max-w-2xl border-l-2 border-[var(--color-brand)] pl-3 text-[13.5px] leading-relaxed text-[var(--color-ink-muted)]">
            {place.note}
          </p>
        )}
      </header>

      {/* ---------------------------------------------------- controls -- */}
      <div className="mb-7 grid gap-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 sm:grid-cols-[240px_1fr]">
        <div>
          <div className="label mb-1.5">Emissions pathway</div>
          <ScenarioPicker value={scenario} onChange={setScenario} compact />
        </div>
        <div>
          <div className="label mb-1.5">Horizon</div>
          <PeriodPicker value={period} onChange={setPeriod} includeBaseline={false} />
          <p className="mt-3 text-[12px] leading-relaxed text-[var(--color-ink-muted)]">
            {SCENARIOS[scenario].summary}
          </p>
        </div>
      </div>

      {/* ---------------------------------------------------- narrative - */}
      <Section title={`What changes by ${PERIODS[period].shortLabel}`}>
        {story.loading ? (
          <SkeletonLines count={5} />
        ) : (
          <div className="space-y-2.5">
            {story.data?.narrative.map((statement, index) => (
              <p
                key={index}
                className={
                  statement.kind === "projection"
                    ? "text-[14px] leading-relaxed"
                    : "border-l-2 border-[var(--color-border-strong)] pl-3 text-[13px] leading-relaxed text-[var(--color-ink-muted)]"
                }
              >
                {statement.text}
              </p>
            ))}
            {story.data?.analogue && (
              <p className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-3 text-[13px] leading-relaxed text-[var(--color-ink-muted)]">
                {story.data.analogue.text}
              </p>
            )}
          </div>
        )}
      </Section>

      {/* ---------------------------------------------------- indicators - */}
      <Section
        title="Indicators"
        subtitle={`Baseline 1995–2014 against ${PERIODS[period].shortLabel} under ${SCENARIOS[scenario].label}.`}
      >
        {story.loading ? (
          <SkeletonLines count={6} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] text-[13px]">
              <thead>
                <tr className="border-b border-[var(--color-border)]">
                  <th className="label py-2 text-left font-semibold">Indicator</th>
                  <th className="label py-2 text-right font-semibold">1995–2014</th>
                  <th className="label py-2 text-right font-semibold">
                    {PERIODS[period].shortLabel}
                  </th>
                  <th className="label py-2 text-right font-semibold">Change</th>
                </tr>
              </thead>
              <tbody>
                {available.map((row) => (
                  <tr
                    key={row.indicator.id}
                    className="border-b border-[var(--color-border)] last:border-0"
                  >
                    <td className="py-2.5 pr-3">
                      <div className="font-medium">{row.indicator.label}</div>
                      <div className="text-[11px] text-[var(--color-ink-faint)]">
                        {row.source === "grid"
                          ? "at this location"
                          : "national average"}
                      </div>
                    </td>
                    <td className="tnum py-2.5 text-right text-[var(--color-ink-muted)]">
                      {formatValue(row.baseline, row.indicator.id)}
                    </td>
                    <td className="tnum py-2.5 text-right">
                      {formatValue(row.projected, row.indicator.id)}
                    </td>
                    <td
                      className="tnum py-2.5 text-right font-semibold"
                      // Same rule as the location panel: colour by direction
                      // of concern, and leave precipitation uncoloured —
                      // "more rain" in a country that floods and droughts is
                      // not straightforwardly good or bad news.
                      style={{
                        color:
                          row.anomaly === null || row.indicator.family === "precipitation"
                            ? undefined
                            : (row.anomaly > 0) === row.indicator.higherIsWorse
                              ? "#b91c1c"
                              : "var(--color-brand-deep)",
                      }}
                    >
                      {formatValue(row.anomaly, row.indicator.id, "anomaly")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      {/* ---------------------------------------------------- ladder ----- */}
      <Section
        title="Every pathway, every horizon"
        subtitle="Warming in the annual mean, relative to 1995–2014. The columns barely differ in the 2020s and diverge sharply by the 2090s — that divergence is the part still open to choice."
      >
        {story.data ? (
          <ScenarioMatrix
            rows={story.data.ladder.map((row) => ({
              scenario: row.scenario.id,
              byPeriod: row.byPeriod,
            }))}
            indicatorId="tas"
          />
        ) : (
          <SkeletonLines count={4} />
        )}
      </Section>

      {/* ---------------------------------------------------- seasonal --- */}
      <Section
        title="The shape of the year"
        subtitle={`Monthly climatology at ${place.name}, 1995–2014 against ${PERIODS[period].shortLabel} under ${SCENARIOS[scenario].label}. Hover any month for its values.`}
      >
        <div className="grid gap-6 lg:grid-cols-2">
          {[
            { data: tempCycle.data, id: "tas", title: "Temperature" },
            { data: rainCycle.data, id: "pr", title: "Precipitation" },
          ].map((panel) => (
            <div
              key={panel.id}
              className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4"
            >
              <h3 className="label mb-2.5">{panel.title}</h3>
              {panel.data ? (
                <>
                  <SeasonalCycle
                    months={panel.data.months}
                    unit={panel.data.unit}
                    indicatorId={panel.id}
                    color={SCENARIOS[scenario].color}
                  />
                  {panel.data.monsoonSharePercent?.baseline != null &&
                    panel.data.monsoonSharePercent.projected != null && (
                      <p className="mt-2.5 text-[12px] leading-relaxed text-[var(--color-ink-muted)]">
                        July–September carries{" "}
                        <span className="tnum font-semibold">
                          {panel.data.monsoonSharePercent.baseline}%
                        </span>{" "}
                        of the annual total in the baseline and{" "}
                        <span className="tnum font-semibold">
                          {panel.data.monsoonSharePercent.projected}%
                        </span>{" "}
                        by {PERIODS[period].shortLabel}.
                      </p>
                    )}
                  {panel.data.extremes?.baseline && panel.data.extremes.projected && (
                    <p className="mt-2.5 text-[12px] leading-relaxed text-[var(--color-ink-muted)]">
                      The warmest month rises from{" "}
                      <span className="tnum font-semibold">
                        {formatValue(panel.data.extremes.baseline.max, panel.id)}
                      </span>{" "}
                      to{" "}
                      <span className="tnum font-semibold">
                        {formatValue(panel.data.extremes.projected.max, panel.id)}
                      </span>
                      .
                    </p>
                  )}
                </>
              ) : (
                <SkeletonLines count={5} />
              )}
            </div>
          ))}
        </div>
      </Section>

      {/* ---------------------------------------------------- trajectory - */}
      <Section
        title="Trajectory, 1950–2100"
        subtitle={`National annual mean temperature, 11-year smoothed. Hover any year to read every pathway at once; click a pathway in the legend to isolate it. ${countryName}-wide rather than local — the archive publishes continuous time series only as spatial aggregates.`}
      >
        {lines.length > 0 ? (
          <>
            <TimeSeriesChart
              lines={lines}
              unit="°C"
              yLabel="mean temperature"
              indicatorId="tas"
            />
          </>
        ) : (
          <SkeletonLines count={6} />
        )}
      </Section>

      {/* ---------------------------------------------------- mechanisms - */}
      <Section
        title="From climate signal to consequence"
        subtitle="These are physical pathways, not predictions. Each chain ends with what would actually be required to quantify its endpoint — which this platform does not attempt."
      >
        <div className="grid gap-3 md:grid-cols-2">
          {story.data?.mechanisms.slice(0, 6).map((chain) => (
            <article
              key={chain.id}
              className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4"
            >
              <h3 className="text-[13.5px] font-semibold">{chain.title}</h3>
              <ol className="mt-2.5 space-y-1.5">
                {chain.steps.map((step, index) => (
                  <li
                    key={index}
                    className="flex gap-2 text-[12.5px] leading-snug text-[var(--color-ink-muted)]"
                  >
                    <span className="tnum mt-px shrink-0 text-[10px] text-[var(--color-ink-faint)]">
                      {index + 1}
                    </span>
                    {step}
                  </li>
                ))}
              </ol>
              <p className="mt-3 border-t border-[var(--color-border)] pt-2.5 text-[11.5px] leading-relaxed text-[var(--color-ink-faint)]">
                <span className="font-semibold">To quantify this: </span>
                {chain.requires}
              </p>
            </article>
          ))}
        </div>
      </Section>

      <footer className="hairline mt-8 pt-5 text-[11.5px] leading-relaxed text-[var(--color-ink-faint)]">
        Projections from the World Bank Climate Change Knowledge Portal CMIP6
        0.25° collection — 30 bias-corrected, downscaled global climate models.
        Values shown are the ensemble median unless stated otherwise.{" "}
        <Link href="/methodology" className="underline hover:text-[var(--color-ink)]">
          Methodology
        </Link>
        .
      </footer>
    </div>
  );
}

function Section({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-9">
      <h2 className="text-[16px] font-semibold tracking-tight">{title}</h2>
      {subtitle && (
        <p className="mb-3.5 mt-1 max-w-2xl text-[12.5px] leading-relaxed text-[var(--color-ink-muted)]">
          {subtitle}
        </p>
      )}
      {!subtitle && <div className="mb-3.5" />}
      {children}
    </section>
  );
}

function SkeletonLines({ count }: { count: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: count }, (_, index) => (
        <div
          key={index}
          className="h-4 animate-pulse rounded bg-[var(--color-surface-hover)]"
          style={{ width: `${100 - index * 7}%` }}
        />
      ))}
    </div>
  );
}
