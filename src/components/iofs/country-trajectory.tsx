"use client";

import { useState } from "react";

import { IndicatorPicker, PeriodPicker } from "@/components/controls";
import { TimeSeriesChart, type SeriesLine } from "@/components/charts/time-series";
import { ErrorState, SkeletonBlock } from "@/components/ui/states";
import { ScenarioTrajectoryCard } from "./scenario-trajectory-card";
import { useApi } from "@/lib/hooks";
import type { CountryClimate } from "@/lib/iofs/climate";
import { iofsMember } from "@/lib/iofs/members";
import { scenarioColorVar } from "@/lib/climate/scenario-style";
import { HEADLINE_SCENARIO_IDS, SCENARIOS, type PeriodId } from "@/lib/climate/taxonomy";
import { T, useTranslatedText } from "./translation-context";

export function CountryTrajectory({ country }: { country: string }) {
  const [indicator, setIndicator] = useState("tas");
  const [period, setPeriod] = useState<PeriodId>("2080-2099");

  const scenarioParam = HEADLINE_SCENARIO_IDS.join(",");
  const { data, error, loading } = useApi<CountryClimate>(
    `/api/iofs/climate?country=${country}&indicator=${indicator}&scenarios=${scenarioParam}`,
    [country, indicator],
  );

  const member = iofsMember(country);
  const errorTitle = useTranslatedText("Couldn't load this country's projection");

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="label">
            <T>Climate change, 1950 → 2099</T>
          </p>
          <h3 className="mt-1 text-lg font-semibold text-ink">
            {member?.flag} <T>{member?.name ?? country}</T>
          </h3>
        </div>
        <div className="flex flex-wrap items-end gap-4">
          <div className="w-48">
            <span className="label mb-1.5 block">
              <T>Indicator</T>
            </span>
            <IndicatorPicker value={indicator} onChange={setIndicator} griddedOnly />
          </div>
        </div>
      </div>

      {loading && <SkeletonBlock height={260} />}
      {error && <ErrorState title={errorTitle} detail={error} />}

      {data && (
        <>
          <div>
            <span className="label mb-1.5 block">
              <T>Horizon for the cards below</T>
            </span>
            <PeriodPicker value={period} onChange={setPeriod} includeBaseline={false} />
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {HEADLINE_SCENARIO_IDS.map((scenario) => {
              const delta = data.anomalies[scenario]?.[period] ?? null;
              return (
                <ScenarioTrajectoryCard
                  key={`${scenario}:${indicator}:${country}`}
                  scenario={scenario}
                  indicatorId={indicator}
                  series={data.series[scenario] ?? []}
                  baseline={data.baseline}
                  delta={delta}
                  period={period}
                />
              );
            })}
          </div>

          <div className="tier-flat p-5">
            <h4 className="mb-3 text-sm font-semibold text-ink">
              <T>Annual trajectory under each pathway</T>
            </h4>
            <TimeSeriesChart
              lines={buildLines(data)}
              unit={indicator === "pr" ? "mm" : "°C"}
              indicatorId={indicator}
              height={300}
            />
          </div>

          <p className="text-2xs leading-relaxed text-ink-faint">
            <T>
              World Bank Climate Change Knowledge Portal — CMIP6 (0.25°), ensemble median. The
              shared line before 2015 is the observed-forcing historical run; each pathway
              diverges from it after that, exactly as published by the archive — nothing here is
              interpolated between the two.
            </T>
          </p>
        </>
      )}
    </div>
  );
}

function buildLines(data: CountryClimate): SeriesLine[] {
  return HEADLINE_SCENARIO_IDS.filter((id) => data.series[id]).map((id) => ({
    id,
    label: SCENARIOS[id].label,
    color: scenarioColorVar(id),
    points: data.series[id]!,
  }));
}
