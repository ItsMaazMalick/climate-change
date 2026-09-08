"use client";

import { useState } from "react";

import {
  ModelSpread,
  TimeSeriesChart,
} from "@/components/charts";
import {
  Field,
  IndicatorPicker,
  PeriodPicker,
  PlaceSearch,
} from "@/components/controls";
import type { Place } from "@/lib/climate/places";
import {
  formatValue,
  HEADLINE_SCENARIO_IDS,
  SCENARIOS,
  SCENARIO_GENERATIONS,
  type Indicator,
  type PeriodId,
  type ScenarioId,
} from "@/lib/climate/taxonomy";
import { useApi } from "@/lib/hooks";

interface ScenariosResponse {
  indicator: Indicator;
  results: Array<{
    scenario: { id: ScenarioId };
    anomaly: number | null;
    value: number | null;
  }>;
  divergence: string | null;
}

interface ModelsResponse {
  spread: { median: number | null; p10: number | null; p90: number | null };
  description: string;
  confidence: "strong" | "moderate" | "weak";
  members: Array<{ model: string; label: string; ecs: number | null; value: number | null }>;
  membersScope: string | null;
}

interface TrajectoryResponse {
  unit: string;
  note: string;
  lines: Array<{
    id: ScenarioId;
    label: string;
    color: string;
    points: Array<{ year: number; value: number | null }>;
  }>;
}

/**
 * The comparison workspace.
 *
 * Three axes of disagreement, each on its own: which pathway the world takes,
 * which model you believe, and how far ahead you look. Separating them is the
 * point — a single number conflates all three and a reader has no way to tell
 * which one is driving the answer.
 */
import { useCountry } from "@/lib/country-context";

export function ComparePanel({ places }: { places: Place[] }) {
  const { country: countryCode, config } = useCountry();
  const countryPlaces = places.filter((p) => p.country === countryCode);

  const [place, setPlace] = useState<Place>(() => {
    return countryPlaces.find((p) => p.id === config.defaultCityId) ?? countryPlaces[0] ?? places[0]!;
  });

  // Switch default place when country changes
  const [currentCountry, setCurrentCountry] = useState(countryCode);
  if (currentCountry !== countryCode) {
    setCurrentCountry(countryCode);
    const nextPlace = countryPlaces.find((p) => p.id === config.defaultCityId) ?? countryPlaces[0] ?? places[0]!;
    setPlace(nextPlace);
  }

  const [indicator, setIndicator] = useState("tas");
  const [period, setPeriod] = useState<PeriodId>("2040-2059");
  const [scenario, setScenario] = useState<ScenarioId>("ssp245");
  const [showMembers, setShowMembers] = useState(false);

  const point = `lat=${place.lat}&lon=${place.lon}&indicator=${indicator}`;

  const scenarios = useApi<ScenariosResponse>(
    `/api/climate/scenarios?${point}&period=${period}`,
  );
  const models = useApi<ModelsResponse>(
    `/api/climate/models?${point}&scenario=${scenario}&period=${period}&models=${showMembers}`,
  );
  const trajectory = useApi<TrajectoryResponse>(
    `/api/climate/trajectory?indicator=${indicator}&geography=${countryCode}&smooth=11`,
  );

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <header className="mb-8 max-w-2xl">
        <div className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[12px] font-bold text-emerald-800 mb-3 shadow-xs">
          <span>{config.flag}</span>
          <span>Climate Uncertainty Workspace · {config.name}</span>
        </div>
        <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">Multi-Dimensional Climate Comparison</h1>
        <p className="mt-2 text-[14px] leading-relaxed text-slate-600 font-medium">
          Three different scientific factors shape the future climate of a
          place: which global emissions pathway humanity follows, how independent
          climate models differ, and how far ahead you look.
        </p>
      </header>

      {/* ---------------------------------------------------- controls -- */}
      <div className="mb-8 grid gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:grid-cols-3">
        <Field label="Target Location">
          <PlaceSearch
            places={countryPlaces}
            onSelect={(selected) => {
              const match = countryPlaces.find((p) => p.id === selected.id);
              if (match) setPlace(match);
            }}
          />
          <p className="tnum mt-1.5 text-[11.5px] font-medium text-slate-500">
            📍 {place.name} ({place.province}) · {place.lat.toFixed(2)}°N, {place.lon.toFixed(2)}°E
          </p>
        </Field>
        <Field label="Climate Indicator">
          <IndicatorPicker value={indicator} onChange={setIndicator} />
        </Field>
        <Field label="Future Horizon">
          <PeriodPicker value={period} onChange={setPeriod} includeBaseline={false} />
        </Field>
      </div>

      {/* ------------------------------------------- 1. pathways -------- */}
      <Section
        index={1}
        title="Uncertainty about Policy Pathway"
        subtitle="Same place, same models, same horizon — only the emissions assumption changes. This gap represents policy choices, not model error."
      >
        {scenarios.data ? (
          <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
            <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
              <table className="w-full min-w-[420px] text-[13px]">
                <thead>
                  <tr className="border-b border-slate-100">
                    <th className="py-2.5 text-left font-bold text-slate-500 text-[11px] uppercase tracking-wider">Pathway</th>
                    <th className="py-2.5 text-left font-bold text-slate-500 text-[11px] uppercase tracking-wider">Storyline</th>
                    <th className="py-2.5 text-right font-bold text-slate-500 text-[11px] uppercase tracking-wider">Value</th>
                    <th className="py-2.5 text-right font-bold text-slate-500 text-[11px] uppercase tracking-wider">Change (Δ)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {scenarios.data.results.map((row) => {
                    const meta = SCENARIOS[row.scenario.id];
                    return (
                      <tr
                        key={row.scenario.id}
                        className="hover:bg-slate-50/70 transition-colors"
                      >
                        <td className="py-3 pr-3">
                          <span className="flex items-center gap-2 font-bold text-slate-900">
                            <span
                              className="inline-block h-3 w-3 shrink-0 rounded-full shadow-xs ring-2 ring-white"
                              style={{ background: meta.color }}
                            />
                            {meta.label}
                          </span>
                        </td>
                        <td className="py-3 pr-3 text-[12px] text-slate-500">
                          {meta.narrative}
                        </td>
                        <td className="tnum py-3 text-right text-slate-600 font-medium">
                          {formatValue(row.value, indicator)}
                        </td>
                        <td className="tnum py-3 text-right font-bold text-slate-900">
                          {formatValue(row.anomaly, indicator, "anomaly")}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <aside className="rounded-2xl border border-slate-200 bg-gradient-to-b from-slate-50 to-white p-5 shadow-xs">
              <div className="label mb-2 text-slate-500 font-bold">Policy Implication</div>
              <p className="text-[12.5px] leading-relaxed text-slate-700 font-medium">
                {scenarios.data.divergence ??
                  "The pathways have not meaningfully diverged for this indicator at this horizon."}
              </p>
            </aside>
          </div>
        ) : (
          <Skeleton height={180} />
        )}
      </Section>

      {/* ------------------------------------------- 2. models ---------- */}
      <Section
        index={2}
        title="Uncertainty between 30 Downscaled Models"
        subtitle="Same place, same pathway, same horizon — thirty different global climate models from international modeling centers."
      >
        <div className="mb-4 flex flex-wrap items-center gap-2">
          {HEADLINE_SCENARIO_IDS.map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => setScenario(id)}
              aria-pressed={scenario === id}
              className={`rounded-lg border px-3 py-1.5 text-[12px] font-bold transition-all shadow-xs ${
                scenario === id
                  ? "border-transparent text-white ring-2 ring-offset-1 ring-slate-300"
                  : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50"
              }`}
              style={
                scenario === id ? { background: SCENARIOS[id].color } : undefined
              }
            >
              {SCENARIOS[id].label}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setShowMembers((current) => !current)}
            className="ml-auto rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[12px] font-semibold text-slate-700 transition-all hover:bg-slate-50 hover:border-slate-300 shadow-xs"
          >
            {showMembers ? "Hide individual models" : "Show all 30 models"}
          </button>
        </div>

        {models.data ? (
          <>
            <ModelSpread
              median={models.data.spread.median}
              p10={models.data.spread.p10}
              p90={models.data.spread.p90}
              members={showMembers ? models.data.members : undefined}
              indicatorId={indicator}
              color={SCENARIOS[scenario].color}
            />
            <p className="mt-3 max-w-2xl text-[12.5px] leading-relaxed text-[var(--color-ink-muted)]">
              {models.data.description}
            </p>
            {showMembers && models.data.members.length > 0 && (
              <>
                <p className="mt-3 text-[11.5px] text-[var(--color-ink-faint)]">
                  Individual models are published as national aggregates only, so
                  these values describe Pakistan as a whole rather than{" "}
                  {place.name}. Equilibrium climate sensitivity (ECS) is each
                  model&rsquo;s long-run warming per doubling of CO₂ — the single
                  best predictor of where it sits in this range.
                </p>
                <div className="mt-3 grid gap-1 sm:grid-cols-2 lg:grid-cols-3">
                  {models.data.members.map((member) => (
                    <div
                      key={member.model}
                      className="flex items-baseline justify-between gap-2 rounded border border-[var(--color-border)] bg-[var(--color-surface)] px-2.5 py-1.5"
                    >
                      <span className="truncate text-[11.5px]">{member.label}</span>
                      <span className="tnum shrink-0 text-[11.5px] font-semibold">
                        {formatValue(member.value, indicator, "anomaly")}
                        {member.ecs && (
                          <span className="ml-1.5 font-normal text-[var(--color-ink-faint)]">
                            ECS {member.ecs}
                          </span>
                        )}
                      </span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </>
        ) : (
          <Skeleton height={110} />
        )}
      </Section>

      {/* ------------------------------------------- 3. time ------------ */}
      <Section
        index={3}
        title="Uncertainty about when"
        subtitle="Near-term change is largely determined by emissions already released. The pathways separate later — which is why the same map looks very different at 2030 and at 2090."
      >
        {trajectory.data && trajectory.data.lines.length > 0 ? (
          <>
            <TimeSeriesChart
              lines={trajectory.data.lines}
              unit={trajectory.data.unit}
              yLabel={indicator}
              indicatorId={indicator}
            />
            <p className="mt-2.5 text-[11.5px] text-[var(--color-ink-faint)]">
              {trajectory.data.note}
            </p>
          </>
        ) : (
          <Skeleton height={240} />
        )}
      </Section>

      {/* ------------------------------------------- generations -------- */}
      <Section
        index={4}
        title="CMIP5 and CMIP6 are not the same thing"
        subtitle="Older studies and datasets use RCPs. They are not interchangeable with SSPs, and matching the forcing number is not the same as matching the scenario."
      >
        <div className="grid gap-3 sm:grid-cols-2">
          {Object.values(SCENARIO_GENERATIONS).map((generation) => (
            <div
              key={generation.id}
              className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4"
            >
              <div className="flex items-baseline justify-between">
                <h3 className="text-[14px] font-semibold">{generation.label}</h3>
                <span className="text-[11px] text-[var(--color-ink-faint)]">
                  {generation.era}
                </span>
              </div>
              <p className="mt-1 text-[11.5px] text-[var(--color-ink-faint)]">
                {generation.ipccReport} · {generation.scenarioFamily} scenarios
              </p>
              <div className="mt-2.5 flex flex-wrap gap-1">
                {generation.scenarios.map((name) => (
                  <span
                    key={name}
                    className="rounded border border-[var(--color-border)] px-1.5 py-0.5 font-mono text-[10.5px] text-[var(--color-ink-muted)]"
                  >
                    {name}
                  </span>
                ))}
              </div>
              <p className="mt-2.5 text-[12px] leading-relaxed text-[var(--color-ink-muted)]">
                {generation.note}
              </p>
            </div>
          ))}
        </div>
      </Section>
    </div>
  );
}

function Section({
  index,
  title,
  subtitle,
  children,
}: {
  index: number;
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-10">
      <div className="mb-4 flex gap-3">
        <span className="tnum mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-[var(--color-border-strong)] text-[11px] font-semibold text-[var(--color-ink-faint)]">
          {index}
        </span>
        <div className="max-w-2xl">
          <h2 className="text-[16px] font-semibold tracking-tight">{title}</h2>
          <p className="mt-1 text-[12.5px] leading-relaxed text-[var(--color-ink-muted)]">
            {subtitle}
          </p>
        </div>
      </div>
      {children}
    </section>
  );
}

function Skeleton({ height }: { height: number }) {
  return (
    <div
      className="animate-pulse rounded-lg bg-[var(--color-surface-hover)]"
      style={{ height }}
    />
  );
}
