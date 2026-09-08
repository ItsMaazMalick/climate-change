"use client";

import { useMemo, useState } from "react";

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
import { ClimateMap, type FieldData } from "@/components/map/climate-map";
import { Legend } from "@/components/map/legend";
import type { GeoCollection } from "@/components/map/projection";
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
  });

  const [showDistricts, setShowDistricts] = useState(false);

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
  const provinces = useStaticJson<GeoCollection>(config.geoFiles.level1);
  const districts = useStaticJson<GeoCollection>(
    showDistricts ? config.geoFiles.level2 : config.geoFiles.country,
  );

  // Filter places for active country
  const countryPlaces = useMemo(
    () => places.filter((place) => place.country === countryCode),
    [places, countryCode],
  );

  // ---- the map field ----------------------------------------------------
  const fieldUrl =
    `/api/climate/field?indicator=${indicator}&scenario=${scenario}` +
    `&period=${period}&model=${model}&product=${product}&country=${countryCode}`;
  const field = useApi<FieldData & { indicator: typeof INDICATORS[string] }>(fieldUrl);

  const selection = useMemo(() => {
    const lat = Number(state.lat);
    const lon = Number(state.lon);
    if (Number.isFinite(lat) && Number.isFinite(lon) && state.lat && state.lon) {
      return { lat, lon };
    }
    // Default to country capital on initial load
    if (countryCode === "UZB") {
      return { lat: 41.2995, lon: 69.2401 }; // Tashkent
    }
    if (countryCode === "AUS") {
      return { lat: -35.2809, lon: 149.1300 }; // Canberra
    }
    if (countryCode === "NZL") {
      return { lat: -41.2865, lon: 174.7762 }; // Wellington
    }
    return { lat: 33.6844, lon: 73.0479 }; // Islamabad
  }, [state.lat, state.lon, countryCode]);

  const hasDisagreement = useMemo(
    () => field.data?.significance?.some((flag) => flag === 2) ?? false,
    [field.data],
  );

  return (
    <div className="flex h-[calc(100vh-3.5rem)] flex-col lg:flex-row bg-slate-50 text-slate-900">
      {/* ------------------------------------------------ controls ---- */}
      <aside className="w-full shrink-0 overflow-y-auto border-b border-slate-200 bg-white/90 backdrop-blur-xl lg:w-[290px] lg:border-b-0 lg:border-r shadow-xs">
        <div className="space-y-4 p-4">
          <Field label="Target Coordinate / City">
            <PlaceSearch
              places={countryPlaces}
              onSelect={(place) =>
                setState({ lat: String(place.lat), lon: String(place.lon), area: "" })
              }
            />
          </Field>

          <Field
            label="Climate Indicator"
            hint="Scientific variables downscaled from CMIP6 multi-model ensembles."
          >
            <IndicatorPicker
              value={indicator}
              onChange={(next) => setState({ indicator: next })}
              griddedOnly
            />
          </Field>

          <Field
            label="Emissions Pathway (SSP)"
            hint="Shared Socioeconomic Pathways represent different global climate policy futures."
          >
            <ScenarioPicker
              value={scenario}
              onChange={(next) => setState({ scenario: next })}
            />
          </Field>

          <Field label="Time Horizon">
            <PeriodPicker value={period} onChange={(next) => setState({ period: next })} />
          </Field>

          <Field
            label="Display Mode"
            hint="Change is the anomaly relative to 1995–2014; Absolute shows physical values."
          >
            <ProductToggle
              value={product}
              onChange={(next) => setState({ product: next })}
              disabled={isBaseline}
            />
          </Field>

          <Field
            label="Downscaled GCM Model"
            hint="Ensemble median aggregates 30 global climate models to minimize individual model bias."
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
            {model !== "ensemble-all" &&
              !perModelVariables.includes(indicator) && (
                <p className="mt-1.5 text-[11px] leading-snug text-slate-500">
                  The map draws the ensemble for {INDICATORS[indicator]?.shortLabel};
                  individual models are available on{" "}
                  <a href="/compare" className="text-emerald-700 underline font-semibold">
                    Compare
                  </a>
                  .
                </p>
              )}
          </Field>

          <Field label={config.adminLevels.level1.split(" ")[0] ?? "Region"}>
            <div className="flex flex-wrap gap-1.5">
              <ChipButton
                active={!state.area}
                onClick={() => setState({ area: "" })}
                label="All Regions"
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

          <div className="hairline pt-3">
            <Toggle
              checked={showDistricts}
              onChange={setShowDistricts}
              label={`Show ${config.adminLevels.level2.toLowerCase()} boundaries`}
            />
          </div>
        </div>
      </aside>

      {/* ----------------------------------------------------- map ---- */}
      <div className="relative min-h-[420px] flex-1 bg-slate-100">
        <ClimateMap
          bbox={config.bbox}
          field={field.data ?? null}
          indicatorId={indicator}
          product={product}
          boundaries={{
            country: country ?? undefined,
            provinces: provinces ?? undefined,
            districts: showDistricts ? districts ?? undefined : undefined,
          }}
          selection={selection}
          onSelect={(next) =>
            setState({ lat: String(next.lat), lon: String(next.lon) })
          }
          highlightArea={state.area || null}
          showDistricts={showDistricts}
          loading={field.loading}
        />

        {/* Floating Light HUD Card */}
        <div className="pointer-events-none absolute left-3.5 top-3.5 max-w-[min(100%-4rem,440px)] rounded-2xl border border-slate-200/90 bg-white/95 p-4 backdrop-blur-xl shadow-lg ring-1 ring-slate-100">
          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
            <span
              className="inline-block h-2.5 w-2.5 rounded-full shadow-xs"
              style={{
                background: SCENARIOS[scenario].color,
              }}
            />
            <span
              className="rounded-md px-2 py-0.5 text-[11px] font-mono font-bold"
              style={{
                backgroundColor: `${SCENARIOS[scenario].color}18`,
                color: SCENARIOS[scenario].color,
                border: `1px solid ${SCENARIOS[scenario].color}35`,
              }}
            >
              {SCENARIOS[scenario].label} · {SCENARIOS[scenario].globalWarming2100}
            </span>
            <span className="rounded-md bg-slate-100 border border-slate-200 px-2 py-0.5 text-[11px] font-mono font-bold text-slate-700">
              {PERIODS[period].shortLabel}
            </span>
          </div>
          <h1 className="text-[15px] font-extrabold text-slate-900 tracking-tight leading-tight">
            {INDICATORS[indicator]?.label}
            {product === "anomaly" && (
              <span className="font-semibold text-emerald-700 ml-1.5">
                (Relative Change Δ)
              </span>
            )}
          </h1>
          <p className="mt-1 text-[11px] font-mono text-slate-500">
            {model === "ensemble-all" ? "30-Model CMIP6 Ensemble Median" : model} · 0.25° Spatial Grid
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
          <div className="absolute bottom-3.5 left-3.5 max-w-sm rounded-2xl border border-rose-200 bg-white px-4 py-3 text-[12px] leading-snug text-rose-700 backdrop-blur-xl shadow-lg">
            ⚠️ {field.error}
          </div>
        )}
      </div>

      {/* --------------------------------------------------- panel ---- */}
      <aside className="w-full shrink-0 overflow-y-auto border-t border-slate-200 bg-white/90 backdrop-blur-xl lg:w-[380px] lg:border-l lg:border-t-0 shadow-xs">
        {/* Quick city pill shortcuts */}
        <div className="border-b border-slate-200 bg-slate-50/80 px-4 py-3">
          <div className="text-[10px] font-mono font-extrabold uppercase tracking-widest text-slate-500 mb-2 flex items-center justify-between">
            <span>CITY ORBIT ({config.shortName})</span>
            <span className="text-emerald-700 font-bold">1-CLICK</span>
          </div>
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
                  className={`rounded-lg px-2.5 py-1 text-[11.5px] font-bold transition-all cursor-pointer ${
                    isActive
                      ? "bg-emerald-600 text-white shadow-xs ring-1 ring-emerald-700"
                      : "bg-white border border-slate-200 text-slate-700 hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-800"
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
      className={`rounded-lg border px-2.5 py-1 text-[11px] font-bold transition-all cursor-pointer ${
        active
          ? "border-emerald-300 bg-emerald-50 text-emerald-800 shadow-xs ring-1 ring-emerald-400"
          : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900"
      }`}
    >
      {label}
    </button>
  );
}

function EmptyPanel() {
  return (
    <div className="flex h-full flex-col justify-center gap-5 p-6">
      <div>
        <h2 className="text-[15px] font-semibold">Select a location</h2>
        <p className="mt-1.5 text-[12.5px] leading-relaxed text-[var(--color-ink-muted)]">
          Click anywhere on the map, or search for a city, to see the baseline
          climate, the projected change, how much the models disagree, and how
          the answer differs across emissions pathways.
        </p>
      </div>

      <div className="space-y-2.5 border-t border-[var(--color-border)] pt-5">
        <h3 className="label">What you are looking at</h3>
        <Note title="Not a forecast">
          These are climate projections: 20-year averages under an assumed
          emissions pathway. They say nothing about a particular year, season
          or day.
        </Note>
        <Note title="Not one model">
          The default is the median of 30 downscaled global models. Individual
          models disagree, sometimes substantially, and that disagreement is
          shown rather than averaged away.
        </Note>
        <Note title="Climate variables, not impacts">
          The platform reports temperature, rainfall and threshold days. It
          does not claim to predict floods, crop failures or mortality — those
          need impact models it does not have.
        </Note>
      </div>
    </div>
  );
}

function Note({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface-raised)] p-2.5">
      <div className="text-[11.5px] font-semibold">{title}</div>
      <p className="mt-0.5 text-[11.5px] leading-relaxed text-[var(--color-ink-muted)]">
        {children}
      </p>
    </div>
  );
}
