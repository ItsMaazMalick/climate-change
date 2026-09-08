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
      <div className="label mb-1.5 flex items-center justify-between text-[11px] font-bold tracking-wider text-slate-600">
        <span>{label}</span>
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
      className="inline-flex h-4 w-4 cursor-help items-center justify-center rounded-full border border-slate-300 bg-slate-50 text-[9px] font-bold text-slate-500 hover:bg-slate-200 hover:text-slate-800 transition-colors"
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
        className="w-full appearance-none rounded-lg border border-slate-200 bg-white py-2 pl-3 pr-8 text-[13px] font-medium text-slate-900 shadow-xs transition-all hover:border-slate-300 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20 focus:outline-none cursor-pointer"
      >
        {children}
      </select>
      <svg
        className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400"
        width="10" height="6" viewBox="0 0 10 6" fill="none" aria-hidden
      >
        <path d="M1 1l4 4 4-4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
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
    <div
      className="flex flex-col gap-1.5"
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
            className={`group relative flex items-center justify-between gap-2.5 rounded-lg border px-3 py-2 text-left transition-all ${
              active
                ? "border-emerald-500 bg-emerald-50/60 shadow-xs ring-1 ring-emerald-500/30"
                : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/80"
            }`}
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <span
                className="h-3 w-3 shrink-0 rounded-full transition-transform group-hover:scale-110"
                style={{
                  backgroundColor: scenario.color,
                  boxShadow: active ? `0 0 0 3px ${scenario.color}33` : undefined,
                }}
              />
              <div className="min-w-0 flex-1">
                <span
                  className={`block text-[12.5px] leading-tight ${
                    active ? "font-bold text-slate-900" : "font-medium text-slate-700"
                  }`}
                >
                  {scenario.label}
                </span>
                {!compact && (
                  <span className="block text-[11px] leading-tight text-slate-500 mt-0.5 truncate">
                    {scenario.shortLabel} · {scenario.globalWarming2100}
                  </span>
                )}
              </div>
            </div>

            {/* Warming badge */}
            <span
              className="shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold"
              style={{
                backgroundColor: `${scenario.color}18`,
                color: scenario.color,
              }}
            >
              {scenario.globalWarming2100}
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
      className="grid grid-cols-2 gap-1 rounded-lg border border-slate-200 bg-slate-100/70 p-1 shadow-inner"
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
            className={`tnum rounded-md px-2 py-1.5 text-center text-[11.5px] font-semibold transition-all ${
              active
                ? "bg-white text-slate-900 shadow-xs ring-1 ring-slate-200"
                : period.isBaseline
                  ? "text-slate-400 hover:text-slate-700 hover:bg-white/40"
                  : "text-slate-600 hover:text-slate-900 hover:bg-white/50"
            } ${period.isBaseline ? "col-span-2" : ""}`}
          >
            {period.isBaseline ? `Baseline (${period.shortLabel})` : period.shortLabel}
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
          <optgroup key={group.family.id} label={`── ${group.family.label} ──`}>
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
    <Select
      value={value}
      onChange={(next) => onChange(next as ModelId)}
      ariaLabel="Climate model"
    >
      <option value="ensemble-all">
        Multi-model Ensemble Median (30 models)
      </option>
      {mappable.length > 0 && (
        <optgroup label="── Individual Mappable Models ──">
          {mappable.map(option)}
        </optgroup>
      )}
      {unmapped.length > 0 && (
        <optgroup label="── Panel Comparison Only ──">
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
    { id: "anomaly" as const, label: "Relative Change (Δ)", hint: "Difference from 1995–2014 baseline" },
    { id: "climatology" as const, label: "Absolute Value", hint: "Direct absolute physical climatology" },
  ];
  return (
    <div
      className="flex gap-1 rounded-lg border border-slate-200 bg-slate-100/70 p-1 shadow-inner"
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
          className={`flex-1 rounded-md px-2.5 py-1.5 text-[12px] font-semibold transition-all disabled:cursor-not-allowed disabled:opacity-40 ${
            value === option.id
              ? "bg-white text-slate-900 shadow-xs ring-1 ring-slate-200"
              : "text-slate-600 hover:text-slate-900 hover:bg-white/40"
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
      className="flex items-center gap-2.5 text-[12.5px] font-medium text-slate-700 transition-colors hover:text-slate-900 cursor-pointer"
    >
      <span
        className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${
          checked ? "bg-emerald-600" : "bg-slate-300"
        }`}
      >
        <span
          className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow-xs transition-transform ${
            checked ? "translate-x-4.5" : "translate-x-1"
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
        <svg
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
          width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
        >
          <circle cx="11" cy="11" r="8" />
          <path d="m21 21-4.3-4.3" />
        </svg>
        <input
          type="search"
          value={query}
          placeholder="Search city, region or province…"
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
          className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-8 text-[13px] font-medium text-slate-900 placeholder:text-slate-400 shadow-xs transition-all hover:border-slate-300 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20 focus:outline-none"
        />
        {query && (
          <button
            type="button"
            onClick={() => {
              setQuery("");
              setOpen(false);
            }}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
          >
            ✕
          </button>
        )}
      </div>

      {open && matches.length > 0 && (
        <ul className="absolute z-30 mt-1.5 max-h-64 w-full overflow-auto rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
          {matches.map((place, index) => (
            <li key={place.id}>
              <button
                type="button"
                onClick={() => choose(place)}
                onMouseEnter={() => setHighlighted(index)}
                className={`flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-[13px] transition-colors ${
                  index === highlighted ? "bg-emerald-50 text-emerald-900 font-semibold" : "text-slate-700 hover:bg-slate-50"
                }`}
              >
                <span className="font-medium text-slate-900">{place.name}</span>
                <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10.5px] font-medium text-slate-500">
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
