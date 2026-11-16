"use client";

import { useEffect, useMemo, useState } from "react";
import { MapPin, Maximize2, X } from "lucide-react";

import { ProjectionPathChart } from "@/components/charts/projection-path-chart";
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
  lines: Array<{
    id: string;
    label: string;
    color: string;
    points: PathPoint[];
    annual?: Array<{ year: number; value: number | null; delta: number | null }>;
  }>;
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

  // The full-screen yearly chart opens on every new pick from the map or list.
  const [open, setOpen] = useState(false);
  const pick = (lat: number, lon: number) => {
    setState({ lat: String(lat), lon: String(lon) });
    setOpen(true);
  };

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
          onSelect={(next) => pick(next.lat, next.lon)}
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
      <aside className="w-full shrink-0 overflow-y-auto border-t border-border bg-surface-panel lg:w-[600px] lg:border-l lg:border-t-0 xl:w-[680px]">
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
                  if (place) pick(place.lat, place.lon);
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

              <button
                type="button"
                onClick={() => setOpen(true)}
                className="flex w-full items-center justify-center gap-2 rounded-(--radius-container) bg-brand px-4 py-3 text-sm font-semibold text-white shadow-(--elevation-raised) transition hover:brightness-110"
              >
                <Maximize2 className="h-4 w-4" />
                Open full-screen yearly chart (1995–2100)
              </button>

              <EndOfCentury lines={path.data.lines} indicatorId={state.indicator} />

              <div className="rounded-(--radius-container) border border-border bg-surface-raised p-3 shadow-(--elevation-raised)">
                <ProjectionPathChart
                  lines={path.data.lines}
                  indicatorId={state.indicator}
                  showChange={showChange}
                  unit={unit}
                />
              </div>

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

      {open && selection && (
        <FullScreenChart
          selection={selection}
          indicatorId={state.indicator}
          showChange={showChange}
          onToggleView={(view) => setState({ view })}
          onClose={() => setOpen(false)}
        />
      )}
    </div>
  );
}

/**
 * The year-by-year view, full screen.
 *
 * Asks the path API for the estimated annual path as well as the 20-year
 * anchors. The anchors arrive from cache almost at once, so the dialog draws
 * them first and swaps in the yearly lines when the national series lands.
 */
function FullScreenChart({
  selection,
  indicatorId,
  showChange,
  onToggleView,
  onClose,
}: {
  selection: { lat: number; lon: number };
  indicatorId: string;
  showChange: boolean;
  onToggleView: (view: "absolute" | "change") => void;
  onClose: () => void;
}) {
  const base = `/api/climate/path?lat=${selection.lat}&lon=${selection.lon}&indicator=${indicatorId}`;
  const quick = useApi<PathResponse>(base);
  const yearly = useApi<PathResponse>(`${base}&annual=1`);
  const data = yearly.data ?? quick.data;
  const indicator = INDICATORS[indicatorId];
  const unit = displayUnit(data?.unit ?? indicator?.unit ?? "", indicatorId, showChange ? "anomaly" : "climatology");

  const [chartHeight, setChartHeight] = useState(520);
  useEffect(() => {
    const fit = () => setChartHeight(Math.max(360, window.innerHeight - 330));
    fit();
    window.addEventListener("resize", fit);
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("resize", fit);
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
    };
  }, [onClose]);

  const place = data?.location.nearestPlace;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${indicator?.label ?? "Climate"} projection to 2100`}
      className="fixed inset-0 z-[3000] flex flex-col overflow-y-auto bg-surface-panel text-ink"
      style={{
        backgroundImage:
          "radial-gradient(1200px 500px at 10% -10%, color-mix(in oklab, var(--color-leaf, #8dc63f) 14%, transparent), transparent), radial-gradient(900px 500px at 110% 0%, color-mix(in oklab, #dc2626 10%, transparent), transparent)",
      }}
    >
      <header className="flex flex-wrap items-start justify-between gap-4 px-6 pb-3 pt-5 lg:px-10">
        <div>
          <p className="label">Year-by-year projection · 1995–2100</p>
          <h2 className="mt-1 text-[clamp(1.4rem,2.6vw,2.1rem)] font-bold tracking-tight">
            {indicator?.label} {place ? `near ${place.name}` : "at this point"}
          </h2>
          <p className="tnum mt-1 text-sm text-ink-muted">
            {selection.lat.toFixed(3)}°N, {selection.lon.toFixed(3)}°E
            {data?.baseline?.value != null && (
              <>
                {" "}· 1995–2014 normal{" "}
                <strong className="text-ink">{formatValue(data.baseline.value, indicatorId)}</strong>
              </>
            )}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div
            role="group"
            aria-label="What the chart plots"
            className="inline-flex rounded-(--radius-pill) border border-border bg-surface-recessed p-0.5 text-sm font-medium"
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
                aria-pressed={(id === "change") === showChange}
                onClick={() => onToggleView(id)}
                className={`rounded-(--radius-pill) px-3.5 py-1.5 transition-colors ${
                  (id === "change") === showChange
                    ? "bg-surface-raised text-ink shadow-(--elevation-flat)"
                    : "text-ink-muted hover:text-ink"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close full-screen chart"
            className="flex h-10 w-10 items-center justify-center rounded-full border border-border bg-surface-raised text-ink shadow-(--elevation-raised) transition hover:bg-surface-hover"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </header>

      <div className="flex-1 px-6 pb-6 lg:px-10">
        {!data && (quick.loading || yearly.loading) && (
          <p className="py-24 text-center text-sm text-ink-muted" role="status">
            Fetching CMIP6 projections…
          </p>
        )}
        {!data && quick.error && <ErrorState detail={quick.error} />}
        {data && !data.available && (
          <p className="py-24 text-center text-sm text-ink-muted">
            No climate-grid value at this point. Close this and try a point on land inside Pakistan.
          </p>
        )}
        {data?.available && (
          <div className="grid gap-5 xl:grid-cols-[1fr_300px]">
            <div className="rounded-[20px] border border-border bg-surface-raised/90 p-4 shadow-(--elevation-overlay) backdrop-blur">
              {yearly.loading && (
                <p className="mb-2 inline-flex items-center gap-2 rounded-(--radius-pill) bg-surface-recessed px-3 py-1 text-xs font-medium text-ink-muted" role="status">
                  <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-leaf border-t-transparent" />
                  Loading year-by-year detail…
                </p>
              )}
              <ProjectionPathChart
                key={yearly.data ? "yearly" : "anchors"}
                lines={data.lines}
                indicatorId={indicatorId}
                showChange={showChange}
                unit={unit}
                height={chartHeight}
              />
            </div>
            <aside className="space-y-3">
              <EndOfCentury lines={data.lines} indicatorId={indicatorId} stacked />
              <p className="text-xs leading-relaxed text-ink-faint">
                <strong className="text-ink-muted">How to read this.</strong> Large dots are real
                20-year averages for this point from the 0.25° CMIP6 grid (about 25 km). The
                year-by-year lines are an estimate: Pakistan’s national CMIP6 annual curve,
                shifted so each 20-year window matches this point’s own value. Hover for any
                year; click a pathway to hide it.
              </p>
            </aside>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * The headline: where this place ends up by 2080–2099 if the world cuts
 * emissions hard, versus if it does not. The gap between the two cards is the
 * part of the future that is still being decided.
 */
function EndOfCentury({
  lines,
  indicatorId,
  stacked = false,
}: {
  lines: PathResponse["lines"];
  indicatorId: string;
  /** One card per row — for the narrow column beside the full-screen chart. */
  stacked?: boolean;
}) {
  const pick = (id: string) => {
    const line = lines.find((l) => l.id === id);
    const last = line?.points[line.points.length - 1];
    return line && last ? { line, last } : null;
  };
  const cards = [
    { key: "ssp126", title: "If emissions fall fast", data: pick("ssp126") },
    { key: "ssp245", title: "Middle of the road", data: pick("ssp245") },
    { key: "ssp585", title: "If emissions keep rising", data: pick("ssp585") },
  ];

  return (
    <div className={`grid gap-2.5 ${stacked ? "grid-cols-3 xl:grid-cols-1" : "grid-cols-3"}`}>
      {cards.map(({ key, title, data }) =>
        data ? (
          <div
            key={key}
            className="relative overflow-hidden rounded-(--radius-container) border p-3 shadow-(--elevation-raised)"
            style={{
              borderColor: `color-mix(in oklab, ${data.line.color} 35%, transparent)`,
              background: `linear-gradient(160deg, color-mix(in oklab, ${data.line.color} 16%, var(--color-surface-panel)), var(--color-surface-panel) 70%)`,
            }}
          >
            <div className="absolute inset-x-0 top-0 h-1" style={{ background: data.line.color }} />
            <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-muted">{title}</p>
            <p className="tnum mt-1.5 text-2xl font-bold leading-none" style={{ color: data.line.color }}>
              {formatValue(data.last.delta, indicatorId, "anomaly")}
            </p>
            <p className="tnum mt-1 text-xs text-ink-muted">
              {formatValue(data.last.value, indicatorId)} by 2080–2099
            </p>
            <p className="mt-1 text-[11px] font-medium text-ink-faint">{data.line.label}</p>
          </div>
        ) : null,
      )}
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
