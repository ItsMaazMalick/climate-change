"use client";

import { useEffect, useMemo, useState } from "react";
import { AXIS, AXIS_TEXT, niceTicks, tooltipStyle, useChartHover } from "@/components/charts/hover";
import type { EnsoEpisode, EnsoPoint } from "@/lib/iofs/enso";
import { InfoButton } from "./info-dialog";
import { T } from "./translation-context";

const WINDOW_BEFORE = 2;
const WINDOW_AFTER = 13;
const CURRENT_COLOR = "#d6604d";
const COMPARE_COLOR = "#8a93a6";

/**
 * Lines up the current El Niño episode against a past one by "months since
 * onset" (month 0 = the first season RONI crossed +0.5 °C), so the shape of
 * the two events — not just their calendar dates — can be read off directly.
 *
 * Every value plotted is a real RONI reading from the series already fetched
 * in `EnsoSection`; nothing here is a province-level impact reconstruction —
 * that would need an observational dataset (rainfall, NDVI) this page does
 * not have wired up for all 43 IOFS members, so it is left out rather than
 * approximated.
 */
export function EpisodeComparator({
  history,
  episodes,
  current,
}: {
  history: EnsoPoint[];
  episodes: EnsoEpisode[];
  current: EnsoPoint | null;
}) {
  const currentEpisode = useMemo(
    () => (current ? episodes.find((e) => e.key.endsWith(String(current.year))) ?? null : null),
    [episodes, current],
  );
  const pastEpisodes = useMemo(
    () => episodes.filter((e) => e.key !== currentEpisode?.key).slice(0, 4),
    [episodes, currentEpisode],
  );

  const [compareKey, setCompareKey] = useState(pastEpisodes[0]?.key ?? "");
  const compareEpisode = pastEpisodes.find((e) => e.key === compareKey) ?? pastEpisodes[0] ?? null;

  const episodeWindow = (episode: EnsoEpisode | null) => {
    if (!episode) return [];
    const onsetIndex = history.findIndex((p) => p.label === episode.startLabel);
    if (onsetIndex === -1) return [];
    return history.slice(
      Math.max(0, onsetIndex - WINDOW_BEFORE),
      onsetIndex + WINDOW_AFTER,
    ).map((p, i) => ({ monthsSinceOnset: i - WINDOW_BEFORE, point: p }));
  };

  const currentSeries = useMemo(() => episodeWindow(currentEpisode), [currentEpisode, history]);
  const compareSeries = useMemo(() => episodeWindow(compareEpisode), [compareEpisode, history]);

  const width = 640;
  const height = 220;
  const margin = { top: 14, right: 14, bottom: 24, left: 36 };
  const innerW = width - margin.left - margin.right;
  const innerH = height - margin.top - margin.bottom;

  const allValues = [...currentSeries, ...compareSeries]
    .map((d) => d.point.roni)
    .filter((v): v is number => v !== null);
  const minX = -WINDOW_BEFORE;
  const maxX = WINDOW_AFTER - 1;
  const minY = Math.min(-0.5, ...allValues);
  const maxY = Math.max(0.5, ...allValues);
  const pad = (maxY - minY) * 0.1 || 0.5;
  const yLo = minY - pad;
  const yHi = maxY + pad;

  const x = (m: number) => margin.left + ((m - minX) / (maxX - minX)) * innerW;
  const y = (v: number) => margin.top + innerH - ((v - yLo) / (yHi - yLo)) * innerH;

  const path = (series: typeof currentSeries) => {
    let d = "";
    let pen = false;
    for (const { monthsSinceOnset, point } of series) {
      if (point.roni === null) {
        pen = false;
        continue;
      }
      d += `${pen ? "L" : "M"}${x(monthsSinceOnset).toFixed(1)},${y(point.roni).toFixed(1)}`;
      pen = true;
    }
    return d;
  };

  // A uniform month axis (-2..12) so the hover can report both series' values
  // at the same x even when the ongoing episode hasn't reached month 12 yet.
  const months = useMemo(
    () => Array.from({ length: maxX - minX + 1 }, (_, i) => minX + i),
    [minX, maxX],
  );
  const valueAt = (series: typeof currentSeries, month: number) =>
    series.find((d) => d.monthsSinceOnset === month)?.point.roni ?? null;
  const labelAt = (series: typeof currentSeries, month: number) =>
    series.find((d) => d.monthsSinceOnset === month)?.point.label ?? null;

  const { hover, containerRef, handlers } = useChartHover(months.length, (i) => x(months[i]!));
  const hoveredMonth = hover ? (months[hover.index] ?? null) : null;

  if (!currentEpisode || pastEpisodes.length === 0) return null;

  const yTicks = niceTicks(yLo, yHi, 4);
  const currentVal = hoveredMonth !== null ? valueAt(currentSeries, hoveredMonth) : null;
  const compareVal = hoveredMonth !== null ? valueAt(compareSeries, hoveredMonth) : null;

  return (
    <div className="tier-flat p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <h4 className="flex items-center gap-1 text-sm font-semibold text-ink">
          <T>Current episode vs. a past one, aligned by month since onset</T>
          <InfoButton id="episode-comparator" label="this comparison" />
        </h4>
        <div className="flex flex-wrap gap-1.5">
          {pastEpisodes.map((e) => (
            <button
              key={e.key}
              type="button"
              onClick={() => setCompareKey(e.key)}
              className={`rounded-(--radius-pill) border px-2.5 py-1 text-2xs font-semibold transition-all duration-150 active:scale-95 ${
                e.key === compareKey
                  ? "border-accent bg-accent-soft text-ink shadow-(--elevation-flat)"
                  : "border-border text-ink-faint hover:border-ink-faint hover:text-ink"
              }`}
            >
              {e.label} · <T>peak</T> +{e.peakRoni.toFixed(1)}°C
            </button>
          ))}
        </div>
      </div>

      <div ref={containerRef} className="relative">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full touch-none"
          role="img"
          aria-label="Current El Niño episode compared with a past one"
          {...handlers}
        >
          {yTicks.map((t) => (
            <g key={t}>
              <line x1={margin.left} x2={width - margin.right} y1={y(t)} y2={y(t)} stroke={AXIS} />
              <text x={margin.left - 6} y={y(t) + 3.5} textAnchor="end" fontSize="10" fill={AXIS_TEXT} className="tnum">
                {t > 0 ? `+${t}` : t}
              </text>
            </g>
          ))}

          {hover && (
            <rect x={hover.x - 16} width={32} y={margin.top} height={innerH} fill="currentColor" opacity={0.04} pointerEvents="none" />
          )}

          <text x={width - margin.right} y={margin.top - 4} textAnchor="end" fontSize="9" fill={AXIS_TEXT}>
            RONI, °C
          </text>

          <line x1={x(0)} x2={x(0)} y1={margin.top} y2={margin.top + innerH} stroke="currentColor" strokeOpacity={0.25} strokeDasharray="3 3" />
          <text x={x(0)} y={margin.top - 4} textAnchor="middle" fontSize="9.5" fontWeight={600} fill={AXIS_TEXT}>
            <T>El Niño onset</T>
          </text>

          {months
            .filter((m) => m !== 0 && m % 3 === 0)
            .map((m) => (
              <text key={m} x={x(m)} y={height - 6} textAnchor="middle" fontSize="8.5" fill={AXIS_TEXT}>
                {m > 0 ? `+${m}` : m}
              </text>
            ))}
          <text x={width - margin.right} y={height - 6} textAnchor="end" fontSize="8.5" fill={AXIS_TEXT} opacity={0.7}>
            <T>months →</T>
          </text>

          <AnimatedLines
            key={`${compareKey}:${currentEpisode.key}`}
            compareD={path(compareSeries)}
            currentD={path(currentSeries)}
          />

          {hover && (
            <g pointerEvents="none">
              {compareVal !== null && (
                <>
                  <circle cx={hover.x} cy={y(compareVal)} r={6.5} fill={COMPARE_COLOR} opacity={0.18} />
                  <circle cx={hover.x} cy={y(compareVal)} r={3} fill={COMPARE_COLOR} stroke="var(--color-surface-raised)" strokeWidth={1.4} />
                </>
              )}
              {currentVal !== null && (
                <>
                  <circle cx={hover.x} cy={y(currentVal)} r={7.5} fill={CURRENT_COLOR} opacity={0.2} />
                  <circle cx={hover.x} cy={y(currentVal)} r={3.4} fill={CURRENT_COLOR} stroke="var(--color-surface-raised)" strokeWidth={1.5} />
                </>
              )}
            </g>
          )}
        </svg>

        <div
          className="pointer-events-none absolute top-1 z-10 w-44 rounded-(--radius-container) border border-border bg-surface-recessed px-2.5 py-2 shadow-(--elevation-overlay) transition-[opacity,transform] duration-150 ease-out"
          style={{
            ...tooltipStyle(hover?.clientX ?? 0, hover?.containerWidth ?? 1, 176),
            opacity: hover ? 1 : 0,
            transform: `translateY(${hover ? 0 : -4}px)`,
          }}
        >
          {hoveredMonth !== null && (
            <>
              <div className="text-[11px] font-semibold">
                <T>Month</T> {hoveredMonth >= 0 ? `+${hoveredMonth}` : hoveredMonth}
              </div>
              <dl className="mt-1 space-y-0.5 text-[11px]">
                <TooltipRow color={CURRENT_COLOR} label={labelAt(currentSeries, hoveredMonth) ?? currentEpisode.label} value={currentVal} />
                {compareEpisode && (
                  <TooltipRow color={COMPARE_COLOR} label={labelAt(compareSeries, hoveredMonth) ?? compareEpisode.label} value={compareVal} />
                )}
              </dl>
            </>
          )}
        </div>
      </div>

      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1.5 text-2xs">
        <span className="flex items-center gap-1.5">
          <span className="h-0.5 w-4 rounded" style={{ background: CURRENT_COLOR }} />
          <strong className="font-semibold text-ink">{currentEpisode.label} El Niño</strong>
          <span className="text-ink-faint">
            — <T>ongoing, still being measured</T>
          </span>
        </span>
        {compareEpisode && (
          <span className="flex items-center gap-1.5">
            <span className="h-0.5 w-4 rounded" style={{ background: COMPARE_COLOR }} />
            <strong className="font-semibold text-ink">{compareEpisode.label} El Niño</strong>
            <span className="text-ink-faint">
              — <T>historical, peaked at</T> +{compareEpisode.peakRoni.toFixed(1)} °C
            </span>
          </span>
        )}
      </div>
      <p className="mt-2 text-2xs leading-relaxed text-ink-faint">
        <T>
          Each line is RONI (El Niño strength) by month since that episode&apos;s own onset — the
          real series, just re-anchored to a shared starting point instead of the calendar, so two
          events of different vintage (one from the past, one happening now) line up for
          comparison.
        </T>{" "}
        <T>
          This line stops where the real data stops so far — it is not yet known whether the
          current event will keep climbing, flatten, or fall like the comparison episode did.
        </T>
      </p>
    </div>
  );
}

/**
 * Draws both lines in on mount via the `pathLength` trick (see the sibling
 * chart, `enso-history-chart.tsx`, for the full rationale). Mounted fresh via
 * `key={compareKey:currentEpisode.key}` on the caller so switching the
 * comparison episode replays the animation through a remount rather than an
 * effect resetting state it just set.
 */
function AnimatedLines({ compareD, currentD }: { compareD: string; currentD: string }) {
  const [drawn, setDrawn] = useState(false);
  useEffect(() => {
    const raf = requestAnimationFrame(() => setDrawn(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <>
      <path
        d={compareD}
        fill="none"
        stroke={COMPARE_COLOR}
        strokeWidth={2}
        strokeLinejoin="round"
        strokeLinecap="round"
        pathLength={1}
        style={{
          strokeDasharray: 1,
          strokeDashoffset: drawn ? 0 : 1,
          transition: "stroke-dashoffset 900ms cubic-bezier(.22,.9,.3,1) 80ms",
        }}
      />
      <path
        d={currentD}
        fill="none"
        stroke={CURRENT_COLOR}
        strokeWidth={2.6}
        strokeLinejoin="round"
        strokeLinecap="round"
        pathLength={1}
        style={{
          strokeDasharray: 1,
          strokeDashoffset: drawn ? 0 : 1,
          transition: "stroke-dashoffset 900ms cubic-bezier(.22,.9,.3,1)",
          filter: "drop-shadow(0 1px 2px rgba(214,96,77,0.35))",
        }}
      />
    </>
  );
}

function TooltipRow({ color, label, value }: { color: string; label: string; value: number | null }) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <dt className="flex items-center gap-1.5 truncate text-ink-muted">
        <span className="inline-block h-[3px] w-3 shrink-0 rounded-(--radius-pill)" style={{ background: color }} />
        <span className="truncate">{label}</span>
      </dt>
      <dd className="tnum shrink-0 font-semibold">
        {value === null ? "—" : `${value > 0 ? "+" : ""}${value.toFixed(2)}`}
      </dd>
    </div>
  );
}
