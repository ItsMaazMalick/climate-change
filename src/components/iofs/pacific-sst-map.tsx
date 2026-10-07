"use client";

import dynamic from "next/dynamic";

const PacificSstMapLeaflet = dynamic(
  () => import("./pacific-sst-map-leaflet").then((mod) => mod.PacificSstMapLeaflet),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full w-full items-center justify-center bg-[#16211a] text-xs font-medium text-white/60">
        Loading live sea-surface imagery…
      </div>
    ),
  },
);

export function PacificSstMap() {
  return <PacificSstMapLeaflet />;
}
