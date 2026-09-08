"use client";

import { useCallback, useMemo } from "react";

import { formatValue, MONTH_LABELS } from "@/lib/climate/taxonomy";

import { AXIS, AXIS_TEXT, niceTicks, tooltipStyle, useChartHover } from "./hover";

export interface CycleMonth {
  month: number;
  label: string;
  baseline: number | null;
  projected: number | null;
}

/**
 * The shape of the year, baseline against projection.
 *
 * Two lines rather than paired bars. Bars compare one month to its own
 * counterpart well, but they hide the thing that actually matters here: the
 * *shape* of the annual curve, and whether the projection changes that shape
 * or simply lifts it. In a monsoon climate that distinction is the finding —
 * Pakistan's rainfall can hold its annual total while the peak sharpens, and
 * only a line makes that visible at a glance.
 *
 * The band between the lines is filled, so the size and sign of the change
 * reads as area without the reader having to subtract two heights by eye.
 */
export function SeasonalCycle({
  months,
  unit,
  indicatorId,
  color,
  height = 190,
  monsoonBand = true,
}: {
  months: CycleMonth[];
  unit: string;
  indicatorId: string;
  color: string;
  height?: number;
  /** Shade July–September, the months that carry most of Pakistan's rain. */
  monsoonBand?: boolean;
}) {
  const width = 520;
  const margin = { top: 14, right: 12, bottom: 34, left: 42 };
  const innerW = width - margin.left - margin.right;
  const innerH = height - margin.top - margin.bottom;

  const geometry = useMemo(() => {
    const values = months.flatMap((m) =>
      [m.baseline, m.projected].filter((v): v is number => v !== null),
    );
    if (values.length === 0) return null;
    const min = Math.min(...values);
    const max = Math.max(...values);
    const pad = (max - min) * 0.12 || 1;
    return { min: min - pad, max: max + pad };
  }, [months]);

  const x = useCallback(
    (index: number) =>
      margin.left + (months.length > 1 ? (index / (months.length - 1)) * innerW : innerW / 2),
    [months.length, innerW, margin.left],
  );

  const { hover, containerRef, handlers } = useChartHover(months.length, x);

  if (!geometry) {
    return (
      <p className="rounded-md border border-dashed border-[var(--color-border)] px-3 py-4 text-center text-[12px] text-[var(--color-ink-faint)]">
        No monthly climatology available for this indicator.
      </p>
    );
  }

  const y = (value: number) =>
    margin.top + innerH - ((value - geometry.min) / (geometry.max - geometry.min)) * innerH;

  const path = (key: "baseline" | "projected") => {
    let d = "";
    let pen = false;
    months.forEach((month, index) => {
      const value = month[key];
      if (value === null) {
        pen = false;
        return;
      }
      d += `${pen ? "L" : "M"}${x(index).toFixed(1)},${y(value).toFixed(1)}`;
      pen = true;
    });
    return d;
  };

  // The band between the two curves, closed by walking the baseline back.
  const band = (() => {
    const complete = months.filter(
      (m) => m.baseline !== null && m.projected !== null,
    );
    if (complete.length < 2) return "";
    const forward = complete
      .map((m) => `${x(months.indexOf(m)).toFixed(1)},${y(m.projected!).toFixed(1)}`)
      .join("L");
    const back = [...complete]
      .reverse()
      .map((m) => `${x(months.indexOf(m)).toFixed(1)},${y(m.baseline!).toFixed(1)}`)
      .join("L");
    return `M${forward}L${back}Z`;
  })();

  const ticks = niceTicks(geometry.min, geometry.max, 4);
  const active = hover ? months[hover.index] : null;
  const delta =
    active && active.baseline !== null && active.projected !== null
      ? active.projected - active.baseline
      : null;

  return (
    <div ref={containerRef} className="relative">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full touch-none"
        role="img"
        aria-label={`Monthly climatology, 1995–2014 baseline compared with the projection, in ${unit}`}
        {...handlers}
      >
        {monsoonBand && (
          <g>
            <rect
              x={x(6)}
              y={margin.top}
              width={x(8) - x(6)}
              height={innerH}
              fill="currentColor"
              opacity={0.045}
            />
            <text
              x={(x(6) + x(8)) / 2}
              y={margin.top + 9}
              textAnchor="middle"
              fontSize="9"
              fill={AXIS_TEXT}
            >
              monsoon
            </text>
          </g>
        )}

        {ticks.map((tick) => (
          <g key={tick}>
            <line
              x1={margin.left}
              x2={width - margin.right}
              y1={y(tick)}
              y2={y(tick)}
              stroke={AXIS}
            />
            <text
              x={margin.left - 6}
              y={y(tick) + 3.5}
              textAnchor="end"
              fontSize="10"
              fill={AXIS_TEXT}
              className="tnum"
            >
              {tick.toFixed(Math.abs(tick) < 10 && tick % 1 !== 0 ? 1 : 0)}
            </text>
          </g>
        ))}

        {band && <path d={band} fill={color} opacity={0.14} />}

        <path
          d={path("baseline")}
          fill="none"
          stroke={AXIS_TEXT}
          strokeWidth={1.6}
          strokeDasharray="4 3"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        <path
          d={path("projected")}
          fill="none"
          stroke={color}
          strokeWidth={2.2}
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {/* month labels */}
        {months.map((month, index) => (
          <text
            key={month.month}
            x={x(index)}
            y={height - 12}
            textAnchor="middle"
            fontSize="9.5"
            fill={hover?.index === index ? "var(--color-ink)" : AXIS_TEXT}
            fontWeight={hover?.index === index ? 600 : 400}
          >
            {MONTH_LABELS[index] ?? month.label}
          </text>
        ))}

        {hover && active && (
          <g pointerEvents="none">
            <line
              x1={hover.x}
              x2={hover.x}
              y1={margin.top}
              y2={margin.top + innerH}
              stroke="currentColor"
              strokeOpacity={0.3}
              strokeWidth={1}
            />
            {active.baseline !== null && (
              <circle
                cx={hover.x}
                cy={y(active.baseline)}
                r={3.5}
                fill="var(--color-surface-raised)"
                stroke={AXIS_TEXT}
                strokeWidth={1.6}
              />
            )}
            {active.projected !== null && (
              <circle
                cx={hover.x}
                cy={y(active.projected)}
                r={4}
                fill={color}
                stroke="var(--color-surface-raised)"
                strokeWidth={1.6}
              />
            )}
          </g>
        )}

        <text
          x={margin.left - 6}
          y={margin.top - 4}
          textAnchor="end"
          fontSize="9.5"
          fill={AXIS_TEXT}
        >
          {unit}
        </text>
      </svg>

      {hover && active && (
        <div
          className="pointer-events-none absolute top-1 z-10 w-[152px] rounded-md border border-[var(--color-border)] bg-[var(--color-surface-raised)] px-2.5 py-2 shadow-sm"
          style={tooltipStyle(hover.clientX, hover.containerWidth, 152)}
        >
          <div className="text-[11px] font-semibold">
            {FULL_MONTHS[active.month - 1] ?? active.label}
          </div>
          <dl className="mt-1 space-y-0.5 text-[11px]">
            <div className="flex items-baseline justify-between gap-2">
              <dt className="text-[var(--color-ink-faint)]">1995–2014</dt>
              <dd className="tnum">{formatValue(active.baseline, indicatorId)}</dd>
            </div>
            <div className="flex items-baseline justify-between gap-2">
              <dt className="text-[var(--color-ink-faint)]">projected</dt>
              <dd className="tnum font-semibold" style={{ color }}>
                {formatValue(active.projected, indicatorId)}
              </dd>
            </div>
            {delta !== null && (
              <div className="flex items-baseline justify-between gap-2 border-t border-[var(--color-border)] pt-0.5">
                <dt className="text-[var(--color-ink-faint)]">change</dt>
                <dd className="tnum font-semibold">
                  {formatValue(delta, indicatorId, "anomaly")}
                </dd>
              </div>
            )}
          </dl>
        </div>
      )}

      <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[10.5px] text-[var(--color-ink-faint)]">
        <span className="flex items-center gap-1.5">
          <svg width="16" height="6" aria-hidden>
            <line x1="0" y1="3" x2="16" y2="3" stroke={AXIS_TEXT} strokeWidth="1.6" strokeDasharray="4 3" />
          </svg>
          1995–2014
        </span>
        <span className="flex items-center gap-1.5">
          <svg width="16" height="6" aria-hidden>
            <line x1="0" y1="3" x2="16" y2="3" stroke={color} strokeWidth="2.2" />
          </svg>
          projected
        </span>
        <span className="ml-auto">Hover for monthly values</span>
      </div>
    </div>
  );
}

const FULL_MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
] as const;
