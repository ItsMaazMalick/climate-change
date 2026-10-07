import { cached } from "@/lib/cache";
import { fetchCckp } from "@/lib/climate/cckp";
import {
  ENSEMBLE_ID,
  FUTURE_PERIOD_IDS,
  HEADLINE_SCENARIO_IDS,
  type PeriodId,
  type ScenarioId,
} from "@/lib/climate/taxonomy";
import { IOFS_MEMBERS, type IofsRegion } from "./members";

/**
 * All 43 IOFS members' projected average-temperature change, ensemble
 * median, across all four headline SSPs — real CCKP values, used to colour
 * the overview map, rank the table, and draw each country's own four-pathway
 * warming comparison as a sparkline.
 *
 * Pre-warmed by `pnpm iofs:warm` into the on-disk cache `fetchCckp` already
 * maintains, so the page itself never pays the 1–3 s-per-call upstream
 * latency; it just reads the same cache the warm script filled.
 */

export interface TrajectoryPoint {
  period: PeriodId;
  /** Ensemble-median Δtas vs the 1995–2014 baseline. */
  delta: number | null;
}

export interface ScenarioTrajectory {
  scenario: ScenarioId;
  points: TrajectoryPoint[];
}

export interface IofsRankingEntry {
  iso3: string;
  name: string;
  flag: string;
  region: IofsRegion;
  centroid: [number, number];
  baselineTas: number | null;
  /** Ranking sort key — SSP2-4.5 at 2080–2099, the scenario most often read as "the" projection. */
  deltaTasSsp245: number | null;
  deltaTasSsp585: number | null;
  /** One real trajectory per headline SSP, for the ranking table's comparison sparkline. */
  trajectories: ScenarioTrajectory[];
}

async function fetchOne(iso3: string): Promise<Pick<
  IofsRankingEntry,
  "baselineTas" | "deltaTasSsp245" | "deltaTasSsp585" | "trajectories"
>> {
  const jobs: Array<Promise<{ value: number | null } | null>> = [
    fetchCckp({
      geography: iso3,
      variable: "tas",
      product: "climatology",
      aggregation: "annual",
      period: "1995-2014",
      percentile: "median",
      scenario: "historical",
      model: ENSEMBLE_ID,
    }),
  ];
  for (const scenario of HEADLINE_SCENARIO_IDS) {
    for (const period of FUTURE_PERIOD_IDS) {
      jobs.push(
        fetchCckp({
          geography: iso3,
          variable: "tas",
          product: "anomaly",
          aggregation: "annual",
          period,
          percentile: "median",
          scenario,
          model: ENSEMBLE_ID,
        }),
      );
    }
  }

  const [baseline, ...results] = await Promise.all(jobs);

  const trajectories: ScenarioTrajectory[] = HEADLINE_SCENARIO_IDS.map((scenario, s) => ({
    scenario,
    points: FUTURE_PERIOD_IDS.map((period, p) => ({
      period,
      delta: results[s * FUTURE_PERIOD_IDS.length + p]?.value ?? null,
    })),
  }));

  const ssp245 = trajectories.find((t) => t.scenario === "ssp245");
  const ssp585 = trajectories.find((t) => t.scenario === "ssp585");

  return {
    baselineTas: baseline?.value ?? null,
    deltaTasSsp245: ssp245?.points[ssp245.points.length - 1]?.delta ?? null,
    deltaTasSsp585: ssp585?.points[ssp585.points.length - 1]?.delta ?? null,
    trajectories,
  };
}

export async function getIofsRanking(): Promise<IofsRankingEntry[]> {
  return cached(
    "iofs:ranking:tas-trajectory:v3",
    async () => {
      const entries = await Promise.all(
        IOFS_MEMBERS.map(async (member) => ({
          iso3: member.iso3,
          name: member.name,
          flag: member.flag,
          region: member.region,
          centroid: member.centroid,
          ...(await fetchOne(member.iso3)),
        })),
      );
      return entries;
    },
    { ttlMs: 30 * 24 * 60 * 60 * 1000 },
  );
}
