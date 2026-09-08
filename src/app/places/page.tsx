"use client";

import Link from "next/link";
import { useCountry } from "@/lib/country-context";
import { PLACES } from "@/lib/climate/places";

const SETTING_LABELS: Record<string, string> = {
  coastal: "Coastal",
  "arid-lowland": "Arid Lowland & Desert Steppe",
  "irrigated-plain": "Irrigated Plain & River Basin",
  foothill: "Foothill & Mountain Gateway",
  mountain: "High Mountain & Cryosphere",
  plateau: "High Plateau",
};

export default function PlacesPage() {
  const { country, config, setCountry } = useCountry();
  const countryPlaces = PLACES.filter((place) => place.country === country);

  const groups = Object.entries(
    countryPlaces.reduce<Record<string, typeof PLACES>>((accumulator, place) => {
      (accumulator[place.setting] ??= []).push(place);
      return accumulator;
    }, {}),
  ).sort(([a], [b]) => a.localeCompare(b));

  return (
    <div className="mx-auto max-w-5xl px-5 py-10">
      <header className="mb-9 max-w-2xl">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-2xl">{config.flag}</span>
          <h1 className="text-2xl font-semibold tracking-tight">
            Places — {config.name}
          </h1>
        </div>
        <p className="mt-2 text-[14px] leading-relaxed text-[var(--color-ink-muted)]">
          {country === "PAK"
            ? "Pakistan contains one of the steepest climate gradients of any country — from sea level on the Makran coast to above 8,000 metres in the Karakoram. Places are grouped by climate setting rather than administrative boundary."
            : "Uzbekistan encompasses diverse Central Asian climatic eco-zones: from the desiccated Aral Sea basin and Kyzylkum desert to the irrigated Fergana Valley and Tien Shan foothill oases. Places are grouped by physical setting."}
        </p>

        {/* Quick Country Switcher Tabs */}
        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={() => setCountry("PAK")}
            className={`rounded-md px-3 py-1.5 text-xs font-medium transition-all ${
              country === "PAK"
                ? "bg-[var(--color-brand-deep)] text-white shadow-xs"
                : "border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-ink-muted)] hover:text-[var(--color-ink)]"
            }`}
          >
            🇵🇰 Pakistan ({PLACES.filter((p) => p.country === "PAK").length} cities)
          </button>
          <button
            type="button"
            onClick={() => setCountry("UZB")}
            className={`rounded-md px-3 py-1.5 text-xs font-medium transition-all ${
              country === "UZB"
                ? "bg-[var(--color-brand-deep)] text-white shadow-xs"
                : "border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-ink-muted)] hover:text-[var(--color-ink)]"
            }`}
          >
            🇺🇿 Uzbekistan ({PLACES.filter((p) => p.country === "UZB").length} cities)
          </button>
        </div>
      </header>

      <div className="space-y-9">
        {groups.map(([setting, placesList]) => (
          <section key={setting}>
            <h2 className="label mb-3 font-semibold text-[var(--color-ink-muted)]">
              {SETTING_LABELS[setting] ?? setting}
            </h2>
            <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
              {placesList
                .sort((a, b) => b.population - a.population)
                .map((place) => (
                  <Link
                    key={place.id}
                    href={`/places/${place.id}`}
                    className="group rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-3.5 transition-colors hover:border-[var(--color-brand-deep)] hover:bg-[var(--color-surface-raised)]"
                  >
                    <div className="flex items-baseline justify-between gap-2">
                      <h3 className="text-[14px] font-semibold group-hover:text-[var(--color-brand-deep)]">
                        {place.name}
                      </h3>
                      <span className="tnum shrink-0 text-[10.5px] text-[var(--color-ink-faint)]">
                        {place.elevation.toLocaleString()} m
                      </span>
                    </div>
                    <p className="mt-0.5 text-[11px] text-[var(--color-ink-faint)]">
                      {place.province} · {place.country === "PAK" ? "Pakistan" : "Uzbekistan"}
                    </p>
                    {place.note && (
                      <p className="mt-2 text-[11.5px] leading-relaxed text-[var(--color-ink-muted)] line-clamp-3">
                        {place.note}
                      </p>
                    )}
                  </Link>
                ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
