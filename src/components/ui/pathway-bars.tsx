"use client";

import { SSP_IDS, SCENARIOS } from "@/lib/climate/taxonomy";
import { scenarioColorVar } from "@/lib/climate/scenario-style";

/**
 * The five pathways as a bar chart: IPCC AR6 best-estimate global warming at
 * 2081–2100 relative to 1850–1900. Real, cited numbers — this is the concept
 * the whole platform turns on, so it earns a place in the hero.
 */
function midpoint(range: string | null): number | null {
  if (!range) return null;
  const nums = range.match(/[\d.]+/g);
  if (!nums || nums.length < 2) return nums ? Number(nums[0]) : null;
  return (Number(nums[0]) + Number(nums[1])) / 2;
}

export function PathwayBars({ onDark = false }: { onDark?: boolean }) {
  const rows = SSP_IDS.map((id) => ({
    id,
    label: SCENARIOS[id].label,
    mid: midpoint(SCENARIOS[id].globalWarming2100),
    range: SCENARIOS[id].globalWarming2100,
  }));
  const max = Math.max(...rows.map((r) => r.mid ?? 0), 5);

  return (
    <figure className="w-full">
      <figcaption
        className={`mb-3 text-2xs uppercase tracking-[var(--tracking-caps)] ${
          onDark ? "text-white/55" : "text-ink-faint"
        }`}
      >
        Global warming by 2100 · IPCC AR6 · °C vs 1850–1900
      </figcaption>
      <div className="flex items-end gap-3" style={{ height: 132 }}>
        {rows.map((r) => (
          <div key={r.id} className="flex flex-1 flex-col items-center gap-2">
            <span
              className={`text-xs font-semibold tabular-nums ${onDark ? "text-white" : "text-ink"}`}
              data-numeric
            >
              {r.mid !== null ? `+${r.mid.toFixed(1)}` : "—"}
            </span>
            <div
              className="w-full rounded-t-[3px] transition-[height] duration-500"
              style={{
                height: `${((r.mid ?? 0) / max) * 92}px`,
                minHeight: 4,
                background: scenarioColorVar(r.id),
                boxShadow: onDark
                  ? `0 0 24px -4px ${scenarioColorVar(r.id)}`
                  : `0 6px 14px -6px ${scenarioColorVar(r.id)}`,
              }}
            />
            <span
              className={`text-2xs tabular-nums ${onDark ? "text-white/60" : "text-ink-faint"}`}
              data-numeric
            >
              {r.label}
            </span>
          </div>
        ))}
      </div>
    </figure>
  );
}
