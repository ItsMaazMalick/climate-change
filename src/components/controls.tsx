"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, Search, X } from "lucide-react";

import { scenarioColorVar } from "@/lib/climate/scenario-style";
import {
  FUTURE_PERIOD_IDS,
  INDICATORS,
  MODELS,
  MODEL_IDS,
  PERIODS,
  SCENARIOS,
  SSP_IDS,
  indicatorsByFamily,
  type ModelId,
  type PeriodId,
  type ScenarioId,
} from "@/lib/climate/taxonomy";

// ---------------------------------------------------------------------------
// Primitives
// ---------------------------------------------------------------------------

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-w-0">
      <div className="mb-1.5 flex items-center justify-between">
        <span className="label">{label}</span>
        {hint && <InfoDot text={hint} />}
      </div>
      {children}
    </div>
  );
}

export function InfoDot({ text }: { text: string }) {
  return (
    <span
      title={text}
      aria-label={text}
      className="inline-flex h-4 w-4 cursor-help items-center justify-center rounded-(--radius-pill) border border-border-strong bg-surface-recessed text-[9px] font-bold text-ink-faint transition-colors hover:bg-surface-hover hover:text-ink"
    >
      ?
    </span>
  );
}

/** A segmented control that sits in an inset well; the active option lifts. */
function Segmented<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
  columns = 2,
}: {
  options: Array<{ id: T; label: string; hint?: string; full?: boolean; disabled?: boolean }>;
  value: T;
  onChange: (v: T) => void;
  ariaLabel: string;
  columns?: number;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className="grid gap-1 rounded-(--radius-container) p-1 shadow-[var(--elevation-recessed)]"
      style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
    >
      {options.map((o) => {
        const active = value === o.id;
        return (
          <button
            key={o.id}
            type="button"
            role="radio"
            aria-checked={active}
            disabled={o.disabled}
            title={o.hint}
            onClick={() => onChange(o.id)}
            className={`rounded-(--radius-control) px-2.5 py-1.5 text-center text-xs font-medium tabular-nums transition-all motion-state disabled:cursor-not-allowed disabled:opacity-40 ${
              o.full ? "col-span-full" : ""
            } ${
              active
                ? "bg-surface-raised text-ink shadow-[var(--elevation-raised)]"
                : "text-ink-faint hover:text-ink"
            }`}
            data-numeric={active ? undefined : undefined}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

function Select({
  value,
  onChange,
  children,
  ariaLabel,
}: {
  value: string;
  onChange: (value: string) => void;
  children: React.ReactNode;
  ariaLabel: string;
}) {
  return (
    <div className="relative">
      <select
        value={value}
        aria-label={ariaLabel}
        onChange={(event) => onChange(event.target.value)}
        className="w-full cursor-pointer appearance-none rounded-(--radius-control) border border-border-strong bg-surface-panel py-2.5 pl-3 pr-9 text-[13px] font-medium text-ink shadow-[var(--elevation-recessed)] transition-colors hover:border-ink-faint focus:outline-none focus-visible:shadow-[var(--focus-ring)]"
      >
        {children}
      </select>
      <ChevronDown
        aria-hidden
        className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint"
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Scenario
// ---------------------------------------------------------------------------

export function ScenarioPicker({
  value,
  onChange,
  compact = false,
}: {
  value: ScenarioId;
  onChange: (value: ScenarioId) => void;
  compact?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1.5" role="radiogroup" aria-label="Emissions scenario">
      {SSP_IDS.map((id) => {
        const scenario = SCENARIOS[id];
        const active = value === id;
        return (
          <button
            key={id}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(id)}
            title={scenario.summary}
            style={active ? ({ ["--seam-color" as string]: scenarioColorVar(id) } as React.CSSProperties) : undefined}
            className={`group flex items-center justify-between gap-2.5 rounded-(--radius-control) px-3 py-2 text-left transition-all motion-state ${
              active
                ? "tier-raised-seam"
                : "border border-border bg-surface-panel hover:bg-surface-hover"
            }`}
          >
            <span className="flex min-w-0 items-center gap-2.5">
              <span
                aria-hidden
                className="h-3 w-3 shrink-0 rounded-xs transition-transform group-hover:scale-110"
                style={{ backgroundColor: scenarioColorVar(id) }}
              />
              <span className="min-w-0">
                <span className={`block text-xs leading-tight ${active ? "font-semibold text-ink" : "font-medium text-ink-muted"}`} data-numeric>
                  {scenario.label}
                </span>
                {!compact && (
                  <span className="mt-0.5 block truncate text-2xs leading-tight text-ink-faint">
                    {scenario.forcingDescriptor}
                  </span>
                )}
              </span>
            </span>
            <span
              className="shrink-0 rounded-(--radius-control) border px-1.5 py-0.5 text-2xs font-medium tabular-nums"
              data-numeric
              style={{
                borderColor: `color-mix(in oklab, ${scenarioColorVar(id)} 35%, transparent)`,
                color: scenarioColorVar(id),
                background: `color-mix(in oklab, ${scenarioColorVar(id)} 8%, transparent)`,
              }}
            >
              {scenario.globalWarming2100 ?? "—"}
            </span>
          </button>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Period
// ---------------------------------------------------------------------------

export function PeriodPicker({
  value,
  onChange,
  includeBaseline = true,
}: {
  value: PeriodId;
  onChange: (value: PeriodId) => void;
  includeBaseline?: boolean;
}) {
  const periods: PeriodId[] = includeBaseline
    ? ["1995-2014", ...FUTURE_PERIOD_IDS]
    : [...FUTURE_PERIOD_IDS];

  return (
    <Segmented
      ariaLabel="Climate period"
      value={value}
      onChange={onChange}
      columns={2}
      options={periods.map((id) => ({
        id,
        label: PERIODS[id].isBaseline ? `Baseline · ${PERIODS[id].shortLabel}` : PERIODS[id].shortLabel,
        hint: PERIODS[id].label,
        full: PERIODS[id].isBaseline,
      }))}
    />
  );
}

// ---------------------------------------------------------------------------
// Indicator
// ---------------------------------------------------------------------------

export function IndicatorPicker({
  value,
  onChange,
  griddedOnly = false,
}: {
  value: string;
  onChange: (value: string) => void;
  griddedOnly?: boolean;
}) {
  const groups = indicatorsByFamily();

  return (
    <Select value={value} onChange={onChange} ariaLabel="Climate indicator">
      {groups.map((group) => {
        const options = griddedOnly
          ? group.indicators.filter((i) => i.gridded)
          : group.indicators;
        if (options.length === 0) return null;
        return (
          <optgroup key={group.family.id} label={group.family.label}>
            {options.map((indicator) => (
              <option key={indicator.id} value={indicator.id}>
                {indicator.label} ({indicator.unit})
              </option>
            ))}
          </optgroup>
        );
      })}
    </Select>
  );
}

// ---------------------------------------------------------------------------
// Model
// ---------------------------------------------------------------------------

export function ModelPicker({
  value,
  onChange,
  mappableModels,
}: {
  value: ModelId;
  onChange: (value: ModelId) => void;
  mappableModels?: string[];
}) {
  const individual = MODEL_IDS.filter((id) => id !== "ensemble-all");
  const known = mappableModels ? new Set(mappableModels) : null;
  const mappable = known ? individual.filter((id) => known.has(id)) : individual;
  const unmapped = known ? individual.filter((id) => !known.has(id)) : [];

  const option = (id: ModelId) => {
    const model = MODELS[id];
    return (
      <option key={id} value={id}>
        {model.label} ({model.country})
        {model.ecs ? ` · ECS ${model.ecs}` : ""}
      </option>
    );
  };

  return (
    <Select value={value} onChange={(next) => onChange(next as ModelId)} ariaLabel="Climate model">
      <option value="ensemble-all">Ensemble median · 30 models</option>
      {mappable.length > 0 && (
        <optgroup label="Individual models · mappable">{mappable.map(option)}</optgroup>
      )}
      {unmapped.length > 0 && (
        <optgroup label="Individual models · panel only">{unmapped.map(option)}</optgroup>
      )}
    </Select>
  );
}

// ---------------------------------------------------------------------------
// Product
// ---------------------------------------------------------------------------

export function ProductToggle({
  value,
  onChange,
  disabled,
}: {
  value: "anomaly" | "climatology";
  onChange: (value: "anomaly" | "climatology") => void;
  disabled?: boolean;
}) {
  return (
    <Segmented
      ariaLabel="Display mode"
      value={value}
      onChange={onChange}
      columns={2}
      options={[
        { id: "anomaly", label: "Change (Δ)", hint: "Difference from the 1995–2014 baseline", disabled: disabled },
        { id: "climatology", label: "Absolute", hint: "Direct physical climatology" },
      ]}
    />
  );
}

// ---------------------------------------------------------------------------
// Toggle
// ---------------------------------------------------------------------------

export function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex items-center gap-2.5 text-xs font-medium text-ink-muted transition-colors hover:text-ink"
    >
      <span
        className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-(--radius-pill) transition-colors motion-state ${
          checked ? "bg-accent" : "bg-surface-active shadow-[var(--elevation-recessed)]"
        }`}
      >
        <span
          className={`inline-block h-3.5 w-3.5 rounded-(--radius-pill) bg-surface-raised shadow-[var(--elevation-raised)] transition-transform motion-state ${
            checked ? "translate-x-[18px]" : "translate-x-[3px]"
          }`}
        />
      </span>
      <span>{label}</span>
    </button>
  );
}

// ---------------------------------------------------------------------------
// Place search
// ---------------------------------------------------------------------------

export function PlaceSearch({
  onSelect,
  places,
}: {
  onSelect: (place: { id: string; name: string; lat: number; lon: number }) => void;
  places: Array<{ id: string; name: string; province: string; lat: number; lon: number; population: number }>;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const matches = places
    .filter((place) => {
      const needle = query.trim().toLowerCase();
      if (!needle) return true;
      return (
        place.name.toLowerCase().includes(needle) ||
        place.province.toLowerCase().includes(needle)
      );
    })
    .sort((a, b) => b.population - a.population)
    .slice(0, 8);

  useEffect(() => {
    const handler = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const choose = (place: (typeof places)[number]) => {
    onSelect(place);
    setQuery(place.name);
    setOpen(false);
  };

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <Search
          aria-hidden
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint"
        />
        <input
          type="search"
          value={query}
          placeholder="Search city or region…"
          aria-label="Search for a place"
          onFocus={() => setOpen(true)}
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
            setHighlighted(0);
          }}
          onKeyDown={(event) => {
            if (event.key === "ArrowDown") {
              event.preventDefault();
              setHighlighted((h) => Math.min(h + 1, matches.length - 1));
            } else if (event.key === "ArrowUp") {
              event.preventDefault();
              setHighlighted((h) => Math.max(h - 1, 0));
            } else if (event.key === "Enter" && matches[highlighted]) {
              choose(matches[highlighted]!);
            } else if (event.key === "Escape") {
              setOpen(false);
            }
          }}
          className="w-full rounded-(--radius-control) border border-border-strong bg-surface-panel py-2.5 pl-9 pr-8 text-[13px] font-medium text-ink shadow-[var(--elevation-recessed)] transition-colors placeholder:text-ink-faint hover:border-ink-faint focus:outline-none focus-visible:shadow-[var(--focus-ring)]"
        />
        {query && (
          <button
            type="button"
            aria-label="Clear"
            onClick={() => {
              setQuery("");
              setOpen(false);
            }}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-(--radius-control) p-1 text-ink-faint hover:bg-surface-hover hover:text-ink"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {open && matches.length > 0 && (
        <ul className="tier-overlay absolute z-30 mt-1.5 max-h-64 w-full overflow-auto py-1">
          {matches.map((place, index) => (
            <li key={place.id}>
              <button
                type="button"
                onClick={() => choose(place)}
                onMouseEnter={() => setHighlighted(index)}
                className={`flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-[13px] transition-colors ${
                  index === highlighted
                    ? "bg-accent-soft text-ink"
                    : "text-ink-muted hover:bg-surface-hover"
                }`}
              >
                <span className="font-medium text-ink">{place.name}</span>
                <span className="rounded-(--radius-control) bg-surface-recessed px-1.5 py-0.5 text-2xs text-ink-faint" data-numeric>
                  {place.province}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export { INDICATORS };
