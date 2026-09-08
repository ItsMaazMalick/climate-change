"use client";

import { useState } from "react";

import {
  formatValue,
  PERIODS,
  SCENARIOS,
  type PeriodId,
  type ScenarioId,
} from "@/lib/climate/taxonomy";

// ---------------------------------------------------------------------------
// Scenario comparison
// ---------------------------------------------------------------------------

export interface ScenarioBar {
  scenario: ScenarioId;
  value: number | null;
  agreement?: number | null;
}

/**
 * A diverging bar chart across pathways.
 *
 * The zero line is drawn wherever zero falls in the domain rather than pinned
 * to the left edge, so a mixed-sign indicator reads correctly instead of
 * implying every scenario points the same way.
 */
export function ScenarioComparison({
  bars,
  indicatorId,
  height = 26,
}: {
  bars: ScenarioBar[];
  indicatorId: string;
  height?: number;
}) {
  const [active, setActive] = useState<ScenarioId | null>(null);
  const values = bars.map((b) => b.value).filter((v): v is number => v !== null);

  if (values.length === 0) {
    return <Empty>No projections available for this combination.</Empty>;
  }

  const max = Math.max(...values, 0);
  const min = Math.min(...values, 0);
  const span = max - min || 1;
  const zeroPct = ((0 - min) / span) * 100;

  return (
    <div className="space-y-1">
      {bars.map((bar) => {
        const scenario = SCENARIOS[bar.scenario];
        const value = bar.value;
        const widthPct = value === null ? 0 : (Math.abs(value) / span) * 100;
        const leftPct = value === null ? zeroPct : value >= 0 ? zeroPct : zeroPct - widthPct;
        const uncertain =
          bar.agreement !== null && bar.agreement !== undefined && bar.agreement < 0.5;
        const dimmed = active !== null && active !== bar.scenario;

        return (
          <div
            key={bar.scenario}
            className="flex items-center gap-2.5"
            onMouseEnter={() => setActive(bar.scenario)}
            onMouseLeave={() => setActive(null)}
          >
            <span
              className={`w-[68px] shrink-0 text-[11.5px] transition-colors ${
                active === bar.scenario
                  ? "font-semibold text-[var(--color-ink)]"
                  : "text-[var(--color-ink-muted)]"
              }`}
              title={scenario.summary}
            >
              {scenario.label}
            </span>

            <div
              className="relative flex-1 rounded-lg bg-slate-100 border border-slate-200 overflow-hidden"
              style={{ height }}
            >
              <div
                className="absolute inset-y-0 w-px bg-slate-300"
                style={{ left: `${zeroPct}%` }}
                aria-hidden
              />
              {value !== null && (
                <div
                  className="absolute inset-y-[2px] rounded-md transition-all duration-200"
                  style={{
                    left: `${leftPct}%`,
                    width: `${Math.max(widthPct, 0.6)}%`,
                    background: scenario.color,
                    opacity: dimmed ? 0.25 : uncertain ? 0.6 : 0.95,
                    backgroundImage: uncertain
                      ? "repeating-linear-gradient(45deg, rgba(255,255,255,0.55) 0 2px, transparent 2px 5px)"
                      : undefined,
                  }}
                  title={
                    uncertain
                      ? "Models disagree on the sign of this change"
                      : `${scenario.label}: ${formatValue(value, indicatorId, "anomaly")}`
                  }
                />
              )}
            </div>

            <span
              className={`tnum w-[68px] shrink-0 text-right text-[12px] font-mono transition-colors ${
                active === bar.scenario ? "font-black text-slate-900" : "font-bold text-slate-700"
              }`}
            >
              {formatValue(value, indicatorId, "anomaly")}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Model spread
// ---------------------------------------------------------------------------

/**
 * The p10–p90 envelope with the median marked, and — when supplied — every
 * individual model as a tick along the same axis.
 *
 * Showing the members matters: a reader who sees only a band reads it as an
 * error bar around a true value. Thirty ticks make it obvious that the band
 * summarises thirty distinct, self-consistent simulations.
 */
export function ModelSpread({
  median,
  p10,
  p90,
  members,
  indicatorId,
  color = "#3c8c1e",
}: {
  median: number | null;
  p10: number | null;
  p90: number | null;
  members?: Array<{ label: string; value: number | null }>;
  indicatorId: string;
  color?: string;
}) {
  const [active, setActive] = useState<{ label: string; value: number } | null>(null);

  const points = [median, p10, p90, ...(members?.map((m) => m.value) ?? [])].filter(
    (v): v is number => v !== null && Number.isFinite(v),
  );

  if (points.length === 0 || median === null) {
    return <Empty>Model spread is not published for this combination.</Empty>;
  }

  const rawMin = Math.min(...points, 0);
  const rawMax = Math.max(...points, 0);
  const pad = (rawMax - rawMin) * 0.12 || 0.5;
  const lo = rawMin - pad;
  const hi = rawMax + pad;
  const pct = (value: number) => ((value - lo) / (hi - lo)) * 100;

  return (
    <div className="relative">
      <div className="relative h-14">
        {lo < 0 && hi > 0 && (
          <div
            className="absolute inset-y-0 w-px bg-[var(--color-border-strong)]"
            style={{ left: `${pct(0)}%` }}
          >
            <span className="absolute -bottom-0.5 left-1 text-[9px] text-[var(--color-ink-faint)]">
              0
            </span>
          </div>
        )}

        {p10 !== null && p90 !== null && (
          <div
            className="absolute top-3 h-6 rounded-sm"
            style={{
              left: `${pct(p10)}%`,
              width: `${Math.max(pct(p90) - pct(p10), 0.5)}%`,
              background: `${color}26`,
              border: `1px solid ${color}59`,
            }}
          />
        )}

        {members?.map((member, index) =>
          member.value === null ? null : (
            <button
              key={`${member.label}-${index}`}
              type="button"
              aria-label={`${member.label}: ${formatValue(member.value, indicatorId, "anomaly")}`}
              onMouseEnter={() => setActive({ label: member.label, value: member.value! })}
              onMouseLeave={() => setActive(null)}
              onFocus={() => setActive({ label: member.label, value: member.value! })}
              onBlur={() => setActive(null)}
              className="absolute top-[32px] h-4 w-[7px] -translate-x-1/2 cursor-pointer bg-transparent"
              style={{ left: `${pct(member.value)}%` }}
            >
              <span
                className="block h-3.5 w-px transition-all"
                style={{
                  background: color,
                  opacity: active?.label === member.label ? 1 : 0.6,
                  width: active?.label === member.label ? 2 : 1,
                  marginInline: "auto",
                }}
              />
            </button>
          ),
        )}

        <div
          className="absolute top-1.5 h-9 w-[2.5px] rounded-full"
          style={{ left: `${pct(median)}%`, background: color }}
        />
        <div
          className="tnum absolute -top-0.5 -translate-x-1/2 whitespace-nowrap text-[11px] font-semibold"
          style={{ left: `${pct(median)}%`, color }}
        >
          {formatValue(median, indicatorId, "anomaly")}
        </div>

        {active && (
          <div
            className="pointer-events-none absolute -bottom-1 z-10 -translate-x-1/2 whitespace-nowrap rounded border border-[var(--color-border)] bg-[var(--color-surface-raised)] px-1.5 py-0.5 text-[10.5px] shadow-sm"
            style={{ left: `${Math.min(Math.max(pct(active.value), 12), 88)}%` }}
          >
            <span className="font-semibold">{active.label}</span>{" "}
            <span className="tnum">{formatValue(active.value, indicatorId, "anomaly")}</span>
          </div>
        )}
      </div>

      <div className="tnum flex justify-between text-[10px] text-[var(--color-ink-faint)]">
        <span>{p10 !== null ? `10th ${formatValue(p10, indicatorId, "anomaly")}` : ""}</span>
        <span>{p90 !== null ? `90th ${formatValue(p90, indicatorId, "anomaly")}` : ""}</span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Scenario × period matrix
// ---------------------------------------------------------------------------

/**
 * Every pathway against every horizon at once.
 *
 * This is the view that makes the central point of scenario analysis visible
 * in one glance: the columns are nearly identical in the 2020s and diverge
 * enormously by the 2090s.
 */
export function ScenarioMatrix({
  rows,
  indicatorId,
}: {
  rows: Array<{ scenario: ScenarioId; byPeriod: Record<string, number | null> }>;
  indicatorId: string;
}) {
  const [active, setActive] = useState<string | null>(null);
  const periods = ["2020-2039", "2040-2059", "2060-2079", "2080-2099"] as PeriodId[];
  const values = rows.flatMap((row) =>
    periods
      .map((p) => row.byPeriod[p])
      .filter((v): v is number => v !== null && v !== undefined),
  );
  const max = values.length ? Math.max(...values.map(Math.abs)) : 1;

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[430px] border-separate border-spacing-0.5">
        <thead>
          <tr>
            <th className="label pb-1.5 text-left font-semibold">Pathway</th>
            {periods.map((id) => (
              <th key={id} className="label pb-1.5 text-center font-semibold">
                {PERIODS[id].shortLabel}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const scenario = SCENARIOS[row.scenario];
            return (
              <tr key={row.scenario}>
                <th className="py-1 pr-3 text-left text-[12px] font-medium text-[var(--color-ink-muted)]">
                  <span className="flex items-center gap-1.5">
                    <span
                      className="inline-block h-2 w-2 rounded-full"
                      style={{ background: scenario.color }}
                    />
                    {scenario.label}
                  </span>
                </th>
                {periods.map((period) => {
                  const value = row.byPeriod[period] ?? null;
                  const intensity = value === null ? 0 : Math.abs(value) / max;
                  const key = `${row.scenario}:${period}`;
                  return (
                    <td key={period} className="p-0">
                      <div
                        onMouseEnter={() => setActive(key)}
                        onMouseLeave={() => setActive(null)}
                        title={`${scenario.label}, ${PERIODS[period].shortLabel}: ${formatValue(value, indicatorId, "anomaly")}`}
                        className="tnum flex h-9 cursor-default items-center justify-center rounded text-[12px] font-semibold transition-transform"
                        style={{
                          background:
                            value === null
                              ? "var(--color-surface)"
                              : `color-mix(in srgb, ${scenario.color} ${Math.round(intensity * 62)}%, var(--color-surface))`,
                          color: intensity > 0.6 ? "#ffffff" : "var(--color-ink)",
                          outline:
                            active === key ? `2px solid ${scenario.color}` : "none",
                          outlineOffset: "-1px",
                        }}
                      >
                        {formatValue(value, indicatorId, "anomaly")}
                      </div>
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-md border border-dashed border-[var(--color-border)] px-3 py-4 text-center text-[12px] text-[var(--color-ink-faint)]">
      {children}
    </p>
  );
}
