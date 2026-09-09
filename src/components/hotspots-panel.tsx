"use client";

import Link from "next/link";
import { useState } from "react";

import { Field, IndicatorPicker, PeriodPicker, ScenarioPicker } from "@/components/controls";
import { PageHeader } from "@/components/ui/page-header";
import { SkeletonLoader } from "@/components/ui/states";
import { scenarioColorVar } from "@/lib/climate/scenario-style";
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
import { NextStepCard } from "@/components/nav/next-step-card";
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

  const level1Label = config.adminLevels.level1.split(" ")[0] ?? "Regions";
  const level2Label = config.adminLevels.level2.split(" ")[0] ?? "Districts";

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <PageHeader kicker={`Hotspots · ${config.name}`} step={3} title="Where is change most extreme?">
        Every {level1Label.toLowerCase()} and {level2Label.toLowerCase()} of{" "}
        {config.name}, ranked by the size of its projected change.
      </PageHeader>

      <div className="tier-flat mb-8 grid gap-4 p-5 lg:grid-cols-[220px_1fr_1fr]">
        <Field label="Pathway (SSP)">
          <ScenarioPicker value={scenario} onChange={setScenario} compact />
        </Field>
        <div className="space-y-4">
          <Field label="Climate indicator">
            <IndicatorPicker value={indicator} onChange={setIndicator} griddedOnly />
          </Field>
          <Field label="Future horizon">
            <PeriodPicker value={period} onChange={setPeriod} includeBaseline={false} />
          </Field>
        </div>
        <div>
          <div className="label mb-1.5">Administrative level</div>
          <div className="grid grid-cols-2 gap-1 rounded-(--radius-container) p-1 shadow-(--elevation-recessed)">
            {[
              { value: 1, label: level1Label },
              { value: 2, label: level2Label },
            ].map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setLevel(option.value)}
                aria-pressed={level === option.value}
                className={`rounded-(--radius-control) px-3 py-1.5 text-xs font-medium transition-all motion-state ${
 level === option.value
                    ? "bg-surface-raised text-ink shadow-(--elevation-raised)"
                    : "text-ink-faint hover:text-ink"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
          {!GRIDDED_INDICATOR_IDS.includes(indicator) && (
            <p className="mt-2 text-2xs leading-snug text-ink-faint">
              Only locally rasterised indicators can be ranked by area.
            </p>
          )}
        </div>
      </div>

      {rankings.error ? (
        <div className="tier-flat border-l-4 border-danger p-5 text-[13px] text-ink-muted">
          {rankings.error}
        </div>
      ) : rankings.loading ? (
        <div className="tier-flat p-5">
          <SkeletonLoader lines={10} />
        </div>
      ) : rankings.data ? (
        <>
          <div className="tier-raised mb-6 p-5">
            <h2 className="mb-1 text-base font-semibold tracking-tight text-ink">
              Largest increase in {rankings.data.indicator.label}
            </h2>
            <p className="mb-4 text-xs text-ink-faint" data-numeric>
              Ranked on the ensemble median · {SCENARIOS[scenario].label} · {PERIODS[period].shortLabel}
            </p>

            <ol className="space-y-1">
              {worst.map((row, index) => (
                <li key={row.areaId} className="flex items-center gap-3 rounded-(--radius-control) p-1.5 transition-colors hover:bg-surface-hover">
                  <span
                    className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-(--radius-pill) text-[11px] font-semibold tabular-nums ${
 index < 3 ? "bg-ink text-ink-inverse" : "bg-surface-recessed text-ink-faint"
                    }`}
                    data-numeric
                  >
                    {index + 1}
                  </span>
                  <span className="w-[150px] shrink-0 truncate text-[13px] font-medium text-ink">
                    {row.name}
                  </span>
                  <span className="relative h-6 flex-1 overflow-hidden rounded-(--radius-control) bg-surface-recessed shadow-(--elevation-recessed)">
                    <span
                      className="absolute inset-y-[3px] left-[3px] rounded-[3px] transition-all duration-300"
                      style={{
                        width: `calc(${(Math.abs(row.value) / max) * 100}% - 6px)`,
                        background: scenarioColorVar(scenario),
                        boxShadow: `0 4px 10px -4px ${scenarioColorVar(scenario)}`,
                      }}
                    />
                  </span>
                  <span className="w-[76px] shrink-0 text-right text-[13px] font-semibold text-ink tabular-nums" data-numeric>
                    {formatValue(row.value, indicator, "anomaly")}
                  </span>
                </li>
              ))}
            </ol>
          </div>

          {rankings.data.opposite.length > 0 && (
            <section className="tier-flat mt-6 p-5">
              <h2 className="mb-3 text-sm font-semibold tracking-tight text-ink">
                Smallest change
              </h2>
              <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {rankings.data.opposite.map((row) => (
                  <li
                    key={row.areaId}
                    className="flex items-baseline justify-between gap-2 rounded-(--radius-control) border border-border bg-surface-recessed px-3 py-2"
                  >
                    <span className="truncate text-xs font-medium text-ink-muted">{row.name}</span>
                    <span className="shrink-0 text-xs font-semibold text-ink tabular-nums" data-numeric>
                      {formatValue(row.value, indicator, "anomaly")}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <p className="mt-6 max-w-2xl rounded-(--radius-container) border border-border bg-surface-recessed p-4 text-xs leading-relaxed text-ink-muted">
            {rankings.data.note}
          </p>
        </>
      ) : null}

      <NextStepCard from="hotspots" state={{ indicator, scenario, period }} />
    </div>
  );
}
