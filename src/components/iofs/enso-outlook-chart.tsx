"use client";

import { useEffect, useState } from "react";
import { ExternalLink } from "lucide-react";
import { EmptyState } from "@/components/ui/states";
import type { EnsoOutlook } from "@/lib/iofs/enso-outlook";
import { T, useTranslatedText } from "./translation-context";

const PHASE_COLOR = { elNino: "#f4922a", unspecified: "#cbd5e1" } as const;

/**
 * The 9-season CPC/IRI probability outlook. Only the El Niño probability is
 * drawn as a solid segment — that is the number the source states plainly.
 * Where it adds to less than 100%, the remainder is shown as a flat
 * "unspecified" band rather than guessed at as Neutral or La Niña, since the
 * source text (prose, not a data table) doesn't always break that out.
 */
export function EnsoOutlookChart({ outlook }: { outlook: EnsoOutlook | null }) {
  // Bars grow in from zero on mount — a two-phase render (start at 0%, then
  // flip to the real width) rather than a CSS @keyframe, so the animation
  // length tracks each bar's own value instead of playing the same fixed
  // distance for a 2% bar and a 100% one.
  const [grown, setGrown] = useState(false);
  useEffect(() => {
    const raf = requestAnimationFrame(() => setGrown(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  const [hovered, setHovered] = useState<string | null>(null);
  const unavailableTitle = useTranslatedText(
    "This month's probability outlook isn't in a reliably parseable format",
  );

  if (!outlook || outlook.seasons.length === 0) {
    return (
      <EmptyState title={unavailableTitle}>
        <T>The written forecast still has it — see the</T>{" "}
        <a
          href="https://iri.columbia.edu/our-expertise/climate/forecasts/enso/current/"
          target="_blank"
          rel="noopener noreferrer"
          className="text-accent hover:underline"
        >
          <T>IRI/CPC outlook page</T>
        </a>{" "}
        <T>directly rather than a guessed number here.</T>
      </EmptyState>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_240px]">
      <div className="space-y-1.5">
        {outlook.seasons.map((s, i) => {
          const active = hovered === s.season;
          return (
            <div
              key={s.season}
              onMouseEnter={() => setHovered(s.season)}
              onMouseLeave={() => setHovered(null)}
              className={`group flex items-center gap-3 rounded-(--radius-control) px-1.5 py-0.5 transition-colors duration-150 ${
                active ? "bg-surface-hover" : ""
              }`}
            >
              <span
                className={`w-16 shrink-0 text-2xs font-semibold tabular-nums transition-colors ${
                  active ? "text-ink" : "text-ink-muted"
                }`}
              >
                {s.season}
              </span>
              <span className="relative h-5 flex-1 overflow-hidden rounded-(--radius-control) bg-surface-recessed shadow-[inset_0_1px_2px_rgba(0,0,0,0.06)]">
                <span
                  className="absolute inset-y-0 left-0 rounded-(--radius-control) transition-[width,filter] ease-out"
                  style={{
                    width: grown ? `${s.elNino}%` : "0%",
                    transitionDuration: "800ms",
                    transitionDelay: `${i * 45}ms`,
                    background: `linear-gradient(90deg, color-mix(in oklab, ${PHASE_COLOR.elNino} 80%, black), ${PHASE_COLOR.elNino})`,
                    filter: active ? "brightness(1.12) saturate(1.1)" : "none",
                    boxShadow: active ? `0 0 10px -1px color-mix(in oklab, ${PHASE_COLOR.elNino} 70%, transparent)` : "none",
                  }}
                />
              </span>
              <span
                className={`w-9 shrink-0 text-right text-2xs font-bold tabular-nums transition-transform duration-150 ${
                  active ? "scale-110 text-ink" : "text-ink"
                }`}
              >
                {s.elNino}%
              </span>
            </div>
          );
        })}
      </div>

      <div className="flex flex-col gap-3 rounded-(--radius-container) border border-border bg-surface-recessed p-4">
        <LegendRow
          color={PHASE_COLOR.elNino}
          name="El Niño probability"
          desc="As stated by the source for that season"
        />
        <LegendRow
          color={PHASE_COLOR.unspecified}
          name="Remainder"
          desc="Neutral / La Niña — not separately broken out in the source text"
        />
        <div className="mt-1 border-t border-border pt-3 text-2xs leading-relaxed text-ink-faint">
          <T>Source</T>:{" "}
          <a
            href={outlook.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-0.5 text-accent hover:underline"
          >
            IRI / NOAA CPC objective ENSO outlook <ExternalLink className="h-3 w-3" />
          </a>
          {outlook.issued && <> · {outlook.issued}</>}
        </div>
      </div>
    </div>
  );
}

function LegendRow({ color, name, desc }: { color: string; name: string; desc: string }) {
  return (
    <div className="flex items-start gap-2.5">
      <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-xs" style={{ background: color }} />
      <div>
        <div className="text-xs font-semibold text-ink">
          <T>{name}</T>
        </div>
        <div className="text-2xs leading-snug text-ink-faint">
          <T>{desc}</T>
        </div>
      </div>
    </div>
  );
}
