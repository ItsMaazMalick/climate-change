"use client";

import { useEffect, useRef, useState } from "react";

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
      <div className="label mb-1.5 flex items-center gap-1.5">
        {label}
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
      className="inline-flex h-3.5 w-3.5 cursor-help items-center justify-center rounded-full border border-[var(--color-border-strong)] text-[8px] font-bold text-[var(--color-ink-faint)]"
      aria-label={text}
    >
      ?
    </span>
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
        className="w-full appearance-none rounded-md border border-[var(--color-border)] bg-[var(--color-surface-raised)] py-1.5 pl-2.5 pr-7 text-[13px] text-[var(--color-ink)] transition-colors hover:border-[var(--color-border-strong)] focus:border-[var(--color-accent)] focus:outline-none"
      >
        {children}
      </select>
      <svg
        className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[var(--color-ink-faint)]"
        width="9" height="6" viewBox="0 0 9 6" fill="none" aria-hidden
      >
        <path d="M1 1l3.5 3.5L8 1" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      </svg>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Scenario
// ---------------------------------------------------------------------------

/**
 * Scenarios are shown as a ladder rather than a dropdown.
 *
 * The ordering from low to very high forcing is the single most important
 * thing to communicate, and a select box hides it behind a click. Colour is
 * consistent with every chart in the application.
 */
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
    <div
      className="flex flex-col gap-0.5"
      role="radiogroup"
      aria-label="Emissions scenario"
    >
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
            className={`group flex items-center gap-2.5 rounded-md px-2 py-1.5 text-left transition-colors ${
              active
                ? "bg-[var(--color-surface-hover)]"
                : "hover:bg-[var(--color-surface)]"
            }`}
          >
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-full ring-2 ring-offset-1 ring-offset-[var(--color-surface)] transition-all"
              style={{
                background: scenario.color,
                boxShadow: active ? `0 0 0 2px ${scenario.color}55` : undefined,
                ...(active ? {} : { opacity: 0.55 }),
              }}
            />
            <span className="min-w-0 flex-1">
              <span
                className={`block text-[13px] leading-tight ${
                  active ? "font-semibold text-[var(--color-ink)]" : "text-[var(--color-ink-muted)]"
                }`}
              >
                {scenario.label}
              </span>
              {!compact && (
                <span className="block text-[10.5px] leading-tight text-[var(--color-ink-faint)]">
                  {scenario.shortLabel} · {scenario.globalWarming2100} by 2100
                </span>
              )}
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

/**
 * Time is a horizontal ladder, because that is how the reader already thinks
 * about it. The baseline is deliberately set apart from the future windows:
 * it is a different kind of thing — an observation, not a projection.
 */
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
    <div
      // Five 20-year windows do not fit on one line in a 268px sidebar, and
      // truncating the label of a time period makes it unreadable. Wrapping
      // keeps every window legible at any column width.
      className="flex flex-wrap gap-1 rounded-md border border-[var(--color-border)] bg-[var(--color-surface-raised)] p-0.5"
      role="radiogroup"
      aria-label="Climate period"
    >
      {periods.map((id) => {
        const period = PERIODS[id];
        const active = value === id;
        return (
          <button
            key={id}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(id)}
            title={period.label}
            className={`tnum grow basis-[74px] whitespace-nowrap rounded px-1.5 py-1.5 text-center text-[11px] transition-colors ${
              active
                ? "bg-[var(--color-brand-deep)] font-semibold text-white"
                : period.isBaseline
                  ? "text-[var(--color-ink-faint)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-ink)]"
                  : "text-[var(--color-ink-muted)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-ink)]"
            }`}
          >
            {period.shortLabel}
          </button>
        );
      })}
    </div>
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

/**
 * The ensemble is the default and is visually separated from the individual
 * models, because presenting one GCM as the answer is the most common way a
 * climate interface misleads.
 *
 * When `mappableModels` is supplied, models the map cannot draw are grouped
 * separately and labelled. Letting someone pick an option that then fails is
 * worse than showing them the constraint up front — and hiding those models
 * entirely would be worse still, because they remain available in the
 * model-spread panel.
 */
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
        {model.label} — {model.country}
        {model.ecs ? ` · ECS ${model.ecs}` : ""}
      </option>
    );
  };

  return (
    <Select
      value={value}
      onChange={(next) => onChange(next as ModelId)}
      ariaLabel="Climate model"
    >
      <option value="ensemble-all">
        Multi-model ensemble ({individual.length} models)
      </option>
      {mappable.length > 0 && (
        <optgroup label={known ? "Individual models — on the map" : "Individual models"}>
          {mappable.map(option)}
        </optgroup>
      )}
      {unmapped.length > 0 && (
        <optgroup label="Not rasterised — panel values only">
          {unmapped.map(option)}
        </optgroup>
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
  const options = [
    { id: "anomaly" as const, label: "Change", hint: "Difference from the 1995–2014 baseline" },
    { id: "climatology" as const, label: "Absolute", hint: "The value itself over the period" },
  ];
  return (
    <div
      className="flex gap-1 rounded-md border border-[var(--color-border)] bg-[var(--color-surface-raised)] p-0.5"
      role="radiogroup"
      aria-label="Display mode"
    >
      {options.map((option) => (
        <button
          key={option.id}
          type="button"
          role="radio"
          aria-checked={value === option.id}
          disabled={disabled && option.id === "anomaly"}
          title={option.hint}
          onClick={() => onChange(option.id)}
          className={`flex-1 rounded px-2 py-1.5 text-[11.5px] transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
            value === option.id
              ? "bg-[var(--color-surface-hover)] font-semibold text-[var(--color-ink)]"
              : "text-[var(--color-ink-muted)] hover:text-[var(--color-ink)]"
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
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
      className="flex items-center gap-2 text-[12px] text-[var(--color-ink-muted)] transition-colors hover:text-[var(--color-ink)]"
    >
      <span
        className={`relative h-4 w-7 shrink-0 rounded-full transition-colors ${
          // The sage border colour reads as a pale green "on" state, so the
          // off state gets a neutral grey instead.
          checked ? "bg-[var(--color-brand-deep)]" : "bg-[#c4c8c0]"
        }`}
      >
        <span
          className={`absolute top-0.5 h-3 w-3 rounded-full bg-white transition-transform ${
            checked ? "translate-x-3.5" : "translate-x-0.5"
          }`}
        />
      </span>
      {label}
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
    .slice(0, 7);

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
      <input
        type="search"
        value={query}
        placeholder="Search a city or province…"
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
        className="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface-raised)] px-2.5 py-1.5 text-[13px] placeholder:text-[var(--color-ink-faint)] focus:border-[var(--color-accent)] focus:outline-none"
      />

      {open && matches.length > 0 && (
        <ul className="absolute z-30 mt-1 max-h-64 w-full overflow-auto rounded-md border border-[var(--color-border)] bg-[var(--color-surface-raised)] py-1 shadow-xl">
          {matches.map((place, index) => (
            <li key={place.id}>
              <button
                type="button"
                onClick={() => choose(place)}
                onMouseEnter={() => setHighlighted(index)}
                className={`flex w-full items-baseline justify-between gap-3 px-2.5 py-1.5 text-left text-[13px] ${
                  index === highlighted ? "bg-[var(--color-surface-hover)]" : ""
                }`}
              >
                <span>{place.name}</span>
                <span className="text-[10.5px] text-[var(--color-ink-faint)]">
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
