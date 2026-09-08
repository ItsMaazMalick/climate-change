"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { buildScale, NO_DATA_COLOR } from "@/lib/colors";
import { displayUnit, type ProductId } from "@/lib/climate/taxonomy";
import { PLACES } from "@/lib/climate/places";

import {
  clampViewport,
  createProjection,
  featurePath,
  featurePath2D,
  fitBounds,
  panBy,
  zoomAbout,
  type BBox,
  type GeoCollection,
  type Viewport,
} from "./projection";

export interface GridGeometry {
  lonMin: number;
  latMin: number;
  resolution: number;
  nLon: number;
  nLat: number;
  cellCount: number;
}

export interface FieldData {
  grid: GridGeometry;
  values: Array<number | null>;
  significance: Array<number | null> | null;
  unit: string;
  stats: { min: number | null; max: number | null; p02: number | null; p98: number | null };
}

export interface MapSelection {
  lat: number;
  lon: number;
}

interface ClimateMapProps {
  bbox: BBox;
  field: FieldData | null;
  indicatorId: string;
  product: string;
  boundaries: { country?: GeoCollection; provinces?: GeoCollection; districts?: GeoCollection };
  selection: MapSelection | null;
  onSelect: (selection: MapSelection) => void;
  /** Admin unit id to outline as the active area. */
  highlightArea?: string | null;
  showDistricts?: boolean;
  showCities?: boolean;
  loading?: boolean;
}

/**
 * The map.
 *
 * Rendering is split by workload rather than by layer semantics: the ~4,000
 * climate cells go to a canvas, where they are one fill-rect pass and repaint
 * in under a frame; the boundaries, labels and selection marker go to an SVG
 * on top, where they get real hit-testing, crisp strokes at any zoom, and
 * accessibility affordances for free.
 *
 * Doing it the other way round — cells in SVG — costs ~4,000 DOM nodes and
 * makes pan janky on a mid-range phone, which is most of the audience.
 */
export function ClimateMap({
  bbox,
  field,
  indicatorId,
  product,
  boundaries,
  selection,
  onSelect,
  highlightArea,
  showDistricts = false,
  showCities = true,
  loading = false,
}: ClimateMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [size, setSize] = useState({ width: 800, height: 600 });
  const [viewport, setViewport] = useState<Viewport>({
    width: 800,
    height: 600,
    centerX: 0.5,
    centerY: 0.5,
    zoom: 1,
  });
  const [hover, setHover] = useState<{ lon: number; lat: number; value: number | null } | null>(null);
  const dragRef = useRef<{ x: number; y: number; moved: boolean } | null>(null);
  // The ref carries the per-pointer-event maths, which must not re-render.
  // The cursor has to change during render, so that one bit is mirrored
  // into state — reading a ref while rendering is not safe.
  const [dragging, setDragging] = useState(false);

  // ---- responsive sizing ------------------------------------------------
  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => {
      if (!entry) return;
      const { width, height } = entry.contentRect;
      setSize({ width: Math.max(320, width), height: Math.max(320, height) });
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const projection = useMemo(
    () => createProjection(bbox, { ...viewport, ...size }),
    [bbox, viewport, size],
  );

  const scale = useMemo(() => {
    if (!field) return null;
    // Clip the colour domain to the 2nd–98th percentile so a handful of
    // extreme Karakoram cells cannot flatten the contrast across the plains
    // where most people actually live.
    const min = field.stats.p02 ?? field.stats.min ?? 0;
    const max = field.stats.p98 ?? field.stats.max ?? 1;
    return buildScale({ min, max, indicatorId, product });
  }, [field, indicatorId, product]);

  // ---- canvas: the climate field ---------------------------------------
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = size.width * dpr;
    canvas.height = size.height * dpr;
    canvas.style.width = `${size.width}px`;
    canvas.style.height = `${size.height}px`;

    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, size.width, size.height);

    if (!field || !scale) return;

    // Clip to Pakistan.
    //
    // The extracted lattice is a rectangle, so it necessarily carries cells
    // over Iran, Afghanistan and India. Those values are real, but this is a
    // map of Pakistan: drawing them invites the reader to attribute them to
    // the country, and the border becomes decoration rather than the edge of
    // the claim. Clipping costs one path per repaint.
    const clip = boundaries.country?.features[0];
    if (clip) {
      ctx.save();
      ctx.clip(featurePath2D(clip.geometry, projection));
    }

    const { grid, values, significance } = field;
    const res = grid.resolution;

    // Cell footprint in device pixels. Overdrawing by a hair removes the
    // seams that otherwise appear between adjacent rects at fractional zoom.
    const cellW = res * projection.scaleX + 0.6;
    const cellH = res * projection.scaleY + 0.6;

    // Cells where the models disagree on the sign, collected so the hatch is
    // one stroked path rather than several thousand.
    const hatched: Array<[number, number]> = [];

    for (let index = 0; index < values.length; index += 1) {
      const value = values[index];
      if (value === null || value === undefined) continue;

      const row = Math.floor(index / grid.nLon);
      const col = index % grid.nLon;
      const lon = grid.lonMin + col * res;
      const lat = grid.latMin + (row + 1) * res; // top edge

      const [x, y] = projection.toScreen(lon, lat);
      if (x + cellW < 0 || x > size.width || y + cellH < 0 || y > size.height) continue;

      const flag = significance?.[index];
      if (flag === 0) continue; // no data

      ctx.fillStyle = scale(value);
      ctx.fillRect(x, y, cellW, cellH);

      // Flag 2 is "models conflict on the sign of the change". On a dark
      // ground reduced opacity read as uncertainty; on a light one it just
      // reads as a smaller value. Hatching is the IPCC's own convention for
      // low agreement and is unambiguous on any background — and unlike a
      // colour change it does not compete with the value the cell encodes.
      if (flag === 2) hatched.push([x, y]);
    }

    if (hatched.length > 0) {
      ctx.save();
      ctx.strokeStyle = "rgba(31,42,27,0.55)";
      ctx.lineWidth = 0.7;
      ctx.beginPath();
      const step = Math.max(3, Math.min(cellW, cellH) / 2.2);
      for (const [x, y] of hatched) {
        for (let offset = 0; offset < cellW + cellH; offset += step) {
          const x0 = x + offset;
          const y0 = y;
          const x1 = x + offset - cellH;
          const y1 = y + cellH;
          // Clip the diagonal to the cell so strokes never bleed into
          // neighbouring cells that do have agreement.
          const cx0 = Math.min(Math.max(x0, x), x + cellW);
          const cx1 = Math.min(Math.max(x1, x), x + cellW);
          const cy0 = y0 + (cx0 - x0);
          const cy1 = y1 + (cx1 - x1);
          if (cy0 > y + cellH || cy1 < y) continue;
          ctx.moveTo(cx0, Math.min(Math.max(cy0, y), y + cellH));
          ctx.lineTo(cx1, Math.min(Math.max(cy1, y), y + cellH));
        }
      }
      ctx.stroke();
      ctx.restore();
    }

    ctx.globalAlpha = 1;
    if (clip) ctx.restore();
  }, [field, scale, projection, size, boundaries.country]);

  // ---- interaction ------------------------------------------------------
  const valueAt = useCallback(
    (lon: number, lat: number): number | null => {
      if (!field) return null;
      const { grid, values } = field;
      const col = Math.floor((lon - grid.lonMin) / grid.resolution);
      const row = Math.floor((lat - grid.latMin) / grid.resolution);
      if (col < 0 || col >= grid.nLon || row < 0 || row >= grid.nLat) return null;
      return values[row * grid.nLon + col] ?? null;
    },
    [field],
  );

  const handleWheel = useCallback(
    (event: React.WheelEvent) => {
      event.preventDefault();
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const factor = Math.pow(1.0015, -event.deltaY);
      setViewport((current) =>
        zoomAbout(
          bbox,
          { ...current, ...size },
          factor,
          event.clientX - rect.left,
          event.clientY - rect.top,
        ),
      );
    },
    [bbox, size],
  );

  const handlePointerDown = (event: React.PointerEvent) => {
    (event.target as Element).setPointerCapture?.(event.pointerId);
    dragRef.current = { x: event.clientX, y: event.clientY, moved: false };
  };

  const handlePointerMove = (event: React.PointerEvent) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;

    const drag = dragRef.current;
    if (drag) {
      const dx = event.clientX - drag.x;
      const dy = event.clientY - drag.y;
      if (Math.abs(dx) > 2 || Math.abs(dy) > 2) {
        if (!drag.moved) setDragging(true);
        drag.moved = true;
        drag.x = event.clientX;
        drag.y = event.clientY;
        setViewport((current) => panBy(bbox, { ...current, ...size }, dx, dy));
      }
      return;
    }

    const [lon, lat] = projection.toGeo(
      event.clientX - rect.left,
      event.clientY - rect.top,
    );
    setHover({ lon, lat, value: valueAt(lon, lat) });
  };

  const endDrag = (event: React.PointerEvent) => {
    const drag = dragRef.current;
    dragRef.current = null;
    setDragging(false);
    if (!drag || drag.moved) return;

    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const [lon, lat] = projection.toGeo(
      event.clientX - rect.left,
      event.clientY - rect.top,
    );
    onSelect({ lat: Number(lat.toFixed(4)), lon: Number(lon.toFixed(4)) });
  };

  const zoomButton = (factor: number) =>
    setViewport((current) =>
      zoomAbout(bbox, { ...current, ...size }, factor, size.width / 2, size.height / 2),
    );

  const resetView = () =>
    setViewport((current) =>
      clampViewport({ ...current, ...size, zoom: 1, centerX: 0.5, centerY: 0.5 }),
    );

  // Frame the highlighted admin unit when the selection changes.
  //
  // This is the "adjust state when a prop changes" pattern rather than an
  // effect: it is a derivation from props, not a subscription to an external
  // system, and doing it in an effect would render once with the stale
  // viewport before correcting it.
  const [framedArea, setFramedArea] = useState(highlightArea);
  if (highlightArea !== framedArea) {
    setFramedArea(highlightArea);
    if (highlightArea) {
      const feature =
        boundaries.provinces?.features.find((f) => f.properties.id === highlightArea) ??
        boundaries.districts?.features.find((f) => f.properties.id === highlightArea);
      if (feature) {
        setViewport((current) =>
          fitBounds(bbox, feature.properties.bbox, { ...current, ...size }),
        );
      }
    }
  }

  const selectionPoint = selection
    ? projection.toScreen(selection.lon, selection.lat)
    : null;

  // Reset framed viewport when bbox changes (e.g. country switch)
  const [currentBbox, setCurrentBbox] = useState(bbox);
  if (
    bbox.lonMin !== currentBbox.lonMin ||
    bbox.latMin !== currentBbox.latMin ||
    bbox.lonMax !== currentBbox.lonMax ||
    bbox.latMax !== currentBbox.latMax
  ) {
    setCurrentBbox(bbox);
    setViewport((current) =>
      clampViewport({ ...current, ...size, zoom: 1, centerX: 0.5, centerY: 0.5 }),
    );
  }

  const visibleCities = useMemo(() => {
    if (!showCities) return [];
    // Reveal smaller places as the reader zooms in, so labels never collide
    // at country scale but detail is available where it is being looked for.
    const threshold =
      viewport.zoom > 6 ? 0 : viewport.zoom > 3 ? 80_000 : viewport.zoom > 1.8 ? 150_000 : 250_000;
    return PLACES.filter(
      (place) =>
        place.population >= threshold &&
        place.lat >= bbox.latMin - 0.5 &&
        place.lat <= bbox.latMax + 0.5 &&
        place.lon >= bbox.lonMin - 0.5 &&
        place.lon <= bbox.lonMax + 0.5,
    );
  }, [showCities, viewport.zoom, bbox]);

  return (
    <div
      ref={containerRef}
      className="relative h-full w-full touch-none select-none overflow-hidden bg-[var(--color-surface)]"
      onWheel={handleWheel}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={endDrag}
      onPointerLeave={() => {
        dragRef.current = null;
        setDragging(false);
        setHover(null);
      }}
      style={{ cursor: dragging ? "grabbing" : "crosshair" }}
    >
      <canvas ref={canvasRef} className="absolute inset-0" aria-hidden="true" />

      <svg
        className="absolute inset-0 h-full w-full"
        width={size.width}
        height={size.height}
        role="img"
        aria-label="Map showing the selected climate indicator"
      >
        {/* Graticule grid lines for futuristic cartography */}
        <defs>
          <radialGradient id="selectionGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#10b981" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* Districts */}
        {showDistricts &&
          boundaries.districts?.features.map((feature) => (
            <path
              key={feature.properties.id}
              d={featurePath(feature.geometry, projection)}
              fill="none"
              stroke="rgba(148, 163, 184, 0.25)"
              strokeWidth={0.6}
              pointerEvents="none"
            />
          ))}

        {/* Provinces */}
        {boundaries.provinces?.features.map((feature) => {
          const active = feature.properties.id === highlightArea;
          return (
            <path
              key={feature.properties.id}
              d={featurePath(feature.geometry, projection)}
              fill={active ? "rgba(16, 185, 129, 0.18)" : "none"}
              stroke={active ? "#10b981" : "rgba(148, 163, 184, 0.45)"}
              strokeWidth={active ? 2.2 : 1.1}
              pointerEvents="none"
            />
          );
        })}

        {/* Country Boundary */}
        {boundaries.country?.features.map((feature) => (
          <path
            key={feature.properties.id}
            d={featurePath(feature.geometry, projection)}
            fill="none"
            stroke="rgba(56, 189, 248, 0.85)"
            strokeWidth={2}
            strokeLinejoin="round"
            pointerEvents="none"
          />
        ))}

        {/* City Markers & Labels */}
        {visibleCities.map((place) => {
          const [x, y] = projection.toScreen(place.lon, place.lat);
          if (x < -40 || x > size.width + 40 || y < -20 || y > size.height + 20) return null;
          return (
            <g key={place.id} pointerEvents="none" className="group">
              <circle cx={x} cy={y} r={4.5} fill="rgba(56, 189, 248, 0.25)" />
              <circle cx={x} cy={y} r={2.8} fill="#38bdf8" />
              <circle cx={x} cy={y} r={1.2} fill="#ffffff" />
              <text
                x={x + 6}
                y={y + 3.5}
                fontSize={11}
                fill="#f8fafc"
                stroke="#070a13"
                strokeWidth={3}
                paintOrder="stroke"
                className="font-semibold tracking-tight"
              >
                {place.name}
              </text>
            </g>
          );
        })}

        {/* Selection Reticle & Crosshair */}
        {selectionPoint && (
          <g pointerEvents="none">
            <circle
              cx={selectionPoint[0]}
              cy={selectionPoint[1]}
              r={24}
              fill="url(#selectionGlow)"
            />
            <circle
              cx={selectionPoint[0]}
              cy={selectionPoint[1]}
              r={12}
              fill="none"
              stroke="#10b981"
              strokeWidth={1.8}
              strokeDasharray="3 2"
              className="animate-spin"
              style={{ transformOrigin: `${selectionPoint[0]}px ${selectionPoint[1]}px`, animationDuration: "12s" }}
            />
            <circle
              cx={selectionPoint[0]}
              cy={selectionPoint[1]}
              r={4.5}
              fill="#10b981"
              stroke="#ffffff"
              strokeWidth={1.8}
            />
            <line
              x1={selectionPoint[0] - 16}
              x2={selectionPoint[0] - 7}
              y1={selectionPoint[1]}
              y2={selectionPoint[1]}
              stroke="#10b981"
              strokeWidth={1.2}
            />
            <line
              x1={selectionPoint[0] + 7}
              x2={selectionPoint[0] + 16}
              y1={selectionPoint[1]}
              y2={selectionPoint[1]}
              stroke="#10b981"
              strokeWidth={1.2}
            />
            <line
              x1={selectionPoint[0]}
              x2={selectionPoint[0]}
              y1={selectionPoint[1] - 16}
              y2={selectionPoint[1] - 7}
              stroke="#10b981"
              strokeWidth={1.2}
            />
            <line
              x1={selectionPoint[0]}
              x2={selectionPoint[0]}
              y1={selectionPoint[1] + 7}
              y2={selectionPoint[1] + 16}
              stroke="#10b981"
              strokeWidth={1.2}
            />
          </g>
        )}
      </svg>

      {/* ---- HUD Navigation Controls ---- */}
      <div className="absolute right-3.5 top-3.5 flex flex-col overflow-hidden rounded-xl border border-slate-700/80 bg-slate-900/90 shadow-2xl backdrop-blur-xl ring-1 ring-slate-800">
        <MapButton label="Zoom in" onClick={() => zoomButton(1.5)}>
          <span className="text-base font-bold leading-none text-slate-200">+</span>
        </MapButton>
        <MapButton label="Zoom out" onClick={() => zoomButton(1 / 1.5)}>
          <span className="text-base font-bold leading-none text-slate-200">−</span>
        </MapButton>
        <MapButton label="Reset view" onClick={resetView}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden className="text-slate-300">
            <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
            <path d="M3 3v5h5" />
          </svg>
        </MapButton>
      </div>

      {/* ---- Hover Telemetry HUD readout ---- */}
      {hover && field && scale && (
        <div className="pointer-events-none absolute bottom-3.5 left-3.5 rounded-xl border border-slate-700/80 bg-slate-900/90 px-4 py-3 backdrop-blur-xl shadow-2xl ring-1 ring-slate-800">
          <div className="flex items-center gap-2">
            <span className="inline-block h-2 w-2 rounded-full bg-emerald-400 animate-ping"></span>
            <div className="tnum text-[11px] font-bold text-slate-400">
              {hover.lat.toFixed(3)}°N, {hover.lon.toFixed(3)}°E
            </div>
          </div>
          <div className="tnum mt-1 flex items-center gap-2.5 text-[16px] font-extrabold text-white">
            <span
              className="inline-block h-4 w-4 rounded-md shadow-xs ring-1 ring-white/20"
              style={{ background: hover.value === null ? NO_DATA_COLOR : scale(hover.value) }}
            />
            {hover.value === null
              ? "No data"
              : `${hover.value > 0 && product === "anomaly" ? "+" : ""}${hover.value.toFixed(1)} ${displayUnit(field.unit, indicatorId, product as ProductId)}`}
          </div>
        </div>
      )}

      {loading && (
        <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-emerald-500/40 bg-slate-950/90 px-5 py-2.5 text-xs font-bold text-emerald-300 backdrop-blur-xl shadow-2xl flex items-center gap-3 ring-1 ring-emerald-500/20">
          <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-emerald-400 border-t-transparent"></span>
          <span>DOWNLINKING CMIP6 RASTER FIELD…</span>
        </div>
      )}

      {!field && !loading && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="max-w-sm rounded-xl border border-slate-700 bg-slate-900/90 px-5 py-4 text-center text-xs font-medium text-slate-300 backdrop-blur-xl shadow-2xl">
            No gridded field for this combination. Point and national telemetry are available in the location panel.
          </div>
        </div>
      )}
    </div>
  );
}

function MapButton({
  children,
  label,
  onClick,
}: {
  children: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      onPointerDown={(event) => event.stopPropagation()}
      className="flex h-8 w-8 items-center justify-center border-b border-slate-800 text-slate-300 transition-colors last:border-b-0 hover:bg-slate-800 hover:text-emerald-400 cursor-pointer"
    >
      {children}
    </button>
  );
}
