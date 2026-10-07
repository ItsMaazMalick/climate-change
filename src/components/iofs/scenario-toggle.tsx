"use client";

import { scenarioColorVar } from "@/lib/climate/scenario-style";
import { HEADLINE_SCENARIO_IDS, SCENARIOS, type ScenarioId } from "@/lib/climate/taxonomy";
import { InfoButton } from "./info-dialog";

/**
 * Picks one of the four headline emissions pathways, shared by the warming
 * map and the ranking table so both redraw for the same scenario at once.
 */
export function ScenarioToggle({
  value,
  onChange,
}: {
  value: ScenarioId;
  onChange: (id: ScenarioId) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <div className="flex gap-1 rounded-(--radius-pill) border border-border bg-surface-recessed p-0.5">
        {HEADLINE_SCENARIO_IDS.map((id) => {
          const active = id === value;
          const color = scenarioColorVar(id);
          return (
            <button
              key={id}
              type="button"
              onClick={() => onChange(id)}
              aria-pressed={active}
              className={`flex items-center gap-1.5 rounded-(--radius-pill) px-2.5 py-1.5 text-xs font-semibold transition-all duration-150 active:scale-95 ${
                active ? "bg-surface-panel text-ink shadow-(--elevation-flat)" : "text-ink-faint hover:bg-surface-hover hover:text-ink"
              }`}
            >
              <span
                className="h-2 w-2 rounded-(--radius-pill) transition-transform duration-150"
                style={{ background: color, transform: active ? "scale(1.2)" : "scale(1)" }}
              />
              {SCENARIOS[id].label}
            </button>
          );
        })}
      </div>
      <InfoButton id="emissions-pathways" label="emissions pathways" />
    </div>
  );
}
