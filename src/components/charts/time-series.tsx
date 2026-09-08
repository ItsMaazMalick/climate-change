"use client";

import { useCallback, useMemo, useState } from "react";

import { formatValue, type ScenarioId } from "@/lib/climate/taxonomy";

import { AXIS, AXIS_TEXT, niceTicks, tooltipStyle, useChartHover } from "./hover";

export interface SeriesLine {
  id: string;
  label: string;
  color: string;
  points: Array<{ year: number; value: number | null }>;
}

/**
 * Multi-scenario trajectory, 1950–2100.
 *
 * The pathways share a past and differ only in the future, so the chart is
 * drawn to make that structure unavoidable: one common line before 2015, a
 * fan after it, and a marked handover.
 *
 * Hovering reads every scenario at the same year at once. That is the whole
 * point of the chart — the vertical distance between the lines at a chosen
 * year *is* the finding — and asking a reader to trace five curves back to an
 * axis by eye throws that away.
 */
export function TimeSeriesChart({
  lines,
  unit,
  height = 300,
  splitYear = 2015,
  yLabel,
  indicatorId = "tas",
}: {
  lines: SeriesLine[];
  unit: string;
  height?: number;
  splitYear?: number;
  yLabel?: string;
  indicatorId?: string;
}) {
  const width = 760;
  const margin = { top: 14, right: 14, bottom: 26, left: 46 };
  const innerW = width - margin.left - margin.right;
  const innerH = height - margin.top - margin.bottom;

  const [focused, setFocused] = useState<string | null>(null);

  /** Every year present in any series, ascending — the hover's index space. */
  const years = useMemo(() => {
    const set = new Set<number>();
    for (const line of lines) for (const point of line.points) set.add(point.year);
    return [...set].sort((a, b) => a - b);
  }, [lines]);

  const geometry = useMemo(() => {
    const values = lines.flatMap((line) =>
      line.points.map((p) => p.value).filter((v): v is number => v !== null),
    );
    if (values.length === 0 || years.length === 0) return null;
    const min = Math.min(...values);
    const max = Math.max(...values);
    const pad = (max - min) * 0.08 || 0.5;
    return {
      minYear: years[0]!,
      maxYear: years[years.length - 1]!,
      min: min - pad,
      max: max + pad,
    };
  }, [lines, years]);

  const x = useCallback(
    (index: number) => {
      if (!geometry || years.length === 0) return margin.left;
      const year = years[Math.min(Math.max(index, 0), years.length - 1)]!;
      const span = geometry.maxYear - geometry.minYear || 1;
      return margin.left + ((year - geometry.minYear) / span) * innerW;
    },
    [geometry, years, innerW, margin.left],
  );

  const { hover, containerRef, handlers } = useChartHover(years.length, x);

  if (!geometry) {
    return (
      <p className="rounded-md border border-dashed border-[var(--color-border)] px-3 py-4 text-center text-[12px] text-[var(--color-ink-faint)]">
        No time series available.
      </p>
    );
  }

  const xYear = (year: number) =>
    margin.left +
    ((year - geometry.minYear) / (geometry.maxYear - geometry.minYear || 1)) * innerW;
  const y = (value: number) =>
    margin.top + innerH - ((value - geometry.min) / (geometry.max - geometry.min)) * innerH;

  const buildPath = (points: SeriesLine["points"]) => {
    let d = "";
    let pen = false;
    for (const point of points) {
      if (point.value === null) {
        pen = false;
        continue;
      }
      d += `${pen ? "L" : "M"}${xYear(point.year).toFixed(1)},${y(point.value).toFixed(1)}`;
      pen = true;
    }
    return d;
  };

  const yTicks = niceTicks(geometry.min, geometry.max, 5);
  const xTicks = [1950, 1975, 2000, 2025, 2050, 2075, 2100].filter(
    (year) => year >= geometry.minYear && year <= geometry.maxYear,
  );

  const hoveredYear = hover ? years[hover.index] : null;
  const readings = hoveredYear
    ? lines
        .map((line) => ({
          line,
          value: line.points.find((p) => p.year === hoveredYear)?.value ?? null,
        }))
        .filter((r) => r.value !== null)
        .sort((a, b) => (b.value ?? 0) - (a.value ?? 0))
    : [];

  return (
    <div ref={containerRef} className="relative">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full touch-none"
        role="img"
        aria-label={`Trajectory of ${yLabel ?? "the selected indicator"} from ${geometry.minYear} to ${geometry.maxYear} under each emissions pathway`}
        {...handlers}
      >
        {yTicks.map((tick) => (
          <g key={tick}>
            <line x1={margin.left} x2={width - margin.right} y1={y(tick)} y2={y(tick)} stroke={AXIS} />
            <text
              x={margin.left - 6}
              y={y(tick) + 3.5}
              textAnchor="end"
              fontSize="10"
              fill={AXIS_TEXT}
              className="tnum"
            >
              {tick.toFixed(tick % 1 === 0 ? 0 : 1)}
            </text>
          </g>
        ))}

        {xTicks.map((year) => (
          <text
            key={year}
            x={xYear(year)}
            y={height - 8}
            textAnchor="middle"
            fontSize="10"
            fill={AXIS_TEXT}
            className="tnum"
          >
            {year}
          </text>
        ))}

        {splitYear > geometry.minYear && splitYear < geometry.maxYear && (
          <g>
            <rect
              x={margin.left}
              y={margin.top}
              width={xYear(splitYear) - margin.left}
              height={innerH}
              fill="currentColor"
              opacity={0.035}
            />
            <line
              x1={xYear(splitYear)}
              x2={xYear(splitYear)}
              y1={margin.top}
              y2={margin.top + innerH}
              stroke="currentColor"
              strokeOpacity={0.35}
              strokeDasharray="3 3"
            />
            <text x={xYear(splitYear) + 5} y={margin.top + 10} fontSize="9.5" fill={AXIS_TEXT}>
              projections begin
            </text>
            <text x={xYear(splitYear) - 5} y={margin.top + 10} fontSize="9.5" fill={AXIS_TEXT} textAnchor="end">
              observed forcing
            </text>
          </g>
        )}

        {lines.map((line) => {
          const dimmed = focused !== null && focused !== line.id;
          return (
            <path
              key={line.id}
              d={buildPath(line.points)}
              fill="none"
              stroke={line.color}
              strokeWidth={focused === line.id ? 2.6 : 1.9}
              strokeLinejoin="round"
              strokeLinecap="round"
              opacity={dimmed ? 0.22 : 0.95}
              style={{ transition: "opacity 120ms, stroke-width 120ms" }}
            />
          );
        })}

        {hover && hoveredYear !== null && (
          <g pointerEvents="none">
            <line
              x1={hover.x}
              x2={hover.x}
              y1={margin.top}
              y2={margin.top + innerH}
              stroke="currentColor"
              strokeOpacity={0.35}
              strokeWidth={1}
            />
            {readings.map(({ line, value }) => (
              <circle
                key={line.id}
                cx={hover.x}
                cy={y(value!)}
                r={3.6}
                fill={line.color}
                stroke="var(--color-surface-raised)"
                strokeWidth={1.5}
              />
            ))}
            <text
              x={hover.x}
              y={height - 8}
              textAnchor="middle"
              fontSize="10"
              fontWeight={700}
              fill="var(--color-ink)"
              className="tnum"
            >
              {hoveredYear}
            </text>
          </g>
        )}

        <text x={margin.left - 6} y={margin.top - 3} textAnchor="end" fontSize="9.5" fill={AXIS_TEXT}>
          {unit}
        </text>
      </svg>

      {hover && readings.length > 0 && (
        <div
          className="pointer-events-none absolute top-1 z-10 w-[168px] rounded-md border border-[var(--color-border)] bg-[var(--color-surface-raised)] px-2.5 py-2 shadow-sm"
          style={tooltipStyle(hover.clientX, hover.containerWidth, 168)}
        >
          <div className="tnum text-[11px] font-semibold">{hoveredYear}</div>
          <dl className="mt-1 space-y-0.5 text-[11px]">
            {readings.map(({ line, value }) => (
              <div key={line.id} className="flex items-baseline justify-between gap-2">
                <dt className="flex items-center gap-1.5 text-[var(--color-ink-muted)]">
                  <span
                    className="inline-block h-[3px] w-3 rounded-full"
                    style={{ background: line.color }}
                  />
                  {line.label}
                </dt>
                <dd className="tnum font-semibold">{formatValue(value, indicatorId)}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}

      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
        {lines.map((line) => (
          <button
            key={line.id}
            type="button"
            onMouseEnter={() => setFocused(line.id)}
            onMouseLeave={() => setFocused(null)}
            onFocus={() => setFocused(line.id)}
            onBlur={() => setFocused(null)}
            onClick={() => setFocused((current) => (current === line.id ? null : line.id))}
            aria-pressed={focused === line.id}
            className={`flex items-center gap-1.5 rounded px-1.5 py-0.5 text-[11.5px] transition-colors ${
              focused === line.id
                ? "bg-[var(--color-surface-hover)] font-semibold text-[var(--color-ink)]"
                : "text-[var(--color-ink-muted)] hover:text-[var(--color-ink)]"
            }`}
          >
            <span
              className="inline-block h-0.5 w-4 rounded"
              style={{ background: line.color }}
            />
            {line.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export type { ScenarioId };
