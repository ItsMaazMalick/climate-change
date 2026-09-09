"use client";

import { formatValue } from "@/lib/climate/taxonomy";
import { isDegenerateSpread } from "@/lib/climate/derive";

/**
 * The model spread for one place, pathway and horizon: a median marker, a
 * 10th–90th whisker, and — where supplied — a tick per individual model.
 *
 * D3: if p10 and p90 have collapsed onto the median, this renders "model
 * spread unavailable at this aggregation" rather than a fake-precise identical
 * range.
 */
export function UncertaintyStrip({
  median,
  p10,
  p90,
  members = [],
  indicatorId,
  color = "var(--accent-600)",
}: {
  median: number | null;
  p10: number | null;
  p90: number | null;
  members?: number[];
  indicatorId: string;
  color?: string;
}) {
  if (median === null) {
    return <p className="text-xs text-ink-faint">No projection available.</p>;
  }
  if (p10 === null || p90 === null || isDegenerateSpread(p10, p90)) {
    return (
      <div className="text-xs text-ink-muted">
        <span className="tabular-nums text-ink" data-numeric>
          {formatValue(median, indicatorId, "anomaly")}
        </span>{" "}
        central estimate · model spread unavailable at this aggregation
      </div>
    );
  }

  const values = [p10, p90, median, ...members].filter((v) => Number.isFinite(v));
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const pad = (hi - lo) * 0.12 || 1;
  const min = lo - pad;
  const max = hi + pad;
  const x = (v: number) => ((v - min) / (max - min)) * 100;

  const ticks = [min, (min + max) / 2, max];

  return (
    <figure
      role="img"
      aria-label={`Model spread: 80% of models between ${formatValue(p10, indicatorId, "anomaly")} and ${formatValue(
        p90,
        indicatorId,
        "anomaly",
      )}, median ${formatValue(median, indicatorId, "anomaly")}.`}
    >
      <svg viewBox="0 0 100 26" preserveAspectRatio="none" className="h-14 w-full overflow-visible">
        {/* zero reference */}
        {min < 0 && max > 0 && (
          <line x1={x(0)} x2={x(0)} y1={2} y2={18} stroke="var(--border-strong)" strokeWidth={0.4} strokeDasharray="1 1" />
        )}
        {/* p10–p90 bar */}
        <rect
          x={x(p10)}
          y={9}
          width={Math.max(0.5, x(p90) - x(p10))}
          height={4}
          rx={1}
          fill={color}
          fillOpacity={0.22}
        />
        <line x1={x(p10)} x2={x(p10)} y1={7} y2={15} stroke={color} strokeWidth={0.6} />
        <line x1={x(p90)} x2={x(p90)} y1={7} y2={15} stroke={color} strokeWidth={0.6} />
        {/* individual models */}
        {members.map((m, i) => (
          <line key={i} x1={x(m)} x2={x(m)} y1={8.5} y2={13.5} stroke="var(--ink-faint)" strokeWidth={0.35} strokeOpacity={0.5} />
        ))}
        {/* median */}
        <circle cx={x(median)} cy={11} r={1.6} fill={color} stroke="var(--surface-panel)" strokeWidth={0.5} />
        {/* axis */}
        <line x1={0} x2={100} y1={19} y2={19} stroke="var(--border)" strokeWidth={0.3} />
        {ticks.map((t, i) => (
          <text
            key={i}
            x={i === 0 ? 0 : i === ticks.length - 1 ? 100 : 50}
            y={25}
            fontSize={3.2}
            fill="var(--ink-faint)"
            textAnchor={i === 0 ? "start" : i === ticks.length - 1 ? "end" : "middle"}
          >
            {formatValue(t, indicatorId, "anomaly")}
          </text>
        ))}
      </svg>
      <figcaption className="mt-1 text-xs text-ink-muted">
        80% of models between{" "}
        <span className="tabular-nums text-ink" data-numeric>{formatValue(p10, indicatorId, "anomaly")}</span> and{" "}
        <span className="tabular-nums text-ink" data-numeric>{formatValue(p90, indicatorId, "anomaly")}</span>; median{" "}
        <span className="tabular-nums text-ink" data-numeric>{formatValue(median, indicatorId, "anomaly")}</span>.
      </figcaption>
    </figure>
  );
}
