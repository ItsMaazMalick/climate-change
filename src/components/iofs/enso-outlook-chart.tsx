"use client";

import { useEffect, useState } from "react";
import { ExternalLink } from "lucide-react";
import { EmptyState } from "@/components/ui/states";
import { seasonName, signed } from "@/lib/iofs/enso-format";
import type { EnsoOutlook } from "@/lib/iofs/enso-outlook";
import { T, useTranslatedText } from "./translation-context";

const COLORS = { elNino: "#f4922a", neutral: "#94a3b8", laNina: "#4393c3" } as const;

/**
 * NOAA CPC's official 9-season outlook: the chance of El Niño / Neutral / La Niña for each overlapping
 * three-month season, with the chance of a "very strong" event (index ≥ +2.0 °C) and the forecast median RONI.
 * Every number is read from NOAA's published tables — nothing is estimated here.
 */
export function EnsoOutlookChart({ outlook }: { outlook: EnsoOutlook | null }) {
  // Bars grow in from zero on mount, each over a duration that tracks its own value.
  const [grown, setGrown] = useState(false);
  useEffect(() => {
    const raf = requestAnimationFrame(() => setGrown(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  const [hovered, setHovered] = useState<string | null>(null);
  const unavailableTitle = useTranslatedText("NOAA's probability outlook isn't available right now");

  if (!outlook || outlook.seasons.length === 0) {
    return (
      <EmptyState title={unavailableTitle}>
        <T>{"Nothing is estimated in its place — see NOAA's own"}</T>{" "}
        <a
          href="https://cpc.ncep.noaa.gov/products/analysis_monitoring/enso/roni/probabilities/"
          target="_blank"
          rel="noopener noreferrer"
          className="text-accent hover:underline"
        >
          <T>ENSO probabilities page</T>
        </a>
        .
      </EmptyState>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_260px]">
      <div className="space-y-1.5">
        <div className="hidden grid-cols-[4.5rem_1fr_7rem] gap-3 px-1.5 text-2xs text-ink-faint sm:grid">
          <span />
          <span>
            <T>Chance of each state</T>
          </span>
          <span className="text-right">
            <T>Very strong · median RONI</T>
          </span>
        </div>
        {outlook.seasons.map((s, i) => {
          const active = hovered === s.season;
          const bar = (value: number, key: keyof typeof COLORS, delay: number) => (
            <span
              key={key}
              className="h-full transition-[width] ease-out"
              style={{
                width: grown ? `${value}%` : "0%",
                transitionDuration: "800ms",
                transitionDelay: `${i * 45 + delay}ms`,
                background: COLORS[key],
              }}
              title={`${key === "elNino" ? "El Niño" : key === "laNina" ? "La Niña" : "Neutral"} ${value}%`}
            />
          );
          return (
            <div
              key={s.season}
              onMouseEnter={() => setHovered(s.season)}
              onMouseLeave={() => setHovered(null)}
              className={`grid grid-cols-[4.5rem_1fr] items-center gap-3 rounded-(--radius-control) px-1.5 py-0.5 transition-colors duration-150 sm:grid-cols-[4.5rem_1fr_7rem] ${
                active ? "bg-surface-hover" : ""
              }`}
            >
              <span className={`text-2xs font-semibold tabular-nums ${active ? "text-ink" : "text-ink-muted"}`} title={s.season}>
                {seasonName(s.season)}
              </span>
              <span
                className="relative flex h-5 overflow-hidden rounded-(--radius-control) bg-surface-recessed shadow-[inset_0_1px_2px_rgba(0,0,0,0.06)]"
                role="img"
                aria-label={`${seasonName(s.season)}: El Niño ${s.elNino}%, Neutral ${s.neutral}%, La Niña ${s.laNina}%`}
              >
                {bar(s.elNino, "elNino", 0)}
                {bar(s.neutral, "neutral", 60)}
                {bar(s.laNina, "laNina", 120)}
                <span className="pointer-events-none absolute inset-y-0 left-1.5 flex items-center text-2xs font-bold text-white drop-shadow">
                  {s.elNino >= 12 ? `${s.elNino}%` : ""}
                </span>
              </span>
              <span className="hidden text-right text-2xs tabular-nums text-ink sm:block">
                {s.veryStrong === null ? "—" : `${s.veryStrong}%`}
                <span className="text-ink-faint"> · </span>
                {signed(s.roniMedian)} °C
              </span>
            </div>
          );
        })}
      </div>

      <div className="flex flex-col gap-3 rounded-(--radius-container) border border-border bg-surface-recessed p-4">
        <LegendRow color={COLORS.elNino} name="El Niño" desc="Chance that the 3-month RONI is ≥ +0.5 °C" />
        <LegendRow color={COLORS.neutral} name="Neutral" desc="Chance of ENSO-neutral conditions" />
        <LegendRow color={COLORS.laNina} name="La Niña" desc="Chance that the 3-month RONI is ≤ −0.5 °C" />
        <div className="text-2xs leading-snug text-ink-faint">
          <T>
            {
              "“Very strong” is the chance that RONI reaches +2.0 °C or more. The median is NOAA's central RONI forecast. 100% and 0% are rounded, not guarantees."
            }
          </T>
        </div>
        <div className="mt-1 border-t border-border pt-3 text-2xs leading-relaxed text-ink-faint">
          <T>Source</T>:{" "}
          <a
            href={outlook.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-0.5 text-accent hover:underline"
          >
            NOAA CPC official ENSO outlook <ExternalLink className="h-3 w-3" />
          </a>
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
