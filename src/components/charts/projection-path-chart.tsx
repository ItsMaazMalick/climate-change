"use client";

import { useEffect, useId, useRef, useState } from "react";

import { formatValue } from "@/lib/climate/taxonomy";

import { AXIS, AXIS_TEXT, niceTicks } from "./hover";

export interface PathLine {
  id: string;
  label: string;
  color: string;
  points: Array<{
    year: number;
    periodLabel: string;
    value: number | null;
    delta: number | null;
  }>;
  /** Optional estimated year-by-year path; drawn instead of the anchor curve. */
  annual?: Array<{ year: number; value: number | null; delta: number | null }>;
}

type SeriesPoint = { year: number; periodLabel: string; value: number | null; delta: number | null };

const X_MAX = 2100;
const X_TICKS = [2000, 2020, 2040, 2060, 2080, 2100];

/** The four published future windows, shaded behind the lines. */
const WINDOWS = [
  { from: 2020, to: 2040, label: "Near" },
  { from: 2040, to: 2060, label: "Mid-century" },
  { from: 2060, to: 2080, label: "Late" },
  { from: 2080, to: 2100, label: "End of century" },
];

type Pt = { x: number; y: number };

/**
 * Monotone cubic (Fritsch–Carlson) through the points: smooth, but never
 * overshooting between two windows, so the curve cannot invent a peak or dip
 * the data does not have.
 */
function smoothPath(points: Pt[], start: "M" | "L" = "M"): string {
  if (points.length === 0) return "";
  if (points.length === 1) return `${start}${points[0]!.x},${points[0]!.y}`;
  const n = points.length;
  const dx: number[] = [];
  const slope: number[] = [];
  for (let i = 0; i < n - 1; i += 1) {
    dx.push(points[i + 1]!.x - points[i]!.x);
    slope.push((points[i + 1]!.y - points[i]!.y) / (dx[i] || 1));
  }
  const tangent: number[] = [slope[0]!];
  for (let i = 1; i < n - 1; i += 1) {
    const a = slope[i - 1]!;
    const b = slope[i]!;
    tangent.push(a * b <= 0 ? 0 : (3 * (dx[i - 1]! + dx[i]!)) /
      ((2 * dx[i]! + dx[i - 1]!) / a + (dx[i]! + 2 * dx[i - 1]!) / b));
  }
  tangent.push(slope[n - 2]!);

  let d = `${start}${points[0]!.x.toFixed(1)},${points[0]!.y.toFixed(1)}`;
  for (let i = 0; i < n - 1; i += 1) {
    const p0 = points[i]!;
    const p1 = points[i + 1]!;
    const h = dx[i]! / 3;
    d +=
      `C${(p0.x + h).toFixed(1)},${(p0.y + tangent[i]! * h).toFixed(1)} ` +
      `${(p1.x - h).toFixed(1)},${(p1.y - tangent[i + 1]! * h).toFixed(1)} ` +
      `${p1.x.toFixed(1)},${p1.y.toFixed(1)}`;
  }
  return d;
}

/**
 * The point-projection chart: every emissions pathway at one location, from
 * the 1995–2014 baseline to the end of the century.
 *
 * Drawn at the container's real pixel width so text stays legible at any
 * panel size. The shaded fan is the spread between the lowest and highest
 * pathway — the part of the future that is still a choice.
 */
export function ProjectionPathChart({
  lines,
  indicatorId,
  showChange,
  unit,
  height = 380,
}: {
  lines: PathLine[];
  indicatorId: string;
  showChange: boolean;
  unit: string;
  height?: number;
}) {
  const uid = useId().replace(/:/g, "");
  const wrapRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(560);
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [focused, setFocused] = useState<string | null>(null);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  useEffect(() => {
    const node = wrapRef.current;
    if (!node) return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setWidth(Math.max(300, Math.round(entry.contentRect.width)));
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const margin = { top: 34, right: 62, bottom: 34, left: 44 };
  const innerW = width - margin.left - margin.right;
  const innerH = height - margin.top - margin.bottom;

  const read = (p: { value: number | null; delta: number | null }) => (showChange ? p.delta : p.value);
  const visible = lines.filter((line) => !hidden.has(line.id));
  const dense = lines.some((line) => (line.annual?.length ?? 0) > 0);
  const X_MIN = dense ? 1995 : 2000;

  /** What a line is drawn and hovered from: yearly estimate, or the anchors. */
  const seriesOf = (line: PathLine): SeriesPoint[] =>
    dense && line.annual?.length
      ? line.annual.map((p) => ({ ...p, periodLabel: String(p.year) }))
      : line.points;

  const years = [...new Set(lines.flatMap((l) => seriesOf(l).map((p) => p.year)))].sort((a, b) => a - b);
  const at = (line: PathLine, year: number) => seriesOf(line).find((p) => p.year === year) ?? null;

  const domain = (() => {
    const values = visible
      .flatMap((l) => [...seriesOf(l), ...l.points].map(read))
      .filter((v): v is number => v !== null);
    if (values.length === 0) return null;
    const min = Math.min(...values);
    const max = Math.max(...values);
    const pad = (max - min) * 0.14 || 0.5;
    return { min: min - pad, max: max + pad };
  })();

  if (!domain) {
    return (
      <p className="py-10 text-center text-sm text-ink-muted">
        All pathways are hidden — switch one back on below.
      </p>
    );
  }

  const x = (year: number) => margin.left + ((year - X_MIN) / (X_MAX - X_MIN)) * innerW;
  const y = (v: number) => margin.top + innerH - ((v - domain.min) / (domain.max - domain.min)) * innerH;

  const ptsOf = (line: PathLine): Pt[] =>
    seriesOf(line).flatMap((p) => {
      const v = read(p);
      return v === null ? [] : [{ x: x(p.year), y: y(v) }];
    });
  // Yearly data already carries its own shape — join it straight, don't smooth.
  const lineD = (line: PathLine) =>
    dense
      ? ptsOf(line).map((p, i) => `${i ? "L" : "M"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join("")
      : smoothPath(ptsOf(line));

  // Fan: the envelope of the visible pathways at each year.
  const envelope = years.map((year) => {
    const vals = visible.map((l) => at(l, year)).map((p) => (p ? read(p) : null)).filter((v): v is number => v !== null);
    return vals.length ? { year, lo: Math.min(...vals), hi: Math.max(...vals) } : null;
  }).filter((e): e is { year: number; lo: number; hi: number } => e !== null);
  const edge = (pts: Pt[], start: "M" | "L") =>
    dense ? pts.map((p, i) => `${i || start === "L" ? "L" : "M"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join("") : smoothPath(pts, start);
  const fanPath =
    envelope.length > 1
      ? edge(envelope.map((e) => ({ x: x(e.year), y: y(e.hi) })), "M") +
        edge([...envelope].reverse().map((e) => ({ x: x(e.year), y: y(e.lo) })), "L") +
        "Z"
      : "";

  // End-of-line labels, nudged apart so close pathways don't overprint.
  const endLabels = visible
    .map((line) => {
      const series = seriesOf(line);
      const last = series[series.length - 1]!;
      const v = read(last);
      return v === null ? null : { line, v, y: y(v) };
    })
    .filter((l): l is { line: PathLine; v: number; y: number } => l !== null)
    .sort((a, b) => a.y - b.y);
  for (let i = 1; i < endLabels.length; i += 1) {
    const gap = endLabels[i]!.y - endLabels[i - 1]!.y;
    if (gap < 15) endLabels[i]!.y = endLabels[i - 1]!.y + 15;
  }

  const yTicks = niceTicks(domain.min, domain.max, 5);
  const thisYear = new Date().getFullYear();
  const product = showChange ? "anomaly" : "climatology";

  const onMove = (event: React.PointerEvent<SVGSVGElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const px = ((event.clientX - rect.left) / rect.width) * width;
    let best = 0;
    years.forEach((year, i) => {
      if (Math.abs(x(year) - px) < Math.abs(x(years[best]!) - px)) best = i;
    });
    setHoverIndex(best);
  };

  const hoverYear = hoverIndex !== null ? (years[hoverIndex] ?? null) : null;
  const readings =
    hoverYear !== null
      ? visible
          .map((line) => ({ line, point: at(line, hoverYear) }))
          .filter((r): r is { line: PathLine; point: SeriesPoint } => r.point !== null && read(r.point) !== null)
          .sort((a, b) => (read(b.point) ?? 0) - (read(a.point) ?? 0))
      : [];
  const tipLeft = hoverYear !== null && x(hoverYear) > width * 0.55;

  return (
    <div ref={wrapRef} className="relative select-none">
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        className="block touch-none overflow-visible"
        role="img"
        aria-label={`Projection for this location from 1995–2014 to 2100 under ${lines.length} emissions pathways`}
        onPointerMove={onMove}
        onPointerLeave={() => setHoverIndex(null)}
      >
        <defs>
          <linearGradient id={`fan-${uid}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#dc2626" stopOpacity="0.22" />
            <stop offset="100%" stopColor="#0284c7" stopOpacity="0.14" />
          </linearGradient>
          <filter id={`glow-${uid}`} x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <style>{`
            @keyframes ppc-draw-${uid} { from { stroke-dashoffset: 1 } to { stroke-dashoffset: 0 } }
            @keyframes ppc-fade-${uid} { from { opacity: 0 } to { opacity: 1 } }
          `}</style>
        </defs>

        {/* Future windows */}
        {WINDOWS.map((w, i) => (
          <g key={w.label}>
            <rect
              x={x(w.from)}
              y={margin.top}
              width={x(w.to) - x(w.from)}
              height={innerH}
              fill="currentColor"
              opacity={i % 2 === 0 ? 0.025 : 0.05}
            />
            <text
              x={(x(w.from) + x(w.to)) / 2}
              y={margin.top - 10}
              textAnchor="middle"
              fontSize="10.5"
              fontWeight={600}
              fill={AXIS_TEXT}
              letterSpacing="0.04em"
            >
              {w.label.toUpperCase()}
            </text>
          </g>
        ))}

        {/* Grid + y axis */}
        {yTicks.map((tick) => (
          <g key={tick}>
            <line x1={margin.left} x2={margin.left + innerW} y1={y(tick)} y2={y(tick)} stroke={AXIS} />
            <text x={margin.left - 8} y={y(tick) + 4} textAnchor="end" fontSize="11.5" fill={AXIS_TEXT} className="tnum">
              {showChange && tick > 0 ? "+" : ""}
              {tick.toFixed(Math.abs(tick) < 10 && tick % 1 !== 0 ? 1 : 0)}
            </text>
          </g>
        ))}
        <text x={margin.left - 8} y={margin.top - 10} textAnchor="end" fontSize="11" fontWeight={600} fill={AXIS_TEXT}>
          {unit}
        </text>
        {showChange && domain.min < 0 && domain.max > 0 && (
          <line x1={margin.left} x2={margin.left + innerW} y1={y(0)} y2={y(0)} stroke={AXIS_TEXT} strokeOpacity={0.5} strokeDasharray="4 3" />
        )}

        {/* x axis */}
        {X_TICKS.map((year) => (
          <text key={year} x={x(year)} y={height - 10} textAnchor="middle" fontSize="11.5" fontWeight={year === 2100 ? 700 : 400} fill={year === 2100 ? "var(--color-ink)" : AXIS_TEXT} className="tnum">
            {year}
          </text>
        ))}

        {/* Today */}
        {thisYear > X_MIN && thisYear < X_MAX && (
          <g>
            <line x1={x(thisYear)} x2={x(thisYear)} y1={margin.top} y2={margin.top + innerH} stroke="var(--color-ink)" strokeOpacity={0.45} strokeDasharray="3 4" />
            <rect x={x(thisYear) - 20} y={margin.top + innerH - 20} width={40} height={16} rx={8} fill="var(--color-ink)" />
            <text x={x(thisYear)} y={margin.top + innerH - 8.5} textAnchor="middle" fontSize="10" fontWeight={700} fill="var(--color-surface-panel)">
              Today
            </text>
          </g>
        )}

        {/* Fan between lowest and highest pathway */}
        {fanPath && (
          <path
            d={fanPath}
            fill={`url(#fan-${uid})`}
            style={{ animation: `ppc-fade-${uid} 900ms ease-out both` }}
          />
        )}

        {/* Lines */}
        {visible.map((line, i) => {
          const dimmed = focused !== null && focused !== line.id;
          const isFocus = focused === line.id;
          return (
            <path
              key={`${line.id}-${showChange}`}
              d={lineD(line)}
              fill="none"
              stroke={line.color}
              strokeWidth={isFocus ? 4.5 : dense ? 2.4 : 3}
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity={dimmed ? 0.18 : 1}
              filter={isFocus ? `url(#glow-${uid})` : undefined}
              pathLength={1}
              strokeDasharray="1 1"
              style={{
                animation: `ppc-draw-${uid} 1100ms cubic-bezier(.3,.7,.2,1) ${i * 90}ms both`,
                transition: "opacity 150ms, stroke-width 150ms",
              }}
            />
          );
        })}

        {/* Dots */}
        {visible.map((line) =>
          line.points.map((p, i) => {
            const v = read(p);
            if (v === null) return null;
            const active = !dense && hoverIndex === i;
            return (
              <circle
                key={`${line.id}-${p.year}`}
                cx={x(p.year)}
                cy={y(v)}
                r={active ? 6 : 4}
                fill={line.color}
                stroke="var(--color-surface-panel)"
                strokeWidth={2}
                opacity={focused !== null && focused !== line.id ? 0.18 : 1}
                style={{ transition: "r 120ms", animation: `ppc-fade-${uid} 600ms ease-out 700ms both` }}
                pointerEvents="none"
              />
            );
          }),
        )}

        {/* End labels */}
        {endLabels.map(({ line, v, y: ly }) => (
          <text
            key={line.id}
            x={x(years[years.length - 1]!) + 10}
            y={ly + 4}
            fontSize="12"
            fontWeight={700}
            fill={line.color}
            className="tnum"
            opacity={focused !== null && focused !== line.id ? 0.25 : 1}
            style={{ animation: `ppc-fade-${uid} 600ms ease-out 900ms both` }}
          >
            {formatValue(v, indicatorId, product)}
          </text>
        ))}

        {/* Crosshair */}
        {hoverYear !== null && (
          <line
            x1={x(hoverYear)}
            x2={x(hoverYear)}
            y1={margin.top}
            y2={margin.top + innerH}
            stroke="var(--color-ink)"
            strokeOpacity={0.35}
            pointerEvents="none"
          />
        )}
      </svg>

      {hoverYear !== null && readings.length > 0 && (
        <div
          className="pointer-events-none absolute z-10 w-[210px] rounded-(--radius-container) border border-border bg-surface-panel/95 p-3 shadow-(--elevation-overlay) backdrop-blur"
          style={{
            top: margin.top + 6,
            left: tipLeft ? x(hoverYear) - 222 : x(hoverYear) + 12,
          }}
        >
          <div className="text-[13px] font-semibold text-ink">
            {readings[0]!.point.periodLabel}
          </div>
          <div className="mb-2 text-[11px] text-ink-faint">
            {dense ? "Estimated yearly value" : hoverIndex === 0 ? "Historical baseline" : "20-year average"}
          </div>
          <dl className="space-y-1">
            {readings.map(({ line, point }) => (
              <div key={line.id} className="flex items-center justify-between gap-2 text-[12px]">
                <dt className="flex items-center gap-1.5 text-ink-muted">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: line.color }} />
                  {line.label}
                </dt>
                <dd className="tnum text-right">
                  <span className="font-semibold text-ink">{formatValue(point.value, indicatorId)}</span>
                  {(dense || hoverIndex !== 0) && (
                    <span className="ml-1.5 text-[11px] font-medium" style={{ color: line.color }}>
                      {formatValue(point.delta, indicatorId, "anomaly")}
                    </span>
                  )}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      )}

      <div className="mt-3 flex flex-wrap gap-1.5">
        {lines.map((line) => {
          const off = hidden.has(line.id);
          return (
            <button
              key={line.id}
              type="button"
              aria-pressed={!off}
              onMouseEnter={() => !off && setFocused(line.id)}
              onMouseLeave={() => setFocused(null)}
              onClick={() =>
                setHidden((current) => {
                  const next = new Set(current);
                  if (next.has(line.id)) next.delete(line.id);
                  else next.add(line.id);
                  return next;
                })
              }
              className={`flex items-center gap-1.5 rounded-(--radius-pill) border px-2.5 py-1 text-xs font-semibold transition-all ${
                off ? "border-border text-ink-faint line-through opacity-60" : "border-transparent text-ink shadow-(--elevation-flat)"
              }`}
              style={off ? undefined : { background: `color-mix(in oklab, ${line.color} 14%, transparent)` }}
            >
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: off ? "transparent" : line.color, border: `2px solid ${line.color}` }} />
              {line.label}
            </button>
          );
        })}
        <span className="self-center pl-1 text-[11px] text-ink-faint">Click to show / hide</span>
      </div>
    </div>
  );
}
