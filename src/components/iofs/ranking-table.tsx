"use client";

import { useMemo, useState } from "react";
import { scenarioColorVar } from "@/lib/climate/scenario-style";
import { formatValue, type ScenarioId } from "@/lib/climate/taxonomy";
import type { IofsRankingEntry } from "@/lib/iofs/ranking";
import { InfoButton } from "./info-dialog";
import { RankingSparkline } from "./ranking-sparkline";
import { ScenarioToggle } from "./scenario-toggle";
import { T } from "./translation-context";

const RANK_COLOR = "#d6604d";

export function RankingTable({
  ranking,
  selected,
  onSelect,
  scenario,
  onScenarioChange,
}: {
  ranking: IofsRankingEntry[];
  selected: string;
  onSelect: (iso3: string) => void;
  scenario: ScenarioId;
  onScenarioChange: (id: ScenarioId) => void;
}) {
  const pointsFor = (entry: IofsRankingEntry) =>
    entry.trajectories.find((t) => t.scenario === scenario)?.points ?? [];

  const sorted = useMemo(() => {
    const withDelta = ranking.map((entry) => {
      const points = pointsFor(entry);
      return { entry, delta: points[points.length - 1]?.delta ?? null };
    });
    withDelta.sort((a, b) => (b.delta ?? -Infinity) - (a.delta ?? -Infinity));
    return withDelta;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ranking, scenario]);

  // One shared y-domain for every row's sparkline, so a steeper line always
  // means more warming — never just a different row's own auto-scale. Scoped
  // to the selected scenario, so switching pathways re-scales the whole
  // column rather than leaving SSP1-2.6 rows looking artificially flat
  // against a domain sized for SSP5-8.5.
  const domain = useMemo((): [number, number] => {
    const values = ranking
      .flatMap((r) => pointsFor(r).map((p) => p.delta))
      .filter((v): v is number => v !== null);
    const hi = Math.max(0.5, ...values);
    const pad = hi * 0.08;
    return [-pad * 0.6, hi + pad];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ranking, scenario]);

  const [hoveredRow, setHoveredRow] = useState<string | null>(null);
  const color = scenarioColorVar(scenario);

  return (
    <div className="max-h-[480px] overflow-y-auto">
      <div className="sticky top-0 z-10 flex items-center justify-between gap-2 border-b border-border bg-surface-panel px-2 py-2">
        <ScenarioToggle value={scenario} onChange={onScenarioChange} />
      </div>
      <table className="w-full border-collapse text-sm">
        <thead className="sticky top-[45px] bg-surface-panel text-2xs uppercase tracking-wide text-ink-faint">
          <tr>
            <th className="px-2 py-2 text-left font-medium">#</th>
            <th className="px-2 py-2 text-left font-medium">
              <T>Country</T>
            </th>
            <th className="px-2 py-2 text-right font-medium">
              <span className="inline-flex items-center gap-1">
                <T>Warming trajectory</T>
                <InfoButton id="warming-fan-chart" label="this chart" />
              </span>
            </th>
          </tr>
        </thead>
        <tbody>
          {sorted.map(({ entry, delta }, i) => {
            const isSelected = entry.iso3 === selected;
            const isHovered = hoveredRow === entry.iso3;
            const points = pointsFor(entry);

            return (
              <tr
                key={entry.iso3}
                onClick={() => onSelect(entry.iso3)}
                onMouseEnter={() => setHoveredRow(entry.iso3)}
                onMouseLeave={() => setHoveredRow(null)}
                className={`cursor-pointer border-b border-border/60 transition-all duration-150 ${
                  isSelected
                    ? "bg-accent-soft shadow-[inset_2px_0_0_0_var(--color-accent)]"
                    : isHovered
                      ? "bg-surface-hover"
                      : ""
                }`}
              >
                <td className="px-2 py-1.5 tabular-nums">
                  {i < 3 ? (
                    <span
                      className="flex h-4.5 w-4.5 items-center justify-center rounded-(--radius-pill) text-[10px] font-bold text-white transition-transform duration-150"
                      style={{
                        background: `color-mix(in oklab, ${RANK_COLOR} ${85 - i * 15}%, var(--ink-faint))`,
                        transform: isHovered ? "scale(1.15)" : "scale(1)",
                      }}
                    >
                      {i + 1}
                    </span>
                  ) : (
                    <span className="text-ink-faint">{i + 1}</span>
                  )}
                </td>
                <td className="px-2 py-1.5 font-medium text-ink">
                  <span className={`inline-block transition-transform duration-150 ${isHovered ? "translate-x-0.5" : ""}`}>
                    {entry.flag} <T>{entry.name}</T>
                  </span>
                  <span className="ml-1.5 text-2xs font-normal tabular-nums text-ink-faint">
                    {formatValue(entry.baselineTas, "tas")} <T>today</T>
                  </span>
                </td>
                <td className="px-2 py-1.5">
                  <div className="flex items-center justify-end gap-2.5">
                    <div
                      className="transition-[filter] duration-150"
                      style={{ filter: isHovered ? "brightness(1.08) saturate(1.1)" : "none" }}
                    >
                      <RankingSparkline points={points} scenario={scenario} domain={domain} delay={i * 20} />
                    </div>
                    <div className="w-16 shrink-0 text-right text-sm font-bold tabular-nums" style={{ color }}>
                      {delta !== null ? `${delta > 0 ? "+" : ""}${delta.toFixed(1)}°C` : "—"}
                    </div>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
