"use client";

import dynamic from "next/dynamic";
import type { ScenarioId } from "@/lib/climate/taxonomy";
import type { IofsRankingEntry } from "@/lib/iofs/ranking";

const MemberMapLeaflet = dynamic(
  () => import("./member-map-leaflet").then((mod) => mod.MemberMapLeaflet),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full w-full items-center justify-center bg-surface-recessed text-xs font-medium text-ink-faint">
        Loading map…
      </div>
    ),
  },
);

export function MemberMap(props: {
  ranking: IofsRankingEntry[];
  selected: string;
  onSelect: (iso3: string) => void;
  scenario: ScenarioId;
}) {
  return <MemberMapLeaflet {...props} />;
}
