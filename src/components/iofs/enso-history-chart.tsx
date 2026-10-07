"use client";

import { useEffect, useMemo, useState } from "react";

import { AXIS, AXIS_TEXT, niceTicks, tooltipStyle, useChartHover } from "@/components/charts/hover";
import type { EnsoPoint } from "@/lib/iofs/enso";
import { InfoButton } from "./info-dialog";
import { T } from "./translation-context";

type Range = "5y" | "20y" | "all";

const RANGE_LABEL: Record<Range, string> = { "5y": "5 Years", "20y": "20 Years", all: "Full Record" };

const RONI_COLOR = "#f4922a";
const NINO34_COLOR = "#7fb547";
const WARM = "#d6604d";
const COOL = "#4393c3";

/**
 * The real RONI and Niño 3.4 SST-anomaly series, drawn together so their
 * agreement (or divergence) is visible, with the ±0.5 °C El Niño / La Niña
 * thresholds marked and a callout for the current reading.
 *
 * A dedicated chart rather than the shared `TimeSeriesChart`: that component
 * labels its x-axis and hover readout by numeric year, which is right for
 * annual climate trajectories but wrong here — ENSO data is monthly/seasonal,
 * so a bare year number reads as "1962.333", not a date.
 */
export function EnsoHistoryChart({
  history,
  current,
}: {
  history: EnsoPoint[];
  current: EnsoPoint | null;
}) {
  const [range, setRange] = useState<Range>("all");

  const points = useMemo(() => {
    const filtered = history.filter((p) => p.roni !== null || p.nino34 !== null);
    if (range === "all") return filtered;
    const months = range === "5y" ? 60 : 240;
    return filtered.slice(-months);
  }, [history, range]);

  const width = 760;
  const height = 280;
  const margin = { top: 16, right: 14, bottom: 26, left: 40 };
  const innerW = width - margin.left - margin.right;
  const innerH = height - margin.top - margin.bottom;

  const geometry = useMemo(() => {
    const values = points.flatMap((p) => [p.roni, p.nino34]).filter((v): v is number => v !== null);
    if (values.length === 0) return null;
    const min = Math.min(...values, -0.5);
    const max = Math.max(...values, 0.5);
    const pad = (max - min) * 0.08 || 0.5;
    return { min: min - pad, max: max + pad };
  }, [points]);

  const x = (index: number) =>
    points.length <= 1 ? margin.left : margin.left + (index / (points.length - 1)) * innerW;
  const y = (value: number) =>
    geometry
      ? margin.top + innerH - ((value - geometry.min) / (geometry.max - geometry.min)) * innerH
      : margin.top;

  const { hover, containerRef, handlers } = useChartHover(points.length, x);

  if (!geometry || points.length === 0) {
    return (
      <p className="rounded-(--radius-control) border border-dashed border-border px-3 py-4 text-center text-[12px] text-ink-faint">
        <T>No ENSO history available.</T>
      </p>
    );
  }

  const buildPath = (key: "roni" | "nino34") => {
    let d = "";
    let pen = false;
    points.forEach((p, i) => {
      const v = p[key];
      if (v === null) {
        pen = false;
        return;
      }
      d += `${pen ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`;
      pen = true;
    });
    return d;
  };

  /** Area under the RONI line down to the zero baseline, for the gradient fill. */
  const buildArea = () => {
    const zero = y(0);
    let d = "";
    let pen = false;
    let lastX = margin.left;
    points.forEach((p, i) => {
      const v = p.roni;
      if (v === null) {
        pen = false;
        return;
      }
      if (!pen) d += `M${x(i).toFixed(1)},${zero.toFixed(1)}L`;
      d += `${pen ? "L" : ""}${x(i).toFixed(1)},${y(v).toFixed(1)}`;
      lastX = x(i);
      pen = true;
    });
    if (pen) d += `L${lastX.toFixed(1)},${zero.toFixed(1)}Z`;
    return d;
  };

  const yTicks = niceTicks(geometry.min, geometry.max, 5);
  // Label roughly every ~10% of the width, snapped to January of a year.
  const labelEvery = Math.max(1, Math.round(points.length / 7));
  const xTicks = points
    .map((p, i) => ({ p, i }))
    .filter(({ i }) => i % labelEvery === 0);

  const hovered = hover ? points[hover.index] : null;
  const gradId = "roni-area-gradient";

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-4 text-xs font-medium">
          <Legend color={RONI_COLOR} label="RONI (relative ENSO index)" infoId="roni" />
          <Legend color={NINO34_COLOR} label="Niño 3.4 SST anomaly" infoId="nino34-sst" />
        </div>
        <div className="flex gap-1 rounded-(--radius-pill) border border-border bg-surface-recessed p-0.5">
          {(["5y", "20y", "all"] as Range[]).map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setRange(r)}
              className={`rounded-(--radius-pill) px-2.5 py-1 text-2xs font-semibold transition-all duration-150 active:scale-95 ${
                range === r
                  ? "bg-surface-panel text-ink shadow-(--elevation-flat)"
                  : "text-ink-faint hover:bg-surface-hover hover:text-ink"
              }`}
            >
              <T>{RANGE_LABEL[r]}</T>
            </button>
          ))}
        </div>
      </div>

      <div ref={containerRef} className="relative">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full touch-none"
          role="img"
          aria-label="RONI and Niño 3.4 SST anomaly over time"
          {...handlers}
        >
          <defs>
            <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor={WARM} stopOpacity={0.32} />
              <stop offset={`${(y(0) / height).toFixed(3)}`} stopColor={WARM} stopOpacity={0.04} />
              <stop offset={`${(y(0) / height).toFixed(3)}`} stopColor={COOL} stopOpacity={0.04} />
              <stop offset="1" stopColor={COOL} stopOpacity={0.3} />
            </linearGradient>
          </defs>

          {yTicks.map((tick) => (
            <g key={tick}>
              <line x1={margin.left} x2={width - margin.right} y1={y(tick)} y2={y(tick)} stroke={AXIS} />
              <text x={margin.left - 6} y={y(tick) + 3.5} textAnchor="end" fontSize="10" fill={AXIS_TEXT} className="tnum">
                {tick > 0 ? `+${tick}` : tick}
              </text>
            </g>
          ))}

          {/* El Niño / La Niña threshold lines */}
          {[0.5, -0.5].map((t) => (
            <line
              key={t}
              x1={margin.left}
              x2={width - margin.right}
              y1={y(t)}
              y2={y(t)}
              stroke={t > 0 ? WARM : COOL}
              strokeDasharray="4 3"
              strokeOpacity={0.5}
            />
          ))}

          {xTicks.map(({ p, i }) => (
            <text key={i} x={x(i)} y={height - 8} textAnchor="middle" fontSize="9.5" fill={AXIS_TEXT}>
              {p.label.split(" ")[1]}
            </text>
          ))}

          {/* Soft vertical spotlight behind the hovered column */}
          {hover && (
            <rect
              x={hover.x - 18}
              width={36}
              y={margin.top}
              height={innerH}
              fill="currentColor"
              opacity={0.04}
              pointerEvents="none"
            />
          )}

          <path d={buildArea()} fill={`url(#${gradId})`} stroke="none" pointerEvents="none" />

          <AnimatedLines key={range} nino34D={buildPath("nino34")} roniD={buildPath("roni")} />

          {hover && hovered && (
            <g pointerEvents="none">
              <line x1={hover.x} x2={hover.x} y1={margin.top} y2={margin.top + innerH} stroke="currentColor" strokeOpacity={0.3} />
              {hovered.nino34 !== null && (
                <>
                  <circle cx={hover.x} cy={y(hovered.nino34)} r={7} fill={NINO34_COLOR} opacity={0.18} />
                  <circle cx={hover.x} cy={y(hovered.nino34)} r={3} fill={NINO34_COLOR} stroke="var(--color-surface-raised)" strokeWidth={1.4} />
                </>
              )}
              {hovered.roni !== null && (
                <>
                  <circle cx={hover.x} cy={y(hovered.roni)} r={8} fill={RONI_COLOR} opacity={0.2} />
                  <circle cx={hover.x} cy={y(hovered.roni)} r={3.6} fill={RONI_COLOR} stroke="var(--color-surface-raised)" strokeWidth={1.6} />
                </>
              )}
            </g>
          )}
        </svg>

        <div
          className="pointer-events-none absolute top-1 z-10 w-[190px] rounded-(--radius-container) border border-border bg-surface-recessed px-2.5 py-2 shadow-(--elevation-overlay) transition-[opacity,transform] duration-150 ease-out"
          style={{
            ...tooltipStyle(hover?.clientX ?? 0, hover?.containerWidth ?? 1, 190),
            opacity: hover && hovered ? 1 : 0,
            transform: `translateY(${hover && hovered ? 0 : -4}px)`,
          }}
        >
          {hovered && (
            <>
              <div className="text-[11px] font-semibold">{hovered.label}</div>
              <dl className="mt-1 space-y-0.5 text-[11px]">
                <Row color={RONI_COLOR} label="RONI" value={hovered.roni} />
                <Row color={NINO34_COLOR} label="Niño 3.4 anomaly" value={hovered.nino34} />
              </dl>
            </>
          )}
        </div>

        {current && (
          <div className="pointer-events-none absolute right-2 top-1 rounded-(--radius-control) border border-border bg-surface-panel px-3 py-1.5 text-right shadow-(--elevation-flat) ring-1 ring-transparent transition-shadow hover:ring-accent/30">
            <div className="text-2xs font-semibold uppercase tracking-wide text-ink-faint">
              <T>Current</T>
            </div>
            <div className="text-sm font-bold tabular-nums text-ink">
              RONI {current.roni !== null && current.roni > 0 ? "+" : ""}
              {current.roni?.toFixed(2) ?? "—"} °C
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Draws the two lines in, left to right, on mount — the `pathLength` trick
 * (SVG2): the path is told its own length is exactly 1, so one dash of
 * length 1 is either fully hidden (offset 1) or fully shown (offset 0), and
 * a CSS transition between those animates a true reveal regardless of the
 * path's real geometry.
 *
 * Kept as its own component, mounted fresh via `key={range}` on the caller,
 * so re-animating on a range change is a remount (state starts at its own
 * initial `false`) rather than an effect resetting state it just set.
 */
function AnimatedLines({ nino34D, roniD }: { nino34D: string; roniD: string }) {
  const [drawn, setDrawn] = useState(false);
  useEffect(() => {
    const raf = requestAnimationFrame(() => setDrawn(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <>
      <path
        d={nino34D}
        fill="none"
        stroke={NINO34_COLOR}
        strokeWidth={1.4}
        strokeOpacity={0.75}
        strokeLinecap="round"
        pathLength={1}
        style={{
          strokeDasharray: 1,
          strokeDashoffset: drawn ? 0 : 1,
          transition: "stroke-dashoffset 1100ms cubic-bezier(.22,.9,.3,1) 120ms",
        }}
      />
      <path
        d={roniD}
        fill="none"
        stroke={RONI_COLOR}
        strokeWidth={2.2}
        strokeLinejoin="round"
        strokeLinecap="round"
        pathLength={1}
        style={{
          strokeDasharray: 1,
          strokeDashoffset: drawn ? 0 : 1,
          transition: "stroke-dashoffset 1100ms cubic-bezier(.22,.9,.3,1)",
          filter: "drop-shadow(0 1px 2px rgba(244,146,34,0.35))",
        }}
      />
    </>
  );
}

function Legend({ color, label, infoId }: { color: string; label: string; infoId?: string }) {
  return (
    <span className="flex items-center gap-1">
      <span className="h-0.5 w-4 rounded" style={{ background: color }} />
      <T>{label}</T>
      {infoId && <InfoButton id={infoId} label={label} />}
    </span>
  );
}

function Row({ color, label, value }: { color: string; label: string; value: number | null }) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <dt className="flex items-center gap-1.5 text-ink-muted">
        <span className="inline-block h-[3px] w-3 rounded-(--radius-pill)" style={{ background: color }} />
        <T>{label}</T>
      </dt>
      <dd className="tnum font-semibold">
        {value === null ? "—" : `${value > 0 ? "+" : ""}${value.toFixed(2)} °C`}
      </dd>
    </div>
  );
}
