"use client";

import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import { MapContainer, TileLayer, useMap, useMapEvents } from "react-leaflet";
import "leaflet/dist/leaflet.css";

import { IOFS_MEMBERS } from "@/lib/iofs/members";
import { useIofsBoundaries } from "./use-iofs-boundaries";
import { T, useTranslation } from "./translation-context";

// NASA GIBS WMS — the same free, key-free endpoint the ESS ENSO dashboard
// uses, serving near-real-time sea-surface-temperature imagery. TIME is left
// unset so GIBS serves its own declared "most recent" layer rather than a
// date this code would otherwise have to keep up to date by hand.
const GIBS_WMS = "https://gibs.earthdata.nasa.gov/wms/epsg3857/best/wms.cgi";
const BASE_TILES =
  "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}";

type Mode = "anom" | "sst";

const LAYER_FOR: Record<Mode, string> = {
  anom: "GHRSST_L4_MUR_Sea_Surface_Temperature_Anomalies",
  sst: "GHRSST_L4_MUR_Sea_Surface_Temperature",
};

/** Translated country names go into Leaflet divIcon HTML as raw markup — escape them first. */
function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function injectLabelStyles() {
  if (typeof document === "undefined" || document.getElementById("iofs-pacific-label-styles")) return;
  const style = document.createElement("style");
  style.id = "iofs-pacific-label-styles";
  style.textContent = `
    .iofs-country-label span {
      display: inline-block;
      white-space: nowrap;
      transform: translate(-50%, -50%);
      font-size: 10px;
      font-weight: 600;
      color: #f3f7ec;
      text-shadow: 0 0 3px #000, 0 0 3px #000, 0 1px 2px #000;
      pointer-events: none;
    }
  `;
  document.head.appendChild(style);
}

function WmsLayer({ mode, onHealth }: { mode: Mode; onHealth: (ok: boolean) => void }) {
  const map = useMap();
  const layerRef = useRef<L.TileLayer.WMS | null>(null);

  useEffect(() => {
    const layer = L.tileLayer.wms(GIBS_WMS, {
      layers: LAYER_FOR[mode],
      format: "image/png",
      transparent: true,
      version: "1.3.0",
      opacity: 0.88,
    });
    layer.addTo(map);
    layerRef.current = layer;

    let sawTile = false;
    const timeout = setTimeout(() => {
      if (!sawTile) onHealth(false);
    }, 9000);
    layer.on("tileload", () => {
      sawTile = true;
      onHealth(true);
    });

    return () => {
      clearTimeout(timeout);
      map.removeLayer(layer);
    };
  }, [map, mode, onHealth]);

  return null;
}

/**
 * Real outlines (from the same `/api/iofs/boundaries` file the warming map
 * uses) plus a name label at each member's centroid, so the 43 IOFS states
 * are identifiable directly on the sea-surface imagery rather than inferred
 * from the surrounding, unlabelled coastline.
 *
 * Labels are hidden only at the very first zoom-out (zoom 1), where all 43
 * would overlap into an unreadable cluster; they show from the default view
 * (zoom 2) onward, and dense clusters — the Gulf, the Sahel — read clearly
 * once zoomed in further.
 */
function IofsBordersAndLabels() {
  const map = useMap();
  const boundaries = useIofsBoundaries();
  const [zoom, setZoom] = useState(map.getZoom());
  useMapEvents({ zoomend: () => setZoom(map.getZoom()) });
  const { lang, translate } = useTranslation();

  useEffect(() => {
    injectLabelStyles();
  }, []);

  // Country labels are Leaflet divIcon HTML, outside React — resolve every
  // member's name for the current language once, the same batching
  // `MemberMapLeaflet`'s tooltip uses for the same reason.
  const [names, setNames] = useState<Record<string, string> | null>(null);
  useEffect(() => {
    if (lang === "en") return;
    let cancelled = false;
    Promise.all(IOFS_MEMBERS.map((m) => translate(m.name).then((t) => [m.iso3, t] as const))).then(
      (pairs) => {
        if (!cancelled) setNames(Object.fromEntries(pairs));
      },
    );
    return () => {
      cancelled = true;
    };
  }, [lang, translate]);
  const nameFor = (iso3: string, fallback: string) =>
    lang === "en" ? fallback : (names?.[iso3] ?? fallback);

  const outlineRef = useRef<L.GeoJSON | null>(null);
  const labelsRef = useRef<L.LayerGroup | null>(null);

  useEffect(() => {
    if (!boundaries) return;
    const layer = L.geoJSON(boundaries as unknown as GeoJSON.GeoJsonObject, {
      style: { fill: false, color: "#e8f3d6", weight: 1, opacity: 0.55 },
      interactive: false,
    });
    layer.addTo(map);
    outlineRef.current = layer;
    return () => {
      map.removeLayer(layer);
    };
  }, [map, boundaries]);

  useEffect(() => {
    const group = L.layerGroup();
    if (zoom >= 2) {
      for (const member of IOFS_MEMBERS) {
        const icon = L.divIcon({
          className: "iofs-country-label",
          html: `<span>${escapeHtml(nameFor(member.iso3, member.name))}</span>`,
          iconSize: [0, 0],
        });
        L.marker(member.centroid, { icon, interactive: false }).addTo(group);
      }
    }
    group.addTo(map);
    labelsRef.current = group;
    return () => {
      map.removeLayer(group);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, zoom, names, lang]);

  return null;
}

function Nino34Overlay() {
  const map = useMap();
  const { lang, translate } = useTranslation();
  const [resolved, setResolved] = useState<{ label: string; desc: string } | null>(null);

  useEffect(() => {
    if (lang === "en") return;
    let cancelled = false;
    Promise.all([translate("Niño 3.4 region"), translate("primary ENSO monitoring zone")]).then(
      ([label, desc]) => {
        if (!cancelled) setResolved({ label, desc });
      },
    );
    return () => {
      cancelled = true;
    };
  }, [lang, translate]);

  const label = lang === "en" ? "Niño 3.4 region" : (resolved?.label ?? "Niño 3.4 region");
  const desc = lang === "en" ? "primary ENSO monitoring zone" : (resolved?.desc ?? "primary ENSO monitoring zone");

  useEffect(() => {
    const bounds = L.latLngBounds([-5, -170], [5, -120]);
    const rect = L.rectangle(bounds, {
      color: "#8dc53d",
      weight: 2,
      fillOpacity: 0,
      dashArray: "6, 4",
    }).addTo(map);
    rect.bindTooltip(`${label} · 5°N–5°S, 170°W–120°W · ${desc}`, { sticky: true });
    return () => {
      map.removeLayer(rect);
    };
  }, [map, label, desc]);
  return null;
}

export function PacificSstMapLeaflet() {
  const [mode, setMode] = useState<Mode>("anom");
  const [healthy, setHealthy] = useState(true);

  return (
    <div className="relative h-full w-full">
      <div className="absolute left-3 top-3 z-[1000] flex gap-1 rounded-(--radius-pill) border border-white/10 bg-black/40 p-1 backdrop-blur-sm">
        {(["anom", "sst"] as Mode[]).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => {
              setMode(m);
              setHealthy(true);
            }}
            className={`rounded-(--radius-pill) px-3 py-1.5 text-2xs font-semibold transition-all duration-150 active:scale-95 ${
              mode === m ? "bg-white text-ink shadow-[0_2px_8px_rgba(0,0,0,0.25)]" : "text-white/80 hover:bg-white/10 hover:text-white"
            }`}
          >
            <T>{m === "anom" ? "SST Anomaly" : "Sea Surface Temp"}</T>
          </button>
        ))}
      </div>

      <div className="absolute bottom-3 left-3 z-[1000] rounded-(--radius-control) border border-white/10 bg-black/40 px-3 py-2 text-2xs text-white/85 backdrop-blur-sm">
        <div className="mb-1 font-semibold">
          <T>{mode === "anom" ? "SST Anomaly (°C)" : "Sea Surface Temp (°C)"}</T>
        </div>
        <div
          className="h-2 w-40 rounded-(--radius-pill)"
          style={{
            background:
              mode === "anom"
                ? "linear-gradient(to right,#1e40af,#3b82f6,#93c5df,#f8fafc,#fca5a5,#ef4444,#991b1b)"
                : "linear-gradient(to right,#1e3a5f,#1d4ed8,#0ea5e9,#34d399,#facc15,#f97316,#9f1239)",
          }}
        />
        <div className="mt-0.5 flex justify-between">
          <span>{mode === "anom" ? "−3°C" : "0°C"}</span>
          <span>{mode === "anom" ? "+3°C" : "32°C"}</span>
        </div>
      </div>

      {!healthy && (
        <div className="pointer-events-none absolute left-1/2 top-3 z-[1000] -translate-x-1/2 rounded-(--radius-control) border border-amber-400/40 bg-black/70 px-3 py-2 text-2xs text-amber-200">
          <T>
            NASA GIBS imagery is slow to respond right now — the basemap is still live, only the
            temperature overlay is affected.
          </T>
        </div>
      )}

      <MapContainer
        center={[10, 55]}
        zoom={2}
        minZoom={1}
        className="h-full w-full"
        zoomControl={false}
        attributionControl={false}
        style={{ background: "#16211a" }}
      >
        <TileLayer url={BASE_TILES} maxZoom={6} />
        <WmsLayer mode={mode} onHealth={setHealthy} />
        <IofsBordersAndLabels />
        <Nino34Overlay />
      </MapContainer>

      <div className="absolute bottom-1 right-2 z-[1000] text-[10px] text-white/50">
        SST: NASA GIBS (GHRSST L4 MUR) · Basemap: Esri
      </div>
    </div>
  );
}
