"use client";

import { useState } from "react";
import { MapPin } from "lucide-react";

import { PageHeader } from "@/components/ui/page-header";
import { ErrorState, SkeletonBlock } from "@/components/ui/states";
import { useApi } from "@/lib/hooks";
import type { ScenarioId } from "@/lib/climate/taxonomy";
import { DEFAULT_IOFS_MEMBER } from "@/lib/iofs/members";
import type { IofsRankingEntry } from "@/lib/iofs/ranking";

import { EnsoSection } from "./enso-section";
import { InfoButton, InfoDialogProvider } from "./info-dialog";
import { LanguageSwitcher } from "./language-switcher";
import { MemberSelect } from "./member-select";
import { MemberMap } from "./member-map";
import { RankingTable } from "./ranking-table";
import { CountryTrajectory } from "./country-trajectory";
import {
  T,
  TranslationProvider,
  useTranslatedText,
} from "./translation-context";

export function IofsDashboard() {
  return (
    <TranslationProvider>
      <InfoDialogProvider>
        <IofsDashboardContent />
      </InfoDialogProvider>
    </TranslationProvider>
  );
}

function IofsDashboardContent() {
  const [country, setCountry] = useState(DEFAULT_IOFS_MEMBER);
  const [scenario, setScenario] = useState<ScenarioId>("ssp245");
  const {
    data: ranking,
    error,
    loading,
  } = useApi<IofsRankingEntry[]>("/api/iofs/ranking");

  const pageTitle = useTranslatedText(
    "El Niño, Super El Niño & Climate Change Across IOFS Member States",
  );
  const rankingErrorTitle = useTranslatedText(
    "Couldn't load the member ranking",
  );

  return (
    <div className="mx-auto max-w-[1200px] px-4 pb-16 pt-6 sm:px-6">
      <LanguageSwitcher />

      <PageHeader kicker="" title={pageTitle}>
        <T>
          {
            "Explore today's live ENSO conditions, compare them with past Super El Niño events, and discover each IOFS Member State's CMIP6 climate projections from 1950 to 2099"
          }
        </T>
      </PageHeader>

      <section className="mb-10">
        <SectionTitle
          n={1}
          title="El Niño right now"
          subtitle="Live from NOAA's Climate Prediction Center"
          infoId="enso-status"
        />
        <EnsoSection />
      </section>

      <section className="mb-10">
        <SectionTitle
          n={2}
          title="Projected warming across the IOFS"
          subtitle="All four emissions pathways, 1995–2014 baseline through 2080–2099 — ensemble median, World Bank CCKP"
          infoId="warming-fan-chart"
        />
        {loading && <SkeletonBlock height={420} />}
        {error && <ErrorState title={rankingErrorTitle} detail={error} />}
        {ranking && (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.3fr_1fr]">
            <div className="tier-flat h-[420px] overflow-hidden p-0">
              <MemberMap
                ranking={ranking}
                selected={country}
                onSelect={setCountry}
                scenario={scenario}
              />
            </div>
            <div className="tier-flat p-3">
              <RankingTable
                ranking={ranking}
                selected={country}
                onSelect={setCountry}
                scenario={scenario}
                onScenarioChange={setScenario}
              />
            </div>
          </div>
        )}
        <p className="mt-2 flex items-center gap-1.5 text-2xs text-ink-faint">
          <MapPin className="h-3 w-3" />
          <T>
            Click a country on the map or in the table to open its full
            trajectory below.
          </T>
        </p>
      </section>

      <section>
        <SectionTitle
          n={3}
          title="One member's climate, 1950 → 2099"
          subtitle="Pick any IOFS member state and emissions pathway"
          infoId="cmip6-baseline"
        />
        <div className="mb-4 w-64">
          <MemberSelect value={country} onChange={setCountry} />
        </div>
        <CountryTrajectory country={country} />
        {/* <DataProvenanceFooter
          variable={iofsMember(country)?.name ?? country}
          aggregation="Annual, ensemble median"
          epoch="1950–2099"
          csv={
            ranking
              ? () => ({
                  filename: `iofs-ranking-tas-ssp245-2080-2099.csv`,
                  content: toCsv(
                    [
                      "iso3",
                      "country",
                      "region",
                      "baseline_tas_c",
                      "delta_tas_ssp245_c",
                      "delta_tas_ssp585_c",
                    ],
                    ranking.map((r) => [
                      r.iso3,
                      r.name,
                      r.region,
                      r.baselineTas,
                      r.deltaTasSsp245,
                      r.deltaTasSsp585,
                    ]),
                  ),
                })
              : undefined
          }
        /> */}
      </section>
    </div>
  );
}

function SectionTitle({
  n,
  title,
  subtitle,
  infoId,
}: {
  n: number;
  title: string;
  subtitle: string;
  infoId?: string;
}) {
  return (
    <div className="mb-4 flex items-baseline gap-2.5">
      <span
        className="flex h-5 w-5 shrink-0 items-center justify-center rounded-(--radius-pill) bg-ink text-[11px] font-semibold text-ink-inverse tabular-nums"
        data-numeric
      >
        {n}
      </span>
      <div>
        <h2 className="flex items-center gap-1 text-base font-semibold text-ink">
          <T>{title}</T>
          {infoId && <InfoButton id={infoId} label={title} />}
        </h2>
        <p className="text-xs text-ink-faint">
          <T>{subtitle}</T>
        </p>
      </div>
    </div>
  );
}
