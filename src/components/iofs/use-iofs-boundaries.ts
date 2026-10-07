"use client";

import { useEffect, useState } from "react";

export interface BoundaryFeature extends GeoJSON.Feature {
  properties: { iso3: string; name: string };
}
export interface BoundaryCollection extends GeoJSON.FeatureCollection {
  features: BoundaryFeature[];
}

/** Real IOFS member country outlines — see `scripts/build-iofs-boundaries.ts`. */
export function useIofsBoundaries(): BoundaryCollection | null {
  const [data, setData] = useState<BoundaryCollection | null>(null);
  useEffect(() => {
    let cancelled = false;
    fetch("/api/iofs/boundaries")
      .then((r) => r.json())
      .then((json: BoundaryCollection) => {
        if (!cancelled) setData(json);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);
  return data;
}
