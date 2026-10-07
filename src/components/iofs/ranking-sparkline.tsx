"use client";

import { useEffect, useState } from "react";
import { scenarioColorVar } from "@/lib/climate/scenario-style";
import { PERIODS, type ScenarioId } from "@/lib/climate/taxonomy";
import type { TrajectoryPoint } from "@/lib/iofs/ranking";
import { T } from "./translation-context";

/**
 * A country's real warming trajectory under one emissions pathway — baseline
 * (0) through the four CMIP6 horizons — as a compact inline chart.
 *
 * Earlier versions tried to show all four pathways in one 130px-wide chart,
 * either as four overlapping lines or a shaded min–max envelope. Both were
 * reported as unreadable: four near-parallel lines blur into one fuzzy band
 * at this size, and an envelope has no comfortable way to report which
 * country leads. One scenario at a time, picked by `ScenarioToggle` above
 * the table, draws a single crisp line that is directly comparable row to
 * row — the actual job a ranking table's chart column has to do.
 *
 * Deliberately plots the *anomaly* (delta from the 1995–2014 baseline), not
 * absolute temperature: baselines range from well below 0 °C (Kazakhstan)
 * to the high 20s (Djibouti), so an absolute-temperature scale would be
 * dominated by each country's climate zone and the warming signal — the
 * thing this table ranks by — would barely move the line. The y-axis is
 * shared across every row (not auto-scaled per row) so two sparklines are
 * honestly comparable: a steeper line always means more projected warming,
 * never just a different row's own scale.
 */
export function RankingSparkline({
  points,
  scenario,
  delay = 0,
  domain,
}: {
  points: TrajectoryPoint[];
  scenario: ScenarioId;
  delay?: number;
  /** Shared [min, max] across the whole table, so every row plots on the same scale. */
  domain: [number, number];
}) {
  const width = 132;
  const height = 42;
  const padX = 4;
  const padTop = 6;
  const padBottom = 14; // room for the axis labels under the line

  const color = scenarioColorVar(scenario);
  const series = [{ period: null, delta: 0 }, ...points];
  const [lo, hi] = domain;
  const span = hi - lo || 1;
  const plotH = height - padTop - padBottom;

  const x = (i: number) => padX + (i / (series.length - 1)) * (width - padX * 2);
  const y = (v: number) => padTop + plotH - ((v - lo) / span) * plotH;

  let d = "";
  let pen = false;
  series.forEach((p, i) => {
    if (p.delta === null) {
      pen = false;
      return;
    }
    d += `${pen ? "L" : "M"}${x(i).toFixed(1)},${y(p.delta).toFixed(1)}`;
    pen = true;
  });

  let area = "";
  if (d) {
    const lastIdx = series.length - 1;
    area = `M${x(0).toFixed(1)},${(padTop + plotH).toFixed(1)}${d.slice(1)}L${x(lastIdx).toFixed(1)},${(padTop + plotH).toFixed(1)}Z`;
  }

  const [drawn, setDrawn] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setDrawn(true), delay);
    return () => clearTimeout(t);
  }, [delay, scenario]);

  const last = points[points.length - 1];
  const zeroY = y(0);

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={`Projected warming from the 1995–2014 baseline to ${PERIODS["2080-2099"].label}: ${
        last?.delta !== null && last?.delta !== undefined ? `+${last.delta.toFixed(1)} degrees C` : "no data"
      }`}
    >
      <line x1={padX} x2={width - padX} y1={zeroY} y2={zeroY} stroke="currentColor" strokeOpacity={0.18} />
      <line x1={padX} x2={width - padX} y1={padTop} y2={padTop} stroke="currentColor" strokeOpacity={0.08} strokeDasharray="2 2" />
      <text x={padX} y={padTop - 1.5} fontSize="7" fill="currentColor" opacity={0.4}>
        +{hi.toFixed(0)}°C
      </text>

      <path d={area} fill={color} fillOpacity={0.14} stroke="none" />
      <path
        d={d}
        fill="none"
        stroke={color}
        strokeWidth={1.8}
        strokeLinejoin="round"
        strokeLinecap="round"
        pathLength={1}
        style={{
          strokeDasharray: 1,
          strokeDashoffset: drawn ? 0 : 1,
          transition: "stroke-dashoffset 900ms cubic-bezier(.22,.9,.3,1)",
        }}
      />

      {series.map((p, i) => {
        if (p.delta === null) return null;
        const isLast = i === series.length - 1;
        return (
          <circle key={i} cx={x(i)} cy={y(p.delta)} r={isLast ? 2.4 : 1.6} fill={color} opacity={isLast ? 1 : 0.65}>
            <title>
              {p.delta > 0 ? "+" : ""}
              {p.delta.toFixed(1)} °C
            </title>
          </circle>
        );
      })}

      <text x={x(0)} y={height - 2} textAnchor="start" fontSize="7.5" fill="currentColor" opacity={0.45}>
        <T>now</T>
      </text>
      <text x={x(series.length - 1)} y={height - 2} textAnchor="end" fontSize="7.5" fill="currentColor" opacity={0.45}>
        2099
      </text>
    </svg>
  );
}
