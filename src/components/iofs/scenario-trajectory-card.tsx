"use client";

import { useEffect, useId, useState } from "react";
import { ArrowDownRight, ArrowUpRight, Info, Minus } from "lucide-react";

import { AXIS_TEXT, tooltipStyle, useChartHover } from "@/components/charts/hover";
import { coherentDisplay } from "@/lib/climate/derive";
import { scenarioColorVar } from "@/lib/climate/scenario-style";
import {
  BASELINE_PERIOD,
  formatValue,
  PERIODS,
  SCENARIOS,
  type PeriodId,
  type ScenarioId,
} from "@/lib/climate/taxonomy";
import type { SeriesPoint } from "@/lib/iofs/climate";
import { T } from "./translation-context";

/**
 * The per-scenario metric card for the IOFS country panel — same visual
 * language as the shared `MetricCard` (seam, tone glow, big delta figure),
 * but with the two baseline/projected bars replaced by the country's real
 * 1950–2099 annual trace for that one pathway, so the headline number is
 * seen in the context of the curve it came from rather than as an isolated
 * pair of bars.
 *
 * Built as its own component rather than extending the shared `MetricCard`
 * — that component renders on every climate page on this platform, and a
 * chart this specific to the IOFS trajectory view has no reason to be an
 * option every caller has to know about.
 */
export function ScenarioTrajectoryCard({
  scenario,
  indicatorId,
  series,
  baseline,
  delta,
  period,
}: {
  scenario: ScenarioId;
  indicatorId: string;
  series: SeriesPoint[];
  baseline: number | null;
  delta: number | null;
  period: PeriodId;
}) {
  const meta = SCENARIOS[scenario];
  const color = scenarioColorVar(scenario);
  const [infoOpen, setInfoOpen] = useState(false);
  const infoId = useId();

  const shown = coherentDisplay(baseline, delta, indicatorId);
  const hasDelta = shown.delta !== null;
  const Arrow = !hasDelta || shown.delta === 0 ? Minus : shown.delta! > 0 ? ArrowUpRight : ArrowDownRight;

  const width = 240;
  const height = 92;
  const margin = { top: 8, right: 6, bottom: 16, left: 6 };
  const innerW = width - margin.left - margin.right;
  const innerH = height - margin.top - margin.bottom;

  const points = series.filter((p) => p.value !== null);
  const years = points.map((p) => p.year);
  const minYear = years[0] ?? 1950;
  const maxYear = years[years.length - 1] ?? 2099;
  const values = points.map((p) => p.value as number);
  const vMin = Math.min(...values, baseline ?? Infinity);
  const vMax = Math.max(...values, baseline ?? -Infinity);
  const pad = (vMax - vMin) * 0.12 || 1;
  const vLo = vMin - pad;
  const vHi = vMax + pad;

  const x = (year: number) =>
    margin.left + ((year - minYear) / (maxYear - minYear || 1)) * innerW;
  const y = (v: number) => margin.top + innerH - ((v - vLo) / (vHi - vLo || 1)) * innerH;

  const splitYear = 2015;
  const xSplit = x(splitYear);

  const pathFor = (filter: (year: number) => boolean) => {
    let d = "";
    let pen = false;
    for (const p of points) {
      if (!filter(p.year) || p.value === null) {
        pen = false;
        continue;
      }
      d += `${pen ? "L" : "M"}${x(p.year).toFixed(1)},${y(p.value).toFixed(1)}`;
      pen = true;
    }
    return d;
  };
  const historicalD = pathFor((year) => year <= splitYear);
  const futureD = pathFor((year) => year >= splitYear);

  const periodMeta = PERIODS[period];
  const bandX1 = x(PERIODS[period].startYear);
  const bandX2 = x(PERIODS[period].endYear);

  const { hover, containerRef, handlers } = useChartHover(points.length, (i) => x(points[i]?.year ?? minYear));
  const hoveredPoint = hover ? points[hover.index] : null;

  const [drawn, setDrawn] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setDrawn(true), 60);
    return () => clearTimeout(t);
  }, [scenario, indicatorId]);

  return (
    <div className="tier-raised-seam relative overflow-hidden p-5" style={{ ["--seam-color" as string]: color }}>
      <span
        aria-hidden
        className="pointer-events-none absolute -right-10 -top-12 h-40 w-40 rounded-(--radius-pill) opacity-25 blur-3xl"
        style={{ background: color }}
      />

      <div className="relative mb-1 flex items-center justify-between gap-2">
        <span className="label">{meta.label}</span>
        <button
          type="button"
          aria-label={infoOpen ? "Hide definition" : "Show definition"}
          aria-expanded={infoOpen}
          aria-controls={infoId}
          onClick={() => setInfoOpen((v) => !v)}
          className="rounded-(--radius-control) p-1 text-ink-faint transition-colors hover:bg-surface-hover hover:text-ink"
        >
          <Info className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="relative flex items-end gap-2.5">
        <span className="text-[2.75rem] font-semibold leading-[0.82] tracking-tight tabular-nums" data-numeric style={{ color }}>
          {hasDelta ? formatValue(shown.delta, indicatorId, "anomaly") : "—"}
        </span>
        <span
          className="mb-1 inline-flex h-6 w-6 items-center justify-center rounded-(--radius-pill)"
          style={{ background: `color-mix(in oklab, ${color} 16%, transparent)`, color }}
          aria-hidden
        >
          <Arrow className="h-3.5 w-3.5" />
        </span>
      </div>

      <div ref={containerRef} className="relative mt-3">
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full touch-none" role="img" aria-label={`${meta.label} trajectory, 1950 to 2099`} {...handlers}>
          {/* Selected-horizon band, so the headline number is visibly "this part of the curve" */}
          <rect x={bandX1} width={Math.max(1, bandX2 - bandX1)} y={margin.top} height={innerH} fill={color} opacity={0.1} />

          <line x1={xSplit} x2={xSplit} y1={margin.top} y2={margin.top + innerH} stroke="currentColor" strokeOpacity={0.15} strokeDasharray="2 2" />

          <path d={historicalD} fill="none" stroke="var(--ink-faint)" strokeWidth={1.4} strokeLinejoin="round" strokeLinecap="round" opacity={0.55} />
          <path
            d={futureD}
            fill="none"
            stroke={color}
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
            pathLength={1}
            style={{
              strokeDasharray: 1,
              strokeDashoffset: drawn ? 0 : 1,
              transition: "stroke-dashoffset 1000ms cubic-bezier(.22,.9,.3,1)",
            }}
          />

          {hover && hoveredPoint?.value != null && (
            <g pointerEvents="none">
              <line x1={hover.x} x2={hover.x} y1={margin.top} y2={margin.top + innerH} stroke="currentColor" strokeOpacity={0.3} />
              <circle cx={hover.x} cy={y(hoveredPoint.value)} r={6} fill={color} opacity={0.2} />
              <circle cx={hover.x} cy={y(hoveredPoint.value)} r={2.6} fill={color} stroke="var(--color-surface-raised)" strokeWidth={1.2} />
            </g>
          )}

          <text x={margin.left} y={height - 3} fontSize="8" fill={AXIS_TEXT}>1950</text>
          <text x={width - margin.right} y={height - 3} textAnchor="end" fontSize="8" fill={AXIS_TEXT}>2099</text>
        </svg>

        <div
          className="pointer-events-none absolute -top-1 z-10 w-28 rounded-(--radius-control) border border-border bg-surface-recessed px-2 py-1.5 text-center shadow-(--elevation-overlay) transition-[opacity,transform] duration-150"
          style={{
            ...tooltipStyle(hover?.clientX ?? 0, hover?.containerWidth ?? 1, 112),
            opacity: hover && hoveredPoint ? 1 : 0,
            transform: `translateY(${hover && hoveredPoint ? 0 : -4}px)`,
          }}
        >
          {hoveredPoint && (
            <>
              <div className="text-[10px] font-semibold tabular-nums">{hoveredPoint.year}</div>
              <div className="text-[11px] font-bold tabular-nums" style={{ color }}>
                {formatValue(hoveredPoint.value, indicatorId)}
              </div>
            </>
          )}
        </div>
      </div>

      <div className="relative mt-2 flex items-center justify-between text-2xs text-ink-faint">
        <span>
          <T>Change relative to</T> {PERIODS[BASELINE_PERIOD].shortLabel}{" "}
          <strong className="font-semibold text-ink">{formatValue(shown.baseline, indicatorId)}</strong>
        </span>
        <span>
          {periodMeta.shortLabel}{" "}
          <strong className="font-semibold text-ink">{formatValue(shown.projected, indicatorId)}</strong>
        </span>
      </div>

      {infoOpen && (
        <p id={infoId} className="relative mt-3 border-t border-border pt-2 text-xs leading-relaxed text-ink-muted">
          <T>{meta.summary}</T>
        </p>
      )}
    </div>
  );
}
