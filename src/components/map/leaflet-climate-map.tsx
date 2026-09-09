/**
 * Climate choropleth on official administrative boundaries.
 *
 * This used to paint the 0.25° climate grid onto a canvas overlay, clipped to
 * a country polygon. That meant drawing a second, coarser copy of each country
 * on top of a basemap that already had an accurate one — and wherever the two
 * disagreed, the data appeared to spill across borders and coastlines.
 *
 * Instead the official boundary polygons *are* the rendering. Each
 * administrative unit is filled with its own aggregated value, so the edges of
 * the data are the edges of the country by construction. There is no second
 * geometry to fall out of alignment.
 *
 * The trade-off is honest and worth stating: a unit is one flat colour, so
 * variation inside it is not shown. The value is the mean of the climate-grid
 * cells whose centres fall inside that unit.
 */
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import L from "leaflet";
import { MapContainer, TileLayer, useMap, useMapEvents } from "react-leaflet";
import "leaflet/dist/leaflet.css";

import { buildScale, NO_DATA_COLOR } from "@/lib/colors";
import { displayUnit, formatValue, type ProductId } from "@/lib/climate/taxonomy";
import type { GeoCollection, GeoFeature } from "./projection";

/**
 * Map chrome colours. Mirrors the ESS brand tokens in styles/tokens.css —
 * Leaflet style objects take literal colours, not CSS custom properties.
 */
const ESS = {
  forest: "#334b35",
  forestDeep: "#16211a",
  leaf: "#8dc63f",
  ground: "#f6f4ec",
} as const;

/* ------------------------------------------------------------------ types */

export interface RegionValue {
  id: string;
  value: number | null;
  cells: number;
  agreement: number | null;
}

export interface RegionData {
  regions: RegionValue[];
  unit: string;
  stats: { min: number | null; max: number | null; p02: number | null; p98: number | null };
}

export interface MapSelection {
  lat: number;
  lon: number;
}

interface ClimateMapProps {
  bbox: { lonMin: number; latMin: number; lonMax: number; latMax: number };
  /** Per-region values; `null` while loading or when unavailable. */
  data: RegionData | null;
  /** Official polygons to paint — the same units the values are keyed by. */
  regions: GeoCollection | null;
  /** National outline, drawn over the fill as the country's own border. */
  outline: GeoCollection | null;
  indicatorId: string;
  product: string;
  selection: MapSelection | null;
  onSelect: (selection: MapSelection) => void;
  /** Region id to emphasise, e.g. from the sidebar filter. */
  highlightArea?: string | null;
  loading?: boolean;
}

/* ------------------------------------------------------- choropleth layer */

interface HoverInfo {
  id: string;
  name: string;
  value: number | null;
  cells: number;
}

function ChoroplethLayer({
  data,
  regions,
  indicatorId,
  product,
  highlightArea,
  onHover,
  onSelect,
}: {
  data: RegionData | null;
  regions: GeoCollection | null;
  indicatorId: string;
  product: string;
  highlightArea?: string | null;
  onHover: (info: HoverInfo | null) => void;
  onSelect: (selection: MapSelection) => void;
}) {
  const map = useMap();
  const layerRef = useRef<L.GeoJSON | null>(null);

  // Canvas rather than SVG: Australia's 547 local government areas would
  // otherwise be 547 DOM nodes restyled on every hover. Leaflet takes the
  // renderer through path options, so it rides along with the fill style.
  const renderer = useMemo(() => L.canvas({ padding: 0.3 }), []);

  const valueById = useMemo(() => {
    const table = new Map<string, RegionValue>();
    for (const region of data?.regions ?? []) table.set(region.id, region);
    return table;
  }, [data]);

  const scale = useMemo(() => {
    if (!data) return null;
    const min = data.stats.p02 ?? data.stats.min ?? 0;
    const max = data.stats.p98 ?? data.stats.max ?? 1;
    return buildScale({ min, max, indicatorId, product });
  }, [data, indicatorId, product]);

  const styleFor = useCallback(
    (id: string): L.PathOptions => {
      const region = valueById.get(id);
      const value = region?.value ?? null;
      const emphasised = highlightArea === id;
      // Where the models disagree on the direction of change, the median is
      // still the median but its sign is not robust. Rendering that as a
      // washed-out fill keeps one visual channel per fact — the hue still
      // carries the value, the strength carries the confidence.
      const contested = region?.agreement !== null && (region?.agreement ?? 1) < 0.5;
      return {
        renderer,
        fillColor: value === null || !scale ? NO_DATA_COLOR : scale(value),
        // Opaque enough to read as data, sheer enough that the basemap's
        // coastline and place names stay visible underneath.
        fillOpacity: value === null ? 0.25 : contested ? 0.4 : 0.78,
        color: emphasised ? ESS.forest : "#ffffff",
        weight: emphasised ? 2.2 : 0.5,
        opacity: emphasised ? 1 : 0.85,
      };
    },
    [valueById, scale, highlightArea, renderer],
  );

  useEffect(() => {
    if (!regions) return;

    const layer = L.geoJSON(regions as unknown as GeoJSON.GeoJsonObject, {
      style: (feature) =>
        styleFor(String((feature as unknown as GeoFeature).properties.id)),
      onEachFeature: (feature, featureLayer) => {
        const properties = (feature as unknown as GeoFeature).properties;
        featureLayer.on({
          mouseover: () => {
            const region = valueById.get(properties.id);
            onHover({
              id: properties.id,
              name: properties.name,
              value: region?.value ?? null,
              cells: region?.cells ?? 0,
            });
            (featureLayer as L.Path).setStyle({ weight: 2, color: ESS.forestDeep, opacity: 1 });
          },
          mouseout: () => {
            onHover(null);
            (featureLayer as L.Path).setStyle(styleFor(properties.id));
          },
          click: (event: L.LeafletMouseEvent) => {
            onSelect({
              lat: Number(event.latlng.lat.toFixed(4)),
              lon: Number(event.latlng.lng.toFixed(4)),
            });
          },
        });
      },
    });

    layer.addTo(map);
    layerRef.current = layer;

    return () => {
      map.removeLayer(layer);
      layerRef.current = null;
    };
  }, [map, regions, styleFor, valueById, onHover, onSelect]);

  return null;
}

/* --------------------------------------------------------- outline layer */

/**
 * The national border, drawn from the same official geometry the fill uses.
 *
 * Kept as a separate layer above the choropleth so the country reads as one
 * shape rather than a mosaic of districts, and so the border stays crisp where
 * two adjacent units meet.
 */
function OutlineLayer({ outline }: { outline: GeoCollection | null }) {
  const map = useMap();

  useEffect(() => {
    if (!outline) return;
    const layer = L.geoJSON(outline as unknown as GeoJSON.GeoJsonObject, {
      interactive: false,
      style: {
        fill: false,
        color: ESS.forestDeep,
        weight: 1.6,
        opacity: 0.75,
      },
    });
    layer.addTo(map);
    return () => {
      map.removeLayer(layer);
    };
  }, [map, outline]);

  return null;
}

/* ----------------------------------------- inner component (needs useMap) */

function MapContent(props: ClimateMapProps) {
  const {
    data,
    regions,
    outline,
    indicatorId,
    product,
    selection,
    onSelect,
    highlightArea,
    loading,
    bbox,
  } = props;

  const map = useMap();
  const [hover, setHover] = useState<HoverInfo | null>(null);
  const markerRef = useRef<L.CircleMarker | null>(null);

  // Clicking the sea — outside every polygon — should still drop a pin, so the
  // location panel can answer for that coordinate.
  useMapEvents({
    click(event) {
      onSelect({
        lat: Number(event.latlng.lat.toFixed(4)),
        lon: Number(event.latlng.lng.toFixed(4)),
      });
    },
  });

  const bboxKey = `${bbox.lonMin},${bbox.latMin},${bbox.lonMax},${bbox.latMax}`;
  useEffect(() => {
    map.fitBounds(
      [
        [bbox.latMin, bbox.lonMin],
        [bbox.latMax, bbox.lonMax],
      ],
      { padding: [16, 16] },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bboxKey, map]);

  useEffect(() => {
    if (markerRef.current) {
      map.removeLayer(markerRef.current);
      markerRef.current = null;
    }
    if (!selection) return;
    const marker = L.circleMarker([selection.lat, selection.lon], {
      radius: 7,
      color: "#ffffff",
      weight: 2.5,
      fillColor: ESS.forest,
      fillOpacity: 1,
    }).addTo(map);
    markerRef.current = marker;
    return () => {
      map.removeLayer(marker);
    };
  }, [selection, map]);

  const unit = data ? displayUnit(data.unit, indicatorId, product as ProductId) : "";

  return (
    <>
      <ChoroplethLayer
        data={data}
        regions={regions}
        indicatorId={indicatorId}
        product={product}
        highlightArea={highlightArea}
        onHover={setHover}
        onSelect={onSelect}
      />
      <OutlineLayer outline={outline} />

      {hover && (
        <div className="pointer-events-none absolute bottom-3.5 left-3.5 z-[1000] rounded-(--radius-container) border border-border/90 bg-surface-panel px-4 py-3 shadow-(--elevation-overlay) ring-1 ring-border ">
          <div className="text-[13px] font-semibold text-ink">{hover.name}</div>
          <div className="tnum mt-1 text-[17px] font-semibold text-ink">
            {hover.value === null
              ? "No data"
              : formatValue(hover.value, indicatorId, product as ProductId)}
          </div>
          <div className="mt-0.5 text-[10.5px] font-medium text-ink-faint">
            {hover.value === null
              ? "outside the climate grid"
              : `mean of ${hover.cells} grid cell${hover.cells === 1 ? "" : "s"} · ${unit}`}
          </div>
        </div>
      )}

      {loading && (
        <div className="pointer-events-none absolute left-1/2 top-1/2 z-[1001] flex -translate-x-1/2 -translate-y-1/2 items-center gap-3 rounded-full border border-leaf bg-surface-panel px-5 py-2.5 text-xs font-semibold text-brand-deep shadow-(--elevation-overlay) ring-1 ring-leaf/20 ">
          <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-leaf border-t-transparent" />
          <span>Aggregating CMIP6 field by region…</span>
        </div>
      )}

      {!data && !loading && (
        <div className="pointer-events-none absolute inset-0 z-[1001] flex items-center justify-center">
          <div className="max-w-sm rounded-(--radius-container) border border-border bg-surface-panel px-5 py-4 text-center text-xs font-medium text-ink-muted shadow-(--elevation-overlay) ">
            No gridded field for this combination. Point values are still
            available in the location panel.
          </div>
        </div>
      )}

      {!selection && !loading && data && (
        <div className="pointer-events-none absolute left-1/2 top-8 z-[1001] -translate-x-1/2">
          <div className="flex items-center gap-2 rounded-full border border-leaf bg-surface-panel px-4 py-2.5 text-sm font-semibold text-brand shadow-(--elevation-overlay) ring-2 ring-leaf/20 ">
            <span className="relative flex h-3 w-3">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-leaf opacity-75" />
              <span className="relative inline-flex h-3 w-3 rounded-full bg-brand" />
            </span>
            <span>Hover a region for its value · click to inspect a point</span>
          </div>
        </div>
      )}
    </>
  );
}

/* ------------------------------------------ public component (the wrapper) */

export function ClimateMap(props: ClimateMapProps) {
  const { bbox } = props;

  const center: [number, number] = [
    (bbox.latMin + bbox.latMax) / 2,
    (bbox.lonMin + bbox.lonMax) / 2,
  ];

  const bounds: [[number, number], [number, number]] = [
    [bbox.latMin, bbox.lonMin],
    [bbox.latMax, bbox.lonMax],
  ];

  return (
    <MapContainer
      center={center}
      zoom={5}
      className="h-full w-full"
      zoomControl={false}
      attributionControl={false}
      // Leaflet snaps fitBounds to whole zoom levels by default, so a bounding
      // box a fraction too wide drops the whole country a level and halves it
      // on screen. Quarter steps let it fit the frame properly.
      zoomSnap={0.25}
      zoomDelta={0.5}
      style={{ background: ESS.ground }}
    >
      {/*
        Esri World Light Gray Canvas — a muted basemap built to sit under data.

        CARTO Positron was the obvious choice and is what this used, but CARTO
        now watermarks "API KEY REQUIRED" directly into the tile bitmaps on
        their keyless CDN, so it cannot be styled away. Esri's equivalent needs
        no key and is visually near-identical.

        Note the path order: Esri serves {z}/{y}/{x} — row before column —
        unlike the {z}/{x}/{y} that almost every other XYZ provider uses.
        Swapping them silently transposes the world.
      */}
      <TileLayer
        url="https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}"
        attribution="Tiles &copy; Esri — Esri, DeLorme, NAVTEQ"
        maxZoom={16}
      />

      <ZoomControl bounds={bounds} />
      <AttributionControl />
      <MapContent {...props} />
    </MapContainer>
  );
}

/* ----------------------------------------------- minimal Leaflet controls */

function ZoomControl({ bounds }: { bounds: [[number, number], [number, number]] }) {
  const map = useMap();
  return (
    <div className="absolute right-3.5 top-3.5 z-[1000] flex flex-col overflow-hidden rounded-(--radius-container) border border-border/90 bg-surface-panel shadow-(--elevation-raised) ring-1 ring-border ">
      <button
        type="button"
        aria-label="Zoom in"
        onClick={() => map.zoomIn()}
        className="flex h-9 w-9 cursor-pointer items-center justify-center border-b border-border text-base font-semibold text-ink-muted transition-colors hover:bg-surface-recessed"
      >
        +
      </button>
      <button
        type="button"
        aria-label="Zoom out"
        onClick={() => map.zoomOut()}
        className="flex h-9 w-9 cursor-pointer items-center justify-center border-b border-border text-base font-semibold text-ink-muted transition-colors hover:bg-surface-recessed"
      >
        −
      </button>
      <button
        type="button"
        aria-label="Reset view"
        title="Reset view"
        onClick={() => map.fitBounds(bounds, { animate: true, padding: [16, 16] })}
        className="flex h-9 w-9 cursor-pointer items-center justify-center text-ink-muted transition-colors hover:bg-surface-recessed"
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
          <path d="M3 3v5h5" />
        </svg>
      </button>
    </div>
  );
}

function AttributionControl() {
  return (
    <div className="absolute bottom-1.5 right-1.5 z-[1000] rounded-(--radius-control) bg-surface-panel px-1.5 py-0.5 text-[10px] text-ink-faint ">
      Tiles ©{" "}
      <a
        href="https://www.esri.com/en-us/legal/terms/full-master-agreement"
        target="_blank"
        rel="noopener noreferrer"
        className="underline"
      >
        Esri
      </a>{" "}
      · Boundaries: geoBoundaries
    </div>
  );
}
