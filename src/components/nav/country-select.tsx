"use client";

import { ChevronDown } from "lucide-react";

import { COUNTRIES, COUNTRY_CODES, type CountryCode } from "@/lib/climate/countries";
import { useCountry } from "@/lib/country-context";

/**
 * The one and only country selector. A native <select> for the control
 * semantics (keyboard, screen reader, mobile), with the flag rendered
 * alongside. Selection drives every default, bounding box and copy string and
 * is mirrored to `?country=` and localStorage by the provider.
 */
export function CountrySelect() {
  const { country, config, setCountry } = useCountry();

  return (
    <label className="relative inline-flex items-center gap-2 rounded-(--radius-control) border border-border bg-surface-panel py-1.5 pl-2.5 pr-2 text-sm shadow-[var(--elevation-flat)] transition-colors hover:bg-surface-hover focus-within:shadow-[var(--focus-ring)]">
      <span aria-hidden className="text-base leading-none">
        {config.flag}
      </span>
      <span className="sr-only">Active country</span>
      <select
        value={country}
        onChange={(e) => setCountry(e.target.value as CountryCode)}
        className="cursor-pointer appearance-none bg-transparent pr-4 font-medium text-ink outline-none"
      >
        {COUNTRY_CODES.map((code) => (
          <option key={code} value={code}>
            {COUNTRIES[code].name}
          </option>
        ))}
      </select>
      <ChevronDown aria-hidden className="pointer-events-none absolute right-2 h-3.5 w-3.5 text-ink-faint" />
    </label>
  );
}
