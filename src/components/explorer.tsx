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
    return Number.isFinite(lat) && Number.isFinite(lon) && state.lat && state.lon
      ? { lat, lon }
      : null;
  }, [state.lat, state.lon]);

  const hasDisagreement = useMemo(
    () => field.data?.significance?.some((flag) => flag === 2) ?? false,
    [field.data],
  );

  return (
    <div className="flex h-[calc(100vh-3.5rem)] flex-col lg:flex-row">
      {/* ------------------------------------------------ controls ---- */}
      <aside className="w-full shrink-0 overflow-y-auto border-b border-[var(--color-border)] bg-[var(--color-surface)] lg:w-[268px] lg:border-b-0 lg:border-r">
        <div className="space-y-4 p-4">
          <Field label="Location">
            <PlaceSearch
              places={countryPlaces}
              onSelect={(place) =>
                setState({ lat: String(place.lat), lon: String(place.lon), area: "" })
              }
            />
          </Field>

          <Field
            label="Indicator"
            hint="Only indicators extracted to the local grid can be drawn on the map."
          >
            <IndicatorPicker
              value={indicator}
              onChange={(next) => setState({ indicator: next })}
              griddedOnly
            />
          </Field>

          <Field
            label="Emissions pathway"
            hint="A scenario is an assumption about the future, not a forecast. Compare them rather than picking one."
          >
            <ScenarioPicker
              value={scenario}
              onChange={(next) => setState({ scenario: next })}
            />
          </Field>

          <Field label="Period">
            <PeriodPicker value={period} onChange={(next) => setState({ period: next })} />
          </Field>

          <Field
            label="Display"
            hint="Change is the anomaly against 1995–2014; absolute is the value itself."
          >
            <ProductToggle
              value={product}
              onChange={(next) => setState({ product: next })}
              disabled={isBaseline}
            />
          </Field>

          <Field
            label="Model"
            hint="The ensemble median is the default because no single model is the truth."
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
                <p className="mt-1.5 text-[11px] leading-snug text-[var(--color-ink-faint)]">
                  The map draws the ensemble for {INDICATORS[indicator]?.shortLabel};
                  individual models for this indicator are available in the
                  panel and on{" "}
                  <a href="/compare" className="underline">
                    Compare
                  </a>
                  .
                </p>
              )}
          </Field>

          <Field label={config.adminLevels.level1.split(" ")[0] ?? "Region"}>
            <div className="flex flex-wrap gap-1">
              <ChipButton
                active={!state.area}
                onClick={() => setState({ area: "" })}
                label="All"
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
      <div className="relative min-h-[420px] flex-1">
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

        {/* headline banner */}
        <div className="pointer-events-none absolute left-3 top-3 max-w-[min(100%-6rem,380px)] rounded-lg border border-[var(--color-border)] bg-white/95 px-3.5 py-2.5 backdrop-blur">
          <h1 className="text-[13.5px] font-semibold leading-tight">
            {INDICATORS[indicator]?.label}
            {product === "anomaly" && (
              <span className="font-normal text-[var(--color-ink-muted)]">
                {" "}
                — change by {PERIODS[period].shortLabel}
              </span>
            )}
          </h1>
          <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-[var(--color-ink-faint)]">
            <span className="flex items-center gap-1.5">
              <span
                className="inline-block h-2 w-2 rounded-full"
                style={{ background: SCENARIOS[scenario].color }}
              />
              {SCENARIOS[scenario].label}
            </span>
            <span>·</span>
            <span>
              {model === "ensemble-all" ? "Ensemble median" : model}
            </span>
            <span>·</span>
            <span>CMIP6 0.25°</span>
          </p>
        </div>

        {field.data && (
          <div className="absolute bottom-3 right-3 w-[260px]">
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
          <div className="absolute bottom-3 left-3 max-w-sm rounded-lg border border-[var(--color-border)] bg-white/95 px-3 py-2 text-[11.5px] leading-snug text-[var(--color-ink-muted)] backdrop-blur">
            {field.error}
          </div>
        )}
      </div>

      {/* --------------------------------------------------- panel ---- */}
      <aside className="w-full shrink-0 overflow-y-auto border-t border-[var(--color-border)] bg-[var(--color-surface)] lg:w-[352px] lg:border-l lg:border-t-0">
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
      className={`rounded border px-1.5 py-1 text-[10.5px] transition-colors ${
        active
          ? "border-[var(--color-brand)] bg-[var(--color-brand-tint)] font-medium text-[var(--color-brand-deep)]"
          : "border-[var(--color-border)] text-[var(--color-ink-muted)] hover:border-[var(--color-border-strong)] hover:text-[var(--color-ink)]"
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
