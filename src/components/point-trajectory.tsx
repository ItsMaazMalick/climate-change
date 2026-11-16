"use client";

import { useMemo } from "react";
import { MapPin } from "lucide-react";

import { TimeSeriesChart, type SeriesLine } from "@/components/charts/time-series";
import { Field, IndicatorPicker } from "@/components/controls";
import { ClimateMap, type RegionData } from "@/components/map/climate-map";
import { Legend } from "@/components/map/legend";
import type { GeoCollection } from "@/components/map/projection";
import { ErrorState } from "@/components/ui/states";
import { getCountry } from "@/lib/climate/countries";
import type { Place } from "@/lib/climate/places";
import { displayUnit, formatValue, INDICATORS } from "@/lib/climate/taxonomy";
import { useApi, useStaticJson, useUrlState } from "@/lib/hooks";

const PAK = getCountry("PAK");

/** The map is coloured with one fixed, legible view: end-of-century change. */
const MAP_SCENARIO = "ssp245";
const MAP_PERIOD = "2080-2099";

interface PathPoint {
  year: number;
  period: string;
  periodLabel: string;
  delta: number | null;
  value: number | null;
}

interface PathResponse {
  location: {
    lat: number;
    lon: number;
    nearestPlace: { id: string; name: string; distanceKm: number } | null;
  };
  indicator: { id: string; label: string };
  unit: string;
  baseline: { value: number | null; period: string } | null;
  available: boolean;
  lines: Array<{ id: string; label: string; color: string; points: PathPoint[] }>;
}

/**
 * Click Pakistan, read the century.
 *
 * The map picks a coordinate; one request returns that coordinate's value for
 * every emissions pathway in every 20-year window to 2099. The chart is the
 * existing multi-scenario time series, so hover, legend-focus and the
 * all-pathways tooltip behave exactly as they do elsewhere in the product.
 */
export function PointTrajectory({ places }: { places: Place[] }) {
  const [state, setState] = useUrlState({
    indicator: "tas",
    lat: "",
    lon: "",
    // "absolute" plots the value itself; "change" plots the difference from
    // the 1995–2014 baseline, which is where the pathways separate most.
    view: "absolute",
  });

  const pakPlaces = useMemo(
    () => places.filter((place) => place.country === "PAK"),
    [places],
  );

  const selection = useMemo(() => {
    const lat = Number(state.lat);
    const lon = Number(state.lon);
    return state.lat && state.lon && Number.isFinite(lat) && Number.isFinite(lon)
      ? { lat, lon }
      : null;
  }, [state.lat, state.lon]);

  // ---- the map -----------------------------------------------------------
  const country = useStaticJson<GeoCollection>(PAK.geoFiles.country);
  const districts = useStaticJson<GeoCollection>(PAK.geoFiles.level2);
  const field = useApi<RegionData>(
    `/api/climate/regions?country=PAK&level=2&indicator=${state.indicator}` +
      `&scenario=${MAP_SCENARIO}&period=${MAP_PERIOD}&model=ensemble-all&product=anomaly`,
  );

  // ---- the path at the clicked point -------------------------------------
  const path = useApi<PathResponse>(
    selection
      ? `/api/climate/path?lat=${selection.lat}&lon=${selection.lon}&indicator=${state.indicator}`
      : null,
  );

  const indicator = INDICATORS[state.indicator];
  const showChange = state.view === "change";
  const product = showChange ? "anomaly" : "climatology";

  const lines: SeriesLine[] = useMemo(
    () =>
      (path.data?.lines ?? []).map((line) => ({
        id: line.id,
        label: line.label,
        color: line.color,
        points: line.points.map((p) => ({
          year: p.year,
          value: showChange ? p.delta : p.value,
        })),
      })),
    [path.data, showChange],
  );

  const unit = displayUnit(path.data?.unit ?? indicator?.unit ?? "", state.indicator, product);

  return (
    <div className="flex h-[calc(100vh-3.5rem)] flex-col bg-surface-recessed text-ink lg:flex-row">
      {/* ----------------------------------------------------------- map -- */}
      <div className="relative min-h-[440px] flex-1">
        <ClimateMap
          bbox={PAK.bbox}
          data={field.data ?? null}
          regions={districts}
          outline={country}
          indicatorId={state.indicator}
          product="anomaly"
          selection={selection}
          onSelect={(next) => setState({ lat: String(next.lat), lon: String(next.lon) })}
          loading={field.loading}
        />

        <div className="tier-raised-seam pointer-events-none absolute left-3.5 top-3.5 max-w-[min(100%-4rem,340px)] p-3.5">
          <p className="label">Map shows</p>
          <p className="mt-1 text-[13px] font-semibold leading-snug">
            {indicator?.label} change by district, 2080–2099 · SSP2-4.5
          </p>
          <p className="mt-1 text-xs text-ink-muted">
            Click anywhere in Pakistan to chart that point to 2100.
          </p>
        </div>

        {field.data && (
          <div className="absolute bottom-3.5 right-3.5 w-[280px]">
            <Legend
              values={field.data.regions.map((r) => r.value)}
              unit={displayUnit(field.data.unit, state.indicator, "anomaly")}
              indicatorId={state.indicator}
              product="anomaly"
            />
          </div>
        )}
      </div>

      {/* --------------------------------------------------------- chart -- */}
      <aside className="w-full shrink-0 overflow-y-auto border-t border-border bg-surface-panel lg:w-[520px] lg:border-l lg:border-t-0">
        <div className="space-y-5 p-4 pb-16">
          <header>
            <p className="label">Point projection</p>
            <h1 className="mt-1 text-xl font-semibold tracking-tight">
              {indicator?.label ?? "Climate"} to 2100
            </h1>
          </header>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Climate indicator">
              <IndicatorPicker
                value={state.indicator}
                onChange={(next) => setState({ indicator: next })}
                griddedOnly
              />
            </Field>
            <Field label="Jump to a city">
              <select
                aria-label="Jump to a city"
                value=""
                onChange={(event) => {
                  const place = pakPlaces.find((p) => p.id === event.target.value);
                  if (place) setState({ lat: String(place.lat), lon: String(place.lon) });
                }}
                className="w-full rounded-(--radius-control) border border-border bg-surface-raised px-2.5 py-2 text-sm"
              >
                <option value="">Choose…</option>
                {pakPlaces.map((place) => (
                  <option key={place.id} value={place.id}>
                    {place.name}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          {!selection && (
            <div className="rounded-(--radius-container) border border-dashed border-border px-4 py-10 text-center">
              <MapPin className="mx-auto h-6 w-6 text-ink-faint" />
              <p className="mt-2 text-sm font-medium">No location selected</p>
              <p className="mt-1 text-xs text-ink-muted">
                Click the map or pick a city to see how this indicator could change under
                each emissions pathway.
              </p>
            </div>
          )}

          {selection && path.loading && (
            <p className="py-10 text-center text-sm text-ink-muted" role="status">
              Fetching CMIP6 projections for {selection.lat.toFixed(2)}°N,{" "}
              {selection.lon.toFixed(2)}°E…
            </p>
          )}

          {selection && path.error && <ErrorState detail={path.error} />}

          {selection && path.data && !path.data.available && (
            <p className="rounded-(--radius-container) border border-border bg-surface-recessed px-4 py-6 text-center text-sm text-ink-muted">
              No climate-grid value at this point — it is probably outside Pakistan’s grid
              (sea, or beyond the border). Try a point on land.
            </p>
          )}

          {selection && path.data?.available && (
            <>
              <section aria-live="polite">
                <p className="flex items-center gap-1.5 text-sm font-semibold">
                  <MapPin className="h-4 w-4 text-brand" />
                  {path.data.location.nearestPlace
                    ? `Near ${path.data.location.nearestPlace.name} (${path.data.location.nearestPlace.distanceKm} km)`
                    : "Selected point"}
                </p>
                <p className="tnum mt-0.5 text-xs text-ink-muted">
                  {selection.lat.toFixed(3)}°N, {selection.lon.toFixed(3)}°E · baseline
                  1995–2014:{" "}
                  <strong className="text-ink">
                    {formatValue(path.data.baseline?.value, state.indicator)}
                  </strong>
                </p>
              </section>

              <div
                role="group"
                aria-label="What the chart plots"
                className="inline-flex rounded-(--radius-pill) border border-border bg-surface-recessed p-0.5 text-xs font-medium"
              >
                {(
                  [
                    ["absolute", "Value"],
                    ["change", "Change vs 1995–2014"],
                  ] as const
                ).map(([id, label]) => (
                  <button
                    key={id}
                    type="button"
                    aria-pressed={state.view === id}
                    onClick={() => setState({ view: id })}
                    className={`rounded-(--radius-pill) px-3 py-1.5 transition-colors ${
                      state.view === id
                        ? "bg-surface-raised text-ink shadow-(--elevation-flat)"
                        : "text-ink-muted hover:text-ink"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              <TimeSeriesChart
                lines={lines}
                unit={unit}
                height={320}
                splitYear={0}
                indicatorId={state.indicator}
                product={product}
                yLabel={indicator?.label}
                showMarkers
              />

              <PathTable
                lines={path.data.lines}
                indicatorId={state.indicator}
                showChange={showChange}
              />

              <p className="text-xs leading-relaxed text-ink-faint">
                Each dot is a real 20-year climatology from the 0.25° CMIP6 grid (about 25 km),
                plotted at the window’s centre year; the last window, 2080–2099, is drawn at
                2090. Lines join the dots — they are not annual forecasts. Rainfall and
                mountain terrain carry more uncertainty than lowland temperature.
              </p>
            </>
          )}
        </div>
      </aside>
    </div>
  );
}

function PathTable({
  lines,
  indicatorId,
  showChange,
}: {
  lines: PathResponse["lines"];
  indicatorId: string;
  showChange: boolean;
}) {
  const head = lines[0]?.points ?? [];
  return (
    <div className="overflow-x-auto rounded-(--radius-container) border border-border">
      <table className="w-full min-w-[420px] text-xs">
        <caption className="sr-only">
          {showChange ? "Change from the 1995–2014 baseline" : "Projected value"} by pathway and window
        </caption>
        <thead className="bg-surface-recessed text-ink-muted">
          <tr>
            <th scope="col" className="px-2.5 py-2 text-left font-medium">
              Pathway
            </th>
            {head.slice(1).map((p) => (
              <th key={p.period} scope="col" className="tnum px-2.5 py-2 text-right font-medium">
                {p.periodLabel}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {lines.map((line) => (
            <tr key={line.id} className="border-t border-border">
              <th scope="row" className="px-2.5 py-1.5 text-left font-medium">
                <span
                  className="mr-1.5 inline-block h-2 w-2 rounded-full align-middle"
                  style={{ background: line.color }}
                />
                {line.label}
              </th>
              {line.points.slice(1).map((p) => (
                <td key={p.period} className="tnum px-2.5 py-1.5 text-right">
                  {showChange
                    ? formatValue(p.delta, indicatorId, "anomaly")
                    : formatValue(p.value, indicatorId)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
