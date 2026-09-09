"use client";

import { SSP_IDS, SCENARIOS, type ScenarioId } from "@/lib/climate/taxonomy";
import { scenarioColorVar } from "@/lib/climate/scenario-style";

/**
 * The five SSPs, each with its locked swatch, forcing value and narrative name
 * — all from the single config source. Meaning is never carried by colour
 * alone: every row shows its label and forcing descriptor.
 */
export function ScenarioSelector({
  value,
  onChange,
  ids = SSP_IDS as readonly ScenarioId[],
}: {
  value: ScenarioId;
  onChange: (id: ScenarioId) => void;
  ids?: readonly ScenarioId[];
}) {
  return (
    <div role="radiogroup" aria-label="Emissions pathway" className="flex flex-col gap-1">
      {ids.map((id) => {
        const s = SCENARIOS[id];
        const active = value === id;
        return (
          <button
            key={id}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(id)}
            className={`flex items-center gap-2.5 rounded-(--radius-control) border px-2.5 py-2 text-left transition-colors motion-state ${
 active
                ? "border-accent bg-accent-soft"
                : "border-border bg-surface-panel hover:bg-surface-hover"
            }`}
          >
            <span
              aria-hidden
              className="h-3 w-3 shrink-0 rounded-xs"
              style={{ background: scenarioColorVar(id) }}
            />
            <span className="min-w-0">
              <span className="flex items-baseline gap-1.5">
                <span className="text-xs font-semibold text-ink" data-numeric>
                  {s.label}
                </span>
                <span className="truncate text-2xs text-ink-faint">{s.family}</span>
              </span>
              <span className="mt-0.5 block text-2xs text-ink-faint">
                {s.forcingDescriptor}
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
