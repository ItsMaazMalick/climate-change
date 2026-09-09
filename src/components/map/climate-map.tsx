/**
 * Climate Map — public entry point.
 *
 * Leaflet mutates `window` on import, so it must be loaded on the client
 * only. `next/dynamic` with `ssr: false` handles this: the server renders
 * nothing (or a skeleton) and the real component hydrates in the browser.
 */
"use client";

import dynamic from "next/dynamic";

// Re-export the types so existing imports from "@/components/map/climate-map"
// continue to work without any changes in explorer.tsx or elsewhere.
export type { RegionData, RegionValue, MapSelection } from "./leaflet-climate-map";
export type { GeoCollection } from "./projection";

const LeafletClimateMap = dynamic(
  () =>
    import("./leaflet-climate-map").then((mod) => ({ default: mod.ClimateMap })),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full w-full items-center justify-center bg-surface-recessed">
        <div className="flex items-center gap-3 rounded-full border border-leaf bg-surface-panel px-5 py-2.5 text-xs font-semibold text-brand-deep shadow-(--elevation-overlay)">
          <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-leaf border-t-transparent" />
          <span>Loading map…</span>
        </div>
      </div>
    ),
  },
);

export { LeafletClimateMap as ClimateMap };
