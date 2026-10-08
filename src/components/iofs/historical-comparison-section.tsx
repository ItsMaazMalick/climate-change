"use client";

import { EmptyState, ErrorState, SkeletonBlock } from "@/components/ui/states";
import { useApi } from "@/lib/hooks";
import type { EnsoSnapshot } from "@/lib/iofs/enso";
import type { EnsoOutlook } from "@/lib/iofs/enso-outlook";

import { EpisodeComparator } from "./episode-comparator";
import { EpisodeRanking } from "./episode-ranking";
import { useTranslatedText } from "./translation-context";

type EnsoPageData = EnsoSnapshot & { outlook: EnsoOutlook | null };

/**
 * "How exceptional is the current event?" — its own top-level section
 * rather than a tail end of the live-status section above, so the page
 * reads as current status → historical context → long-term change → one
 * country, each a deliberate step rather than one section quietly growing
 * past its own scope.
 *
 * Shares `/api/iofs/enso` with `EnsoSection`; `useApi`'s in-flight request
 * de-duplication (`lib/hooks.ts`) means that's one network call either way,
 * not two, so there's no real cost to each section fetching independently
 * instead of threading the same data down through props.
 */
export function HistoricalComparisonSection() {
  const { data, error, loading } = useApi<EnsoPageData>("/api/iofs/enso");
  const unreachableTitle = useTranslatedText("Couldn't reach NOAA's Climate Prediction Center");
  const noDataTitle = useTranslatedText("No ENSO reading available right now");

  if (loading) {
    return (
      <div className="space-y-4">
        <SkeletonBlock height={220} />
        <SkeletonBlock height={200} />
      </div>
    );
  }
  if (error || !data) {
    return <ErrorState title={unreachableTitle} detail={error ?? undefined} />;
  }
  if (!data.current) {
    return <EmptyState title={noDataTitle} />;
  }

  return (
    <div className="space-y-5">
      <EpisodeComparator history={data.history} episodes={data.elNinoEpisodes} current={data.current} />
      <EpisodeRanking episodes={data.elNinoEpisodes} current={data.current} />
    </div>
  );
}
