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
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <header className="mb-8 max-w-2xl">
        <div className="inline-flex items-center gap-1.5 rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-[12px] font-bold text-rose-800 mb-3 shadow-xs">
          <span>🔥</span>
          <span>Regional Climate Exposure & Vulnerability Ranking</span>
        </div>
        <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">Climate Hotspots — {config.name}</h1>
        <p className="mt-2 text-[14px] leading-relaxed text-slate-600 font-medium">
          Where the projected warming and extreme climate changes are most severe across {config.name}&rsquo;s{" "}
          {level1Label.toLowerCase()} and {level2Label.toLowerCase()}.
        </p>
      </header>

      <div className="mb-8 grid gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm lg:grid-cols-[220px_1fr_1fr]">
        <div>
          <div className="label mb-1.5 text-slate-500 font-bold">Pathway (SSP)</div>
          <ScenarioPicker value={scenario} onChange={setScenario} compact />
        </div>
        <div className="space-y-4">
          <div>
            <div className="label mb-1.5 text-slate-500 font-bold">Climate Indicator</div>
            <IndicatorPicker
              value={indicator}
              onChange={setIndicator}
              griddedOnly
            />
          </div>
          <div>
            <div className="label mb-1.5 text-slate-500 font-bold">Future Horizon</div>
            <PeriodPicker value={period} onChange={setPeriod} includeBaseline={false} />
          </div>
        </div>
        <div>
          <div className="label mb-1.5 text-slate-500 font-bold">Administrative Level</div>
          <div className="flex gap-1 rounded-lg border border-slate-200 bg-slate-100/70 p-1 shadow-inner">
            {[
              { value: 1, label: level1Label },
              { value: 2, label: level2Label },
            ].map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setLevel(option.value)}
                aria-pressed={level === option.value}
                className={`flex-1 rounded-md px-3 py-1.5 text-[12px] font-bold transition-all ${
                  level === option.value
                    ? "bg-white text-slate-900 shadow-xs ring-1 ring-slate-200"
                    : "text-slate-600 hover:text-slate-900 hover:bg-white/40"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
          {!GRIDDED_INDICATOR_IDS.includes(indicator) && (
            <p className="mt-2 text-[11px] leading-snug text-slate-500">
              Only locally rasterised indicators can be ranked by area.
            </p>
          )}
        </div>
      </div>

      {rankings.error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50/50 p-5 text-rose-800 text-[13px] font-medium">
          ⚠️ {rankings.error}
        </div>
      ) : rankings.loading ? (
        <div className="space-y-2">
          {Array.from({ length: 10 }, (_, index) => (
            <div
              key={index}
              className="h-10 animate-pulse rounded-xl bg-slate-200"
            />
          ))}
        </div>
      ) : rankings.data ? (
        <>
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs mb-6">
            <h2 className="mb-4 text-[16px] font-bold text-slate-900">
              Ranked Impact: Largest Increase in {rankings.data.indicator.label} by {PERIODS[period].shortLabel}
            </h2>

            <ol className="space-y-2">
              {worst.map((row, index) => (
                <li key={row.areaId} className="flex items-center gap-3 rounded-lg p-1.5 hover:bg-slate-50 transition-colors">
                  <span className={`tnum flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-extrabold ${
                    index < 3 ? "bg-rose-100 text-rose-800" : "bg-slate-100 text-slate-600"
                  }`}>
                    {index + 1}
                  </span>
                  <span className="w-[160px] shrink-0 truncate text-[13px] font-bold text-slate-900">
                    {row.name}
                  </span>
                  <span className="relative h-7 flex-1 overflow-hidden rounded-lg bg-slate-100">
                    <span
                      className="absolute inset-y-[2px] left-0 rounded-md transition-all duration-300"
                      style={{
                        width: `${(Math.abs(row.value) / max) * 100}%`,
                        background: SCENARIOS[scenario].color,
                        opacity: 0.75 + 0.25 * (Math.abs(row.value) / max),
                      }}
                    />
                  </span>
                  <span className="tnum w-[80px] shrink-0 text-right text-[13px] font-extrabold text-slate-900">
                    {formatValue(row.value, indicator, "anomaly")}
                  </span>
                </li>
              ))}
            </ol>
          </div>

          {rankings.data.opposite.length > 0 && (
            <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
              <h2 className="mb-3 text-[15px] font-bold text-slate-900">
                Mildest / Smallest Change Areas
              </h2>
              <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {rankings.data.opposite.map((row) => (
                  <li
                    key={row.areaId}
                    className="flex items-baseline justify-between gap-2 rounded-xl border border-slate-200 bg-slate-50/70 px-3.5 py-2.5"
                  >
                    <span className="truncate text-[13px] font-medium text-slate-800">{row.name}</span>
                    <span className="tnum shrink-0 text-[13px] font-bold text-slate-900">
                      {formatValue(row.value, indicator, "anomaly")}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <p className="mt-6 max-w-2xl rounded-xl border border-slate-200 bg-slate-50/80 p-4 text-[12px] leading-relaxed text-slate-600 font-medium">
            ℹ️ {rankings.data.note}
          </p>
        </>
      ) : null}
    </div>
  );
}
