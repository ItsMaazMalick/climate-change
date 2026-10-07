"use client";

import { useEffect, useState } from "react";
import type { EnsoEpisode, EnsoPoint } from "@/lib/iofs/enso";
import { InfoButton } from "./info-dialog";
import { T } from "./translation-context";

const EL_NINO_COLOR = "#d6604d";

/**
 * Strongest El Niño episodes on record, by peak RONI — computed from the
 * real series (`deriveEpisodes` in `lib/iofs/enso.ts`), not a hand-typed
 * table. Bars grow in on mount and brighten on hover so the ranking reads as
 * a chart, not a static list.
 */
export function EpisodeRanking({
  episodes,
  current,
}: {
  episodes: EnsoEpisode[];
  current: EnsoPoint | null;
}) {
  const [grown, setGrown] = useState(false);
  useEffect(() => {
    const raf = requestAnimationFrame(() => setGrown(true));
    return () => cancelAnimationFrame(raf);
  }, []);
  const [hoveredKey, setHoveredKey] = useState<string | null>(null);

  if (episodes.length === 0) return null;
  const top = episodes.slice(0, 6);
  const max = Math.max(3, ...top.map((e) => e.peakRoni));

  return (
    <div className="tier-flat p-5">
      <h4 className="mb-3 flex items-center gap-1 text-sm font-semibold text-ink">
        <T>Strongest El Niño episodes on record, by peak RONI</T>
        <InfoButton id="episode-ranking" label="this ranking" />
      </h4>
      <div className="space-y-2 sm:space-y-1.5">
        {top.map((episode, i) => {
          const isCurrent = current ? episode.key.endsWith(String(current.year)) : false;
          const hovered = hoveredKey === episode.key;
          return (
            <div
              key={episode.key}
              onMouseEnter={() => setHoveredKey(episode.key)}
              onMouseLeave={() => setHoveredKey(null)}
              className={`flex flex-col gap-1.5 rounded-(--radius-control) px-3 py-2 transition-colors duration-150 sm:flex-row sm:items-center sm:gap-3 ${
                hovered ? "bg-surface-hover" : i === 0 ? "bg-surface-recessed" : ""
              }`}
            >
              {/* Row 1 on mobile (rank + name); same flex row as everything else from sm up. */}
              <div className="flex items-center gap-2 sm:contents">
                <span
                  className={`w-5 shrink-0 text-right text-2xs font-semibold tabular-nums transition-colors ${
                    hovered ? "text-ink" : "text-ink-faint"
                  }`}
                >
                  {i + 1}
                </span>
                <span className="min-w-0 flex-1 text-xs font-medium text-ink sm:w-28 sm:flex-none">
                  {episode.label}
                  {isCurrent && (
                    <span className="ml-1.5 text-2xs font-semibold text-accent">
                      · <T>now</T>
                    </span>
                  )}
                </span>
                <span className="shrink-0 text-2xs text-ink-faint sm:hidden">
                  <T>{episode.tier}</T>
                </span>
              </div>

              {/* Row 2 on mobile (bar + value); joins row 1 as one line from sm up. */}
              <div className="flex items-center gap-3 sm:contents">
                <span className="h-2 min-w-0 flex-1 overflow-hidden rounded-(--radius-pill) bg-surface-panel shadow-[inset_0_1px_2px_rgba(0,0,0,0.06)]">
                  <span
                    className="block h-full rounded-(--radius-pill) transition-[width,filter] ease-out"
                    style={{
                      width: grown ? `${Math.min(100, (episode.peakRoni / max) * 100)}%` : "0%",
                      transitionDuration: "700ms",
                      transitionDelay: `${i * 60}ms`,
                      background: `linear-gradient(90deg, color-mix(in oklab, ${EL_NINO_COLOR} 75%, black), ${EL_NINO_COLOR})`,
                      filter: hovered ? "brightness(1.15) saturate(1.1)" : "none",
                      boxShadow: hovered ? `0 0 10px -1px color-mix(in oklab, ${EL_NINO_COLOR} 70%, transparent)` : "none",
                    }}
                  />
                </span>
                <span
                  className={`w-16 shrink-0 text-right text-xs font-bold tabular-nums transition-transform duration-150 ${
                    hovered ? "scale-110 text-ink" : "text-ink"
                  }`}
                >
                  +{episode.peakRoni.toFixed(1)} °C
                </span>
                <span className="hidden shrink-0 text-right text-2xs text-ink-faint sm:inline-block sm:w-14">
                  <T>{episode.tier}</T>
                </span>
              </div>
            </div>
          );
        })}
      </div>
      <p className="mt-3 text-2xs leading-relaxed text-ink-faint">
        <T>
          Computed from the RONI series itself: each row is the peak value of a run of consecutive
          seasons past the ±0.5 °C threshold, not a hand-typed table.
        </T>
      </p>
    </div>
  );
}
