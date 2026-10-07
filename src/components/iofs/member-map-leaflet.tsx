"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import L from "leaflet";
import { MapContainer, TileLayer, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";

import { buildClassedScale, NO_DATA_COLOR } from "@/lib/colors";
import { formatValue, SCENARIOS, type ScenarioId } from "@/lib/climate/taxonomy";
import type { IofsRankingEntry } from "@/lib/iofs/ranking";
import { useIofsBoundaries, type BoundaryCollection, type BoundaryFeature } from "./use-iofs-boundaries";
import { T, useTranslation } from "./translation-context";

function injectChoroplethStyles() {
  if (typeof document === "undefined" || document.getElementById("iofs-choropleth-styles")) return;
  const style = document.createElement("style");
  style.id = "iofs-choropleth-styles";
  // Leaflet's SVG renderer draws real <path> elements, so a plain CSS
  // transition is enough to turn setStyle()'s instant colour/weight flip on
  // hover into a smooth one — Leaflet itself has no built-in animation here.
  style.textContent = `
    .iofs-choropleth path.leaflet-interactive {
      transition: fill 160ms ease-out, fill-opacity 160ms ease-out, stroke 160ms ease-out, stroke-width 160ms ease-out;
    }
  `;
  document.head.appendChild(style);
}

/** This country's Δtas at 2080–2099 under the selected pathway, or null if unresolved. */
function deltaFor(entry: IofsRankingEntry, scenario: ScenarioId): number | null {
  const points = entry.trajectories.find((t) => t.scenario === scenario)?.points;
  return points?.[points.length - 1]?.delta ?? null;
}

/** The translated country name goes into a Leaflet tooltip as raw HTML — escape it first. */
function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function ChoroplethLayer({
  boundaries,
  ranking,
  selected,
  onSelect,
  scenario,
}: {
  boundaries: BoundaryCollection;
  ranking: IofsRankingEntry[];
  selected: string;
  onSelect: (iso3: string) => void;
  scenario: ScenarioId;
}) {
  const map = useMap();
  const layerRef = useRef<L.GeoJSON | null>(null);
  const { lang, translate } = useTranslation();

  const byIso3 = useMemo(() => new Map(ranking.map((r) => [r.iso3, r])), [ranking]);

  // Leaflet tooltips are raw HTML, outside React, so they can't use <T> —
  // this resolves "Baseline" plus every country name once per language
  // switch and rebuilds the layer (effect below) once they're in. Left empty
  // (and simply not read — see `tr()` below) whenever `lang === "en"`, so
  // there is never a reason to reset this back to English from inside the
  // effect.
  const [resolved, setResolved] = useState<{ baseline: string; names: Record<string, string> } | null>(
    null,
  );
  useEffect(() => {
    if (lang === "en") return;
    let cancelled = false;
    Promise.all([
      translate("Baseline"),
      Promise.all(ranking.map((r) => translate(r.name).then((t) => [r.iso3, t] as const))),
    ]).then(([baseline, pairs]) => {
      if (!cancelled) setResolved({ baseline, names: Object.fromEntries(pairs) });
    });
    return () => {
      cancelled = true;
    };
  }, [lang, translate, ranking]);

  const tooltipText = {
    baseline: lang === "en" ? "Baseline" : (resolved?.baseline ?? "Baseline"),
    names: lang === "en" ? {} : (resolved?.names ?? {}),
  };

  const scale = useMemo(
    () =>
      buildClassedScale({
        values: ranking.map((r) => deltaFor(r, scenario)),
        indicatorId: "tas",
        product: "anomaly",
        classes: 6,
      }),
    [ranking, scenario],
  );

  useEffect(() => {
    injectChoroplethStyles();
  }, []);

  const styleFor = (iso3: string): L.PathOptions => {
    const entry = byIso3.get(iso3);
    const isSelected = iso3 === selected;
    return {
      fillColor: entry ? scale(deltaFor(entry, scenario)) : NO_DATA_COLOR,
      fillOpacity: 0.85,
      color: isSelected ? "#16211a" : "#ffffff",
      weight: isSelected ? 2.2 : 0.8,
    };
  };

  useEffect(() => {
    const layer = L.geoJSON(boundaries as unknown as GeoJSON.GeoJsonObject, {
      style: (feature) => styleFor(String((feature as unknown as BoundaryFeature).properties.iso3)),
      onEachFeature: (feature, featureLayer) => {
        const props = (feature as unknown as BoundaryFeature).properties;
        const entry = byIso3.get(props.iso3);
        const name = escapeHtml(tooltipText.names[props.iso3] ?? props.name);
        featureLayer.bindTooltip(
          `<div style="font-size:12px"><strong>${entry?.flag ?? ""} ${name}</strong><br/>` +
            `${escapeHtml(tooltipText.baseline)} ${formatValue(entry?.baselineTas ?? null, "tas")} · ` +
            `${SCENARIOS[scenario].label} 2080–2099 ${formatValue(entry ? deltaFor(entry, scenario) : null, "tas", "anomaly")}</div>`,
          { sticky: true },
        );
        featureLayer.on({
          mouseover: () => {
            (featureLayer as L.Path).setStyle({ weight: 2.4, color: "#334b35", fillOpacity: 0.96 });
            (featureLayer as L.Path).bringToFront();
          },
          mouseout: () => (featureLayer as L.Path).setStyle(styleFor(props.iso3)),
          click: () => onSelect(props.iso3),
        });
      },
    });
    layer.addTo(map);
    layerRef.current = layer;
    return () => {
      map.removeLayer(layer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, boundaries, byIso3, scale, scenario, tooltipText]);

  // Restyle in place on selection/scenario change, without rebuilding the whole layer.
  useEffect(() => {
    layerRef.current?.eachLayer((featureLayer) => {
      const props = (featureLayer as unknown as { feature: BoundaryFeature }).feature.properties;
      (featureLayer as L.Path).setStyle(styleFor(props.iso3));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, scenario]);

  return null;
}

export function MemberMapLeaflet({
  ranking,
  selected,
  onSelect,
  scenario,
}: {
  ranking: IofsRankingEntry[];
  selected: string;
  onSelect: (iso3: string) => void;
  scenario: ScenarioId;
}) {
  const boundaries = useIofsBoundaries();
  const scale = useMemo(
    () =>
      buildClassedScale({
        values: ranking.map((r) => deltaFor(r, scenario)),
        indicatorId: "tas",
        product: "anomaly",
        classes: 6,
      }),
    [ranking, scenario],
  );

  return (
    <div className="relative h-full w-full">
      <MapContainer
        center={[18, 30]}
        zoom={2}
        minZoom={1}
        worldCopyJump
        className="iofs-choropleth h-full w-full"
        zoomControl={true}
        attributionControl={false}
        style={{ background: "#eef1e8" }}
      >
        <TileLayer
          url="https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}"
          attribution="Tiles &copy; Esri"
          maxZoom={10}
        />
        {boundaries && (
          <ChoroplethLayer
            boundaries={boundaries}
            ranking={ranking}
            selected={selected}
            onSelect={onSelect}
            scenario={scenario}
          />
        )}
      </MapContainer>

      {scale.breaks.length > 0 && (
        <div className="pointer-events-none absolute bottom-3 left-3 z-[1000] rounded-(--radius-control) border border-border/80 bg-surface-panel/95 px-3 py-2 text-2xs shadow-(--elevation-flat)">
          <div className="mb-1 font-semibold text-ink-muted">
            {SCENARIOS[scenario].label} · 2080–2099 <T>warming</T>
          </div>
          <div className="flex overflow-hidden rounded-(--radius-control)">
            {scale.breaks.map((b, i) => (
              <span key={i} className="h-2.5 w-5" style={{ background: b.color }} />
            ))}
          </div>
          <div className="mt-0.5 flex justify-between tabular-nums text-ink-faint">
            <span>+{scale.breaks[0]!.from.toFixed(1)}°C</span>
            <span>+{scale.breaks[scale.breaks.length - 1]!.to.toFixed(1)}°C</span>
          </div>
        </div>
      )}
    </div>
  );
}
