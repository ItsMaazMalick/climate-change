"use client";

import { useMemo, useState } from "react";
import { ChevronRight, Info, MapPin } from "lucide-react";

import {
  Field,
  IndicatorPicker,
  ModelPicker,
  PeriodPicker,
  PlaceSearch,
  ProductToggle,
  ScenarioPicker,
  Toggle,
} from "@/components/controls";
import { LocationPanel } from "@/components/location-panel";
import { ClimateMap, type RegionData } from "@/components/map/climate-map";
import { Legend } from "@/components/map/legend";
import type { GeoCollection } from "@/components/map/projection";
import { isInsideCountryBounds } from "@/lib/climate/countries";
import { scenarioColorVar } from "@/lib/climate/scenario-style";
import type { Place } from "@/lib/climate/places";
import {
  displayUnit,
  INDICATORS,
  PERIODS,
  SCENARIOS,
  type ModelId,
  type PeriodId,
  type ScenarioId,
} from "@/lib/climate/taxonomy";
import { useApi, useStaticJson, useUrlState } from "@/lib/hooks";

import { useCountry } from "@/lib/country-context";

const REGIONS_BY_COUNTRY: Record<string, Array<{ id: string; name: string }>> = {
  PAK: [
    { id: "punjab", name: "Punjab" },
    { id: "sindh", name: "Sindh" },
    { id: "khyber-pakhtunkhwa", name: "Khyber Pakhtunkhwa" },
    { id: "balochistan", name: "Balochistan" },
    { id: "gilgit-baltistan", name: "Gilgit-Baltistan" },
    { id: "azad-jammu-kashmir", name: "Azad Kashmir" },
    { id: "islamabad", name: "Islamabad" },
  ],
  UZB: [
    { id: "tashkent-city", name: "Tashkent City" },
    { id: "tashkent-region", name: "Tashkent" },
    { id: "samarkand", name: "Samarkand" },
    { id: "bukhara", name: "Bukhara" },
    { id: "karakalpakstan", name: "Karakalpakstan" },
    { id: "andijan", name: "Andijan" },
    { id: "fergana", name: "Fergana" },
    { id: "namangan", name: "Namangan" },
    { id: "qashqadaryo", name: "Qashqadaryo" },
    { id: "surxondaryo", name: "Surxondaryo" },
    { id: "khorezm", name: "Khorezm" },
    { id: "navoiy", name: "Navoiy" },
    { id: "jizzakh", name: "Jizzakh" },
    { id: "sirdaryo", name: "Sirdaryo" },
  ],
  AUS: [
    { id: "nsw", name: "New South Wales" },
    { id: "vic", name: "Victoria" },
    { id: "qld", name: "Queensland" },
    { id: "sa", name: "South Australia" },
    { id: "wa", name: "Western Australia" },
    { id: "tas", name: "Tasmania" },
    { id: "nt", name: "Northern Territory" },
    { id: "act", name: "ACT" },
  ],
  NZL: [
    { id: "northland", name: "Northland" },
    { id: "auckland", name: "Auckland" },
    { id: "waikato", name: "Waikato" },
    { id: "bay-of-plenty", name: "Bay of Plenty" },
    { id: "wellington", name: "Wellington" },
    { id: "canterbury", name: "Canterbury" },
    { id: "otago", name: "Otago" },
    { id: "southland", name: "Southland" },
    { id: "west-coast", name: "West Coast" },
    { id: "marlborough", name: "Marlborough" },
  ],
};

interface MetaResponse {
  coverage: {
    grid: {
      models: string[];
      variables: string[];
      perModelVariables: string[];
    };
  };
}

/**
 * The main explorer.
 *
 * State lives in the URL, so every view a reader reaches is a link they can
 * send to someone else — which for a platform whose whole purpose is to make
 * a contested subject legible is not a convenience feature.
 */
export function Explorer({ places }: { places: Place[] }) {
  const { country: countryCode, config } = useCountry();
  const [state, setState] = useUrlState({
    indicator: "tas",
    scenario: "ssp245",
    period: "2040-2059",
    model: "ensemble-all",
    product: "anomaly",
    lat: "",
    lon: "",
    area: "",
    // Which administrative level the choropleth resolves to. In the URL with
    // everything else, so a district-level view is a link someone can send.
    level: "1",
  });

  const showDistricts = state.level === "2";
  const setShowDistricts = (next: boolean) =>
    setState({ level: next ? "2" : "1" });

  // What the local grid actually holds. Used to signpost the controls rather
  // than let a reader pick a combination that will fail.
  const meta = useApi<MetaResponse>("/api/meta");
  const gridModels = meta.data?.coverage.grid.models;
  const perModelVariables = meta.data?.coverage.grid.perModelVariables ?? [];

  const indicator = state.indicator;
  const scenario = state.scenario as ScenarioId;
  const period = state.period as PeriodId;
  const model = state.model as ModelId;
  const isBaseline = period === "1995-2014";
  const product = (isBaseline ? "climatology" : state.product) as "anomaly" | "climatology";

  // ---- geography (static, loaded per country) ---------------------------
  const country = useStaticJson<GeoCollection>(config.geoFiles.country);
  // The polygons painted by the choropleth, at whichever level is selected.
  const regionPolygons = useStaticJson<GeoCollection>(
    showDistricts ? config.geoFiles.level2 : config.geoFiles.level1,
  );

  // Filter places for active country
  const countryPlaces = useMemo(
    () => places.filter((place) => place.country === countryCode),
    [places, countryCode],
  );

  // The country's capital — the target every country switch resets to (D5).
  const capital = useMemo(
    () =>
      countryPlaces.find((p) => p.id === config.defaultCityId) ??
      countryPlaces[0] ??
      null,
    [countryPlaces, config.defaultCityId],
  );

  // On a country switch — or an initial coordinate that lands outside the
  // active country's bounding box — move the target to that country's capital.
  // A stale coordinate must never be handed to the point API as if it were a
  // location in the new country (D5). Reconciled during render, matching the
  // pattern in compare-panel.
  const [syncedCountry, setSyncedCountry] = useState(countryCode);
  const hasCoord = Boolean(state.lat && state.lon);
  const coordOutside =
    hasCoord &&
    !isInsideCountryBounds(Number(state.lat), Number(state.lon), countryCode);
  if (syncedCountry !== countryCode || coordOutside) {
    setSyncedCountry(countryCode);
    if (capital) {
      setState({ lat: String(capital.lat), lon: String(capital.lon), area: "" });
    } else if (coordOutside) {
      setState({ lat: "", lon: "", area: "" });
    }
  }

  // ---- the choropleth ---------------------------------------------------
  //
  // One request returns a value for every administrative unit in the country.
  // The map paints the official boundary polygons directly, so the data has no
  // geometry of its own that could drift out of alignment with the basemap.
  const level = showDistricts ? 2 : 1;
  const regionsUrl =
    `/api/climate/regions?country=${countryCode}&level=${level}` +
    `&indicator=${indicator}&scenario=${scenario}` +
    `&period=${period}&model=${model}&product=${product}`;
  const field = useApi<RegionData>(regionsUrl);

  const selection = useMemo(() => {
    const lat = Number(state.lat);
    const lon = Number(state.lon);
    if (Number.isFinite(lat) && Number.isFinite(lon) && state.lat && state.lon) {
      return { lat, lon };
    }
    return null;
  }, [state.lat, state.lon]);

  // A region counts as contested when models disagree on the *sign* of the
  // change across most of the cells inside it.
  const hasDisagreement = useMemo(
    () =>
      field.data?.regions.some(
        (region) => region.agreement !== null && region.agreement < 0.5,
      ) ?? false,
    [field.data],
  );

  return (
    <div className="flex h-[calc(100vh-3.5rem)] flex-col bg-surface-recessed text-ink lg:flex-row">
      {/* ------------------------------------------------ controls ---- */}
      <aside className="w-full shrink-0 overflow-y-auto scrollbar-gutter-stable border-b border-border bg-surface-panel lg:w-77 lg:border-b-0 lg:border-r">
        <div className="space-y-6 p-4 pb-16">
          <fieldset data-tour="where" className="space-y-3">
            <legend className="label mb-1">Where</legend>
            <Field label="Location">
              <PlaceSearch
                places={countryPlaces}
                onSelect={(place) =>
                  setState({ lat: String(place.lat), lon: String(place.lon), area: "" })
                }
              />
            </Field>
            <Field label={config.adminLevels.level1.split(" ")[0] ?? "Region"}>
              <div className="flex flex-wrap gap-1.5">
                <ChipButton
                  active={!state.area}
                  onClick={() => setState({ area: "" })}
                  label="All regions"
                />
                {(REGIONS_BY_COUNTRY[countryCode] ?? []).map((region) => (
                  <ChipButton
                    key={region.id}
                    active={state.area === region.id}
                    onClick={() =>
                      setState({
                        area: state.area === region.id ? "" : region.id,
                        lat: "",
                        lon: "",
                      })
                    }
                    label={region.name}
                  />
                ))}
              </div>
            </Field>
          </fieldset>

          <fieldset className="space-y-3">
            <legend className="label mb-1">What</legend>
            <Field
              label="Climate indicator"
              hint="Scientific variables downscaled from CMIP6 multi-model ensembles."
            >
              <IndicatorPicker
                value={indicator}
                onChange={(next) => setState({ indicator: next })}
                griddedOnly
              />
            </Field>
          </fieldset>

          <fieldset data-tour="which-future" className="space-y-3">
            <legend className="label mb-1">Which future</legend>
            <Field
              label="Emissions pathway (SSP)"
              hint="Shared Socioeconomic Pathways are physical forcing scenarios, not predictions."
            >
              <ScenarioPicker
                value={scenario}
                onChange={(next) => setState({ scenario: next })}
              />
            </Field>
            <Field label="Time horizon">
              <PeriodPicker value={period} onChange={(next) => setState({ period: next })} />
            </Field>
          </fieldset>

          <details className="group rounded-(--radius-container) border border-border bg-surface-recessed">
            <summary className="label flex cursor-pointer list-none items-center justify-between px-3 py-2.5 text-ink-muted [&::-webkit-details-marker]:hidden">
              Advanced
              <ChevronRight className="h-3.5 w-3.5 text-ink-faint transition-transform group-open:rotate-90" />
            </summary>
            <div className="space-y-3 border-t border-border bg-surface-panel p-3">
              <Field
                label="Display mode"
                hint="Change is the anomaly relative to 1995–2014; Absolute shows physical values."
              >
                <ProductToggle
                  value={product}
                  onChange={(next) => setState({ product: next })}
                  disabled={isBaseline}
                />
              </Field>
              <Field
                label="Downscaled GCM model"
                hint="Ensemble median aggregates 30 global climate models to minimise individual model bias."
              >
                <ModelPicker
                  value={model}
                  onChange={(next) => setState({ model: next })}
                  mappableModels={
                    gridModels && perModelVariables.includes(indicator)
                      ? gridModels
                      : gridModels && gridModels.length <= 1
                        ? gridModels
                        : undefined
                  }
                />
                {model !== "ensemble-all" && !perModelVariables.includes(indicator) && (
                  <p className="mt-1.5 text-xs leading-snug text-ink-faint">
                    The map draws the ensemble for {INDICATORS[indicator]?.shortLabel};
                    individual models are available on{" "}
                    <a href="/compare" className="font-medium text-accent underline">
                      Compare
                    </a>
                    .
                  </p>
                )}
              </Field>
              <div className="hairline pt-3">
                <Toggle
                  checked={showDistricts}
                  onChange={setShowDistricts}
                  label={`Resolve by ${config.adminLevels.level2.toLowerCase()}`}
                />
              </div>
            </div>
          </details>
        </div>
      </aside>

      {/* ----------------------------------------------------- map ---- */}
      <div data-tour="map" className="relative min-h-[420px] flex-1 bg-surface-recessed">
        <ClimateMap
          bbox={config.bbox}
          data={field.data ?? null}
          regions={regionPolygons}
          outline={country}
          indicatorId={indicator}
          product={product}
          selection={selection}
          onSelect={(next) =>
            setState({ lat: String(next.lat), lon: String(next.lon) })
          }
          highlightArea={state.area || null}
          loading={field.loading}
        />

        {/* Persistent scenario / epoch context bar — keeps every screenshot self-describing */}
        <div
          className="tier-raised-seam pointer-events-none absolute left-3.5 top-3.5 max-w-[min(100%-4rem,440px)] p-3.5"
          style={{ ["--seam-color" as string]: scenarioColorVar(scenario) }}
        >
          <div className="mb-2 flex flex-wrap items-center gap-1.5">
            <span
              className="rounded-(--radius-control) px-1.5 py-0.5 text-2xs font-semibold tabular-nums"
              data-numeric
              style={{
                color: scenarioColorVar(scenario),
                background: `color-mix(in oklab, ${scenarioColorVar(scenario)} 12%, transparent)`,
                border: `1px solid color-mix(in oklab, ${scenarioColorVar(scenario)} 32%, transparent)`,
              }}
            >
              {SCENARIOS[scenario].label}
            </span>
            <span className="text-2xs text-ink-faint">
              {SCENARIOS[scenario].forcingDescriptor}
            </span>
            <span className="rounded-(--radius-control) border border-border bg-surface-recessed px-1.5 py-0.5 text-2xs font-medium text-ink-muted" data-numeric>
              {PERIODS[period].shortLabel}
            </span>
          </div>
          <p className="text-base font-semibold tracking-tight text-ink">
            {INDICATORS[indicator]?.label}
            {product === "anomaly" && (
              <span className="ml-1.5 text-sm font-normal text-ink-faint">· change vs 1995–2014</span>
            )}
          </p>
          <p className="mt-0.5 text-2xs text-ink-faint" data-numeric>
            {model === "ensemble-all" ? "30-model CMIP6 ensemble median" : model} · 0.25° grid
          </p>
        </div>

        {field.data && (
          <div className="absolute bottom-3.5 right-3.5 w-[280px]">
            <Legend
              min={field.data.stats.p02 ?? field.data.stats.min}
              max={field.data.stats.p98 ?? field.data.stats.max}
              unit={displayUnit(field.data.unit, indicator, product)}
              indicatorId={indicator}
              product={product}
              hasDisagreement={hasDisagreement}
            />
          </div>
        )}

        {field.error && !field.loading && (
          <div className="tier-overlay absolute bottom-3.5 left-3.5 max-w-sm border-l-4 border-danger px-4 py-3 text-xs leading-snug text-ink-muted">
            {field.error}
          </div>
        )}
      </div>

      {/* --------------------------------------------------- panel ---- */}
      <aside className="w-full shrink-0 overflow-y-auto scrollbar-gutter-stable border-t border-border bg-surface-panel lg:w-[380px] lg:border-l lg:border-t-0">
        {/* Quick city shortcuts */}
        <div className="border-b border-border bg-surface-recessed px-4 py-3">
          <p className="label mb-2">Cities · {config.shortName}</p>
          <div className="flex flex-wrap gap-1.5">
            {countryPlaces.slice(0, 7).map((p) => {
              const isActive =
                selection &&
                Math.abs(selection.lat - p.lat) < 0.05 &&
                Math.abs(selection.lon - p.lon) < 0.05;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() =>
                    setState({ lat: String(p.lat), lon: String(p.lon), area: "" })
                  }
                  className={`cursor-pointer rounded-(--radius-control) border px-2.5 py-1 text-xs font-medium transition-colors motion-state ${
                    isActive
                      ? "border-accent bg-accent text-accent-ink"
                      : "border-border bg-surface-panel text-ink-muted hover:bg-surface-hover hover:text-ink"
                  }`}
                >
                  {p.name}
                </button>
              );
            })}
          </div>
        </div>

        {selection ? (
          <LocationPanel
            lat={selection.lat}
            lon={selection.lon}
            indicator={indicator}
            scenario={scenario}
            period={period}
            model={model}
          />
        ) : (
          <EmptyPanel />
        )}
      </aside>
    </div>
  );
}

function ChipButton({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`cursor-pointer rounded-(--radius-control) border px-2.5 py-1 text-xs font-medium transition-colors motion-state ${
        active
          ? "border-accent bg-accent-soft text-accent"
          : "border-border bg-surface-panel text-ink-muted hover:bg-surface-hover hover:text-ink"
      }`}
    >
      {label}
    </button>
  );
}

function EmptyPanel() {
  return (
    <div className="flex h-full flex-col justify-center gap-6 p-6">
      <div>
        <span className="text-ink-faint">
          <MapPin className="h-5 w-5" />
        </span>
        <h2 className="mt-2 text-lg font-semibold text-ink">Pick a location</h2>
        <p className="mt-2 text-sm leading-relaxed text-ink-muted">
          Click anywhere on the map, or choose a city, to read the projected
          change for that point against the 1995–2014 baseline.
        </p>
      </div>

      <div className="space-y-2 border-t border-border pt-4">
        <p className="label flex items-center gap-1.5">
          <Info className="h-3.5 w-3.5" /> What you&rsquo;ll see
        </p>
        <div className="grid gap-2">
          <Note title="Baseline vs projected">
            The historical 20-year average for this point, and the projected value for the chosen horizon.
          </Note>
          <Note title="Model spread">
            Where the 10th–90th percentile of the 30-model ensemble sits — the honest error bar.
          </Note>
          <Note title="Every pathway">
            The same place and horizon under all five SSPs — the gap is the part still up to us.
          </Note>
        </div>
      </div>
    </div>
  );
}

function Note({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="tier-flat p-3">
      <div className="text-xs font-semibold text-ink">{title}</div>
      <p className="mt-1 text-xs leading-relaxed text-ink-faint">{children}</p>
    </div>
  );
}
