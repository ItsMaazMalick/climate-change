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
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <header className="mb-9 max-w-3xl">
        <div className="inline-flex items-center gap-2 rounded-(--radius-pill) border border-leaf bg-leaf-soft px-3.5 py-1 text-[12.5px] font-semibold text-brand-deep mb-3 shadow-(--elevation-flat)">
          <span>{config.flag}</span>
          <span>Regional Climate Profiles · {config.name}</span>
        </div>
        <h1 className="text-3xl font-semibold tracking-tight text-ink">
          City & Regional Climate Profiles
        </h1>
        <p className="mt-2 text-[14px] leading-relaxed text-ink-muted font-medium">
          {country === "PAK"
            ? "Pakistan contains one of the steepest climate gradients on Earth — from sea level on the Arabian Sea coast to above 8,000 metres in the Karakoram. Places are grouped by physical eco-zone."
            : "Uzbekistan spans diverse Central Asian climatic settings: from the arid Kyzylkum desert and Aral basin to the fertile irrigated Fergana Valley and Tien Shan foothill oases."}
        </p>

        {/* Quick Country Switcher Tabs */}
        <div className="mt-5 flex gap-2">
          <button
            type="button"
            onClick={() => setCountry("UZB")}
            className={`rounded-(--radius-container) px-4 py-2 text-xs font-semibold transition-all shadow-(--elevation-flat) ${
 country === "UZB"
                ? "bg-brand text-white shadow-(--elevation-raised) ring-2 ring-leaf/30"
                : "border border-border bg-surface-panel text-ink-muted hover:border-border-strong hover:bg-surface-recessed"
            }`}
          >
            🇺🇿 Uzbekistan ({PLACES.filter((p) => p.country === "UZB").length} cities)
          </button>
          <button
            type="button"
            onClick={() => setCountry("PAK")}
            className={`rounded-(--radius-container) px-4 py-2 text-xs font-semibold transition-all shadow-(--elevation-flat) ${
 country === "PAK"
                ? "bg-brand text-white shadow-(--elevation-raised) ring-2 ring-leaf/30"
                : "border border-border bg-surface-panel text-ink-muted hover:border-border-strong hover:bg-surface-recessed"
            }`}
          >
            🇵🇰 Pakistan ({PLACES.filter((p) => p.country === "PAK").length} cities)
          </button>
        </div>
      </header>

      <div className="space-y-10">
        {groups.map(([setting, placesList]) => (
          <section key={setting}>
            <div className="flex items-center gap-2 mb-4">
              <span className="h-2 w-2 rounded-(--radius-pill) bg-brand"></span>
              <h2 className="text-[15px] font-semibold uppercase tracking-wider text-ink-muted">
                {SETTING_LABELS[setting] ?? setting}
              </h2>
            </div>
            <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
              {placesList
                .sort((a, b) => b.population - a.population)
                .map((place) => (
                  <Link
                    key={place.id}
                    href={`/places/${place.id}`}
                    className="tier-raised group p-5 transition-all motion-panel hover:-translate-y-1 hover:shadow-(--elevation-raised-hover)"
                  >
                    <div className="flex items-baseline justify-between gap-2">
                      <h3 className="text-[16px] font-semibold text-ink group-hover:text-brand transition-colors">
                        {place.name}
                      </h3>
                      <span className="tnum shrink-0 rounded bg-surface-active px-1.5 py-0.5 text-[11px] font-semibold text-ink-muted">
                        {place.elevation.toLocaleString()} m
                      </span>
                    </div>
                    <p className="mt-1 text-[12px] font-medium text-ink-faint">
                      {place.province} · {place.country === "PAK" ? "Pakistan" : "Uzbekistan"}
                    </p>
                    {place.note && (
                      <p className="mt-3 text-[12.5px] leading-relaxed text-ink-muted line-clamp-3">
                        {place.note}
                      </p>
                    )}
                    <div className="mt-4 flex items-center gap-1 text-[12px] font-semibold text-brand opacity-0 group-hover:opacity-100 transition-opacity">
                      <span>Explore climate story</span>
                      <span>→</span>
                    </div>
                  </Link>
                ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
