"use client";

import Link from "next/link";
import { useState } from "react";

import { IndicatorPicker, PeriodPicker, ScenarioPicker } from "@/components/controls";
import {
  formatValue,
  GRIDDED_INDICATOR_IDS,
  PERIODS,
  SCENARIOS,
  type Indicator,
  type PeriodId,
  type ScenarioId,
} from "@/lib/climate/taxonomy";
import { useApi } from "@/lib/hooks";

interface Ranked {
  areaId: string;
  name: string;
  level: number;
  value: number;
  unit: string;
  agreement: number | null;
  centroid: { lat: number; lon: number };
}

interface RankingsResponse {
  indicator: Indicator;
  levelLabel: string;
  ranked: Ranked[];
  opposite: Ranked[];
  unit: string;
  note: string;
}

/**
 * Ranked change across administrative units.
 *
 * The map answers "what does the country look like"; this answers "where is
 * it worst", which is the question a planner actually arrives with. It is
 * served entirely from PostgreSQL — ordering 126 districts is an index scan
 * there and a full sweep of every gridded field anywhere else.
 */
import { useCountry } from "@/lib/country-context";

export function HotspotsPanel() {
  const { country, config } = useCountry();
  const [indicator, setIndicator] = useState("hd40");
  const [scenario, setScenario] = useState<ScenarioId>("ssp370");
  const [period, setPeriod] = useState<PeriodId>("2060-2079");
  const [level, setLevel] = useState(2);

  const rankings = useApi<RankingsResponse>(
    `/api/climate/rankings?indicator=${indicator}&scenario=${scenario}` +
      `&period=${period}&level=${level}&limit=20&country=${country}`,
  );

  const worst = rankings.data?.ranked ?? [];
  const max = worst.length ? Math.max(...worst.map((r) => Math.abs(r.value))) : 1;

  const level1Label = country === "UZB" ? "Regions" : "Provinces";
  const level2Label = country === "UZB" ? "Districts" : "Districts";

  return (
    <div className="mx-auto max-w-5xl px-5 py-9">
      <header className="mb-7 max-w-2xl">
        <h1 className="text-2xl font-semibold tracking-tight">Hotspots — {config.name}</h1>
        <p className="mt-2 text-[13.5px] leading-relaxed text-[var(--color-ink-muted)]">
          Where the projected change is largest, ranked across {config.name}&rsquo;s{" "}
          {level1Label.toLowerCase()} and {level2Label.toLowerCase()}. Every value is the ensemble median over the
          grid cells inside that unit.
        </p>
      </header>

      <div className="mb-8 grid gap-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 lg:grid-cols-[200px_1fr_1fr]">
        <div>
          <div className="label mb-1.5">Pathway</div>
          <ScenarioPicker value={scenario} onChange={setScenario} compact />
        </div>
        <div className="space-y-4">
          <div>
            <div className="label mb-1.5">Indicator</div>
            <IndicatorPicker
              value={indicator}
              onChange={setIndicator}
              griddedOnly
            />
          </div>
          <div>
            <div className="label mb-1.5">Horizon</div>
            <PeriodPicker value={period} onChange={setPeriod} includeBaseline={false} />
          </div>
        </div>
        <div>
          <div className="label mb-1.5">Level</div>
          <div className="flex gap-1 rounded-md border border-[var(--color-border)] bg-[var(--color-surface-raised)] p-0.5">
            {[
              { value: 1, label: level1Label },
              { value: 2, label: level2Label },
            ].map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setLevel(option.value)}
                aria-pressed={level === option.value}
                className={`flex-1 rounded px-2 py-1.5 text-[11.5px] transition-colors ${
                  level === option.value
                    ? "bg-[var(--color-brand-deep)] font-semibold text-white"
                    : "text-[var(--color-ink-muted)] hover:text-[var(--color-ink)]"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
          {!GRIDDED_INDICATOR_IDS.includes(indicator) && (
            <p className="mt-2 text-[11px] leading-snug text-[var(--color-ink-faint)]">
              Only locally rasterised indicators can be ranked by area.
            </p>
          )}
        </div>
      </div>

      {rankings.error ? (
        <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
          <p className="text-[13px] leading-relaxed text-[var(--color-ink-muted)]">
            {rankings.error}
          </p>
        </div>
      ) : rankings.loading ? (
        <div className="space-y-1.5">
          {Array.from({ length: 12 }, (_, index) => (
            <div
              key={index}
              className="h-8 animate-pulse rounded bg-[var(--color-surface-hover)]"
            />
          ))}
        </div>
      ) : rankings.data ? (
        <>
          <h2 className="mb-3 text-[15px] font-semibold">
            Largest increase in {rankings.data.indicator.label.toLowerCase()} by{" "}
            {PERIODS[period].shortLabel}
          </h2>

          <ol className="space-y-1">
            {worst.map((row, index) => (
              <li key={row.areaId} className="flex items-center gap-3">
                <span className="tnum w-6 shrink-0 text-right text-[11px] text-[var(--color-ink-faint)]">
                  {index + 1}
                </span>
                <span className="w-[140px] shrink-0 truncate text-[13px]">
                  {row.name}
                </span>
                <span className="relative h-6 flex-1 overflow-hidden rounded-sm bg-[var(--color-surface)]">
                  <span
                    className="absolute inset-y-[3px] left-0 rounded-sm transition-all duration-300"
                    style={{
                      width: `${(Math.abs(row.value) / max) * 100}%`,
                      background: SCENARIOS[scenario].color,
                      opacity: 0.55 + 0.45 * (Math.abs(row.value) / max),
                    }}
                  />
                </span>
                <span className="tnum w-[74px] shrink-0 text-right text-[12.5px] font-semibold">
                  {formatValue(row.value, indicator, "anomaly")}
                </span>
              </li>
            ))}
          </ol>

          {rankings.data.opposite.length > 0 && (
            <section className="mt-8">
              <h2 className="mb-3 text-[15px] font-semibold">
                Smallest change
              </h2>
              <ul className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
                {rankings.data.opposite.map((row) => (
                  <li
                    key={row.areaId}
                    className="flex items-baseline justify-between gap-2 rounded border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2"
                  >
                    <span className="truncate text-[12.5px]">{row.name}</span>
                    <span className="tnum shrink-0 text-[12.5px] font-semibold">
                      {formatValue(row.value, indicator, "anomaly")}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <p className="mt-6 max-w-2xl border-l-2 border-[var(--color-border-strong)] pl-3 text-[12px] leading-relaxed text-[var(--color-ink-muted)]">
            {rankings.data.note}
          </p>

          <p className="mt-4 text-[12.5px] text-[var(--color-ink-muted)]">
            Look at any of these on the{" "}
            <Link href="/" className="font-medium text-[var(--color-brand-deep)] underline">
              map
            </Link>
            , or read how these numbers are produced in the{" "}
            <Link href="/methodology" className="font-medium text-[var(--color-brand-deep)] underline">
              methodology
            </Link>
            .
          </p>
        </>
      ) : null}
    </div>
  );
}
