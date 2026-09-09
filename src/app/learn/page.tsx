import Link from "next/link";

import {
  MODELS,
  PERIODS,
  RCP_SCENARIOS,
  SCENARIOS,
  SSP_IDS,
  indicatorsByFamily,
} from "@/lib/climate/taxonomy";
import { MECHANISMS } from "@/lib/climate/interpret";

export const metadata = {
  title: "Learn",
  description:
    "What climate scenarios are, why models disagree, and how to read a projection without over-reading it.",
};

/**
 * The education layer.
 *
 * A map without this is a machine for producing confident misreadings. Almost
 * every serious misuse of climate projections traces back to one of four
 * confusions — weather for climate, scenario for forecast, one model for the
 * truth, or hazard for risk — and each gets its own section here.
 */
export default function LearnPage() {
  return (
    <div className="mx-auto max-w-3xl px-5 py-10">
      <header className="mb-10">
        <h1 className="text-[28px] font-semibold leading-tight tracking-tight">
          How to read a climate projection
        </h1>
        <p className="mt-3 text-[14.5px] leading-relaxed text-[var(--color-ink-muted)]">
          Everything on this platform is a projection: a statement about the
          statistics of a future climate under an assumed emissions pathway.
          Reading one correctly means knowing what it is not.
        </p>
      </header>

      {/* ---------------------------------------------- four questions -- */}
      <Section title="Four different questions">
        <p className="mb-4 text-[14px] leading-relaxed text-[var(--color-ink-muted)]">
          These sound similar and are answered by completely different science.
          Conflating them is the most common error in public discussion of
          climate.
        </p>
        <dl className="space-y-3">
          {[
            {
              q: "What will the temperature in Rawalpindi be tomorrow?",
              a: "Weather. An initial-value problem — you need to know the current state of the atmosphere very precisely. Skill collapses after about ten days.",
              tag: "Weather forecast",
            },
            {
              q: "What is Rawalpindi's typical temperature?",
              a: "Climate. The statistics of weather over decades — a distribution, not an event.",
              tag: "Observed climate",
            },
            {
              q: "How could Rawalpindi's climate change by 2040–2059?",
              a: "Climate projection. A boundary-value problem — you need to know the forcing, not today's weather. Useful for decades precisely because it ignores individual days.",
              tag: "Projection",
            },
            {
              q: "What happens under lower versus higher emissions?",
              a: "Scenario analysis. The comparison itself is the finding; no single pathway is the prediction.",
              tag: "Scenario",
            },
          ].map((item) => (
            <div
              key={item.tag}
              className="rounded-(--radius-control) border border-[var(--color-border)] bg-[var(--color-surface)] p-4"
            >
              <div className="label mb-1.5">{item.tag}</div>
              <dt className="text-[14px] font-medium">{item.q}</dt>
              <dd className="mt-1 text-[13px] leading-relaxed text-[var(--color-ink-muted)]">
                {item.a}
              </dd>
            </div>
          ))}
        </dl>
      </Section>

      {/* ---------------------------------------------- scenarios ------- */}
      <Section title="What a scenario actually is">
        <p className="text-[14px] leading-relaxed text-[var(--color-ink-muted)]">
          A Shared Socio-economic Pathway pairs a story about how the world
          develops — population, technology, inequality, energy — with the
          radiative forcing that story produces by 2100. The number after the
          dash is that forcing in watts per square metre. SSP2-4.5 is the
          &ldquo;middle of the road&rdquo; storyline reaching 4.5 W/m².
        </p>

        <div className="mt-5 space-y-2.5">
          {SSP_IDS.map((id) => {
            const scenario = SCENARIOS[id];
            return (
              <div
                key={id}
                className="rounded-(--radius-control) border border-[var(--color-border)] bg-[var(--color-surface)] p-4"
              >
                <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
                  <span
                    className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ background: scenario.color }}
                  />
                  <h3 className="text-[14.5px] font-semibold">{scenario.label}</h3>
                  <span className="text-[12px] text-[var(--color-ink-faint)]">
                    {scenario.narrative}
                  </span>
                  <span className="tnum ml-auto rounded border border-[var(--color-border)] px-1.5 py-0.5 text-[11px] text-[var(--color-ink-muted)]">
                    {scenario.globalWarming2100} by 2100
                  </span>
                </div>
                <p className="mt-2 text-[13px] leading-relaxed text-[var(--color-ink-muted)]">
                  {scenario.summary}
                </p>
              </div>
            );
          })}
        </div>

        <Callout>
          None of these is a prediction, and they are not equally likely. The
          IPCC does not assign probabilities to them. SSP5-8.5 in particular was
          designed as a high-end sensitivity case and is now widely regarded as
          implausible as a business-as-usual trajectory — it is most useful as
          an upper bound for stress-testing, not as an expectation.
        </Callout>
      </Section>

      {/* ---------------------------------------------- RCP vs SSP ------ */}
      <Section title="RCP and SSP are not the same thing">
        <p className="text-[14px] leading-relaxed text-[var(--color-ink-muted)]">
          CMIP5 — the model generation behind IPCC AR5 — used Representative
          Concentration Pathways, which specify a forcing trajectory and
          nothing else. CMIP6 replaced them with SSPs, which add a
          socio-economic storyline that also determines aerosols and land use.
          Two scenarios with the same forcing number can therefore produce
          noticeably different regional climates, especially over South Asia
          where aerosol loading strongly affects the monsoon.
        </p>

        <div className="mt-5 overflow-x-auto">
          <table className="w-full min-w-[440px] text-[13px]">
            <thead>
              <tr className="border-b border-[var(--color-border)]">
                <th className="label py-2 text-left font-semibold">CMIP5 (RCP)</th>
                <th className="label py-2 text-right font-semibold">W/m²</th>
                <th className="label py-2 text-left font-semibold">
                  Nearest CMIP6 (SSP)
                </th>
              </tr>
            </thead>
            <tbody>
              {RCP_SCENARIOS.map((rcp) => (
                <tr
                  key={rcp.id}
                  className="border-b border-[var(--color-border)] last:border-0"
                >
                  <td className="py-2.5">
                    <div className="font-medium">{rcp.label}</div>
                    <div className="text-[11.5px] text-[var(--color-ink-faint)]">
                      {rcp.summary}
                    </div>
                  </td>
                  <td className="tnum py-2.5 text-right align-top">{rcp.forcing}</td>
                  <td className="py-2.5 align-top">
                    {rcp.ssp ? (
                      <span className="flex items-center gap-1.5">
                        <span
                          className="inline-block h-2 w-2 rounded-full"
                          style={{ background: SCENARIOS[rcp.ssp].color }}
                        />
                        {SCENARIOS[rcp.ssp].label}
                      </span>
                    ) : (
                      <span className="text-[var(--color-ink-faint)]">
                        no close counterpart
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <Callout>
          The right-hand column matches forcing levels only. It is a reading aid
          for older literature, not a licence to treat RCP4.5 results as SSP2-4.5
          results.
        </Callout>
      </Section>

      {/* ---------------------------------------------- models ---------- */}
      <Section title="Why the models disagree">
        <p className="text-[14px] leading-relaxed text-[var(--color-ink-muted)]">
          Thirty modelling groups have built independent representations of the
          same physical system. They agree on the fundamentals and differ on the
          hard parts — clouds above all, then aerosols, convection and land
          surface processes. The result is a genuine range in how much the
          planet warms for a given amount of CO₂.
        </p>
        <p className="mt-3 text-[14px] leading-relaxed text-[var(--color-ink-muted)]">
          The usual summary of that is equilibrium climate sensitivity: the
          long-run warming from doubling CO₂. Across the models used here it
          runs from {minEcs()} °C to {maxEcs()} °C. A single model is not wrong
          for sitting at either end — it is one internally consistent answer to
          a question that is not yet settled.
        </p>

        <Callout>
          This is why the multi-model ensemble median is the default everywhere
          on this platform, and why the 10th–90th percentile range is shown
          alongside it rather than tucked into a footnote. Choosing one model
          and reporting its number as the projection is the fastest way to
          mislead with entirely real data.
        </Callout>
      </Section>

      {/* ---------------------------------------------- periods --------- */}
      <Section title="Why twenty-year windows">
        <p className="text-[14px] leading-relaxed text-[var(--color-ink-muted)]">
          Individual years swing far more than the underlying trend. Averaging
          over twenty years suppresses that natural variability enough for the
          forced signal to show through, while still being short enough to
          matter for planning. Every projection here is one of these windows,
          and every change is measured against the same {PERIODS["1995-2014"].shortLabel} baseline.
        </p>
        <div className="mt-4 grid gap-2 sm:grid-cols-5">
          {Object.values(PERIODS).map((period) => (
            <div
              key={period.id}
              className={`rounded-(--radius-control) border p-3 ${
 period.isBaseline
                  ? "border-[var(--color-border-strong)] bg-[var(--color-surface-raised)]"
                  : "border-[var(--color-border)] bg-[var(--color-surface)]"
              }`}
            >
              <div className="tnum text-[13px] font-semibold">
                {period.shortLabel}
              </div>
              <div className="mt-0.5 text-[11px] leading-tight text-[var(--color-ink-faint)]">
                {period.label}
              </div>
            </div>
          ))}
        </div>
      </Section>

      {/* ---------------------------------------------- hazard vs risk -- */}
      <Section title="Hazard is not risk">
        <p className="text-[14px] leading-relaxed text-[var(--color-ink-muted)]">
          A climate model produces climate variables. It does not produce flood
          damages, crop failures or deaths. Getting from one to the other needs
          hydrology, exposure and vulnerability — separate models with their own
          assumptions and their own, usually larger, uncertainties.
        </p>
        <p className="mt-3 text-[14px] leading-relaxed text-[var(--color-ink-muted)]">
          This platform stops at the climate variable and names the mechanism
          that would carry it further. It does not cross the line into impact
          claims it cannot support.
        </p>

        <div className="mt-5 space-y-3">
          {MECHANISMS.slice(0, 4).map((chain) => (
            <div
              key={chain.id}
              className="rounded-(--radius-control) border border-[var(--color-border)] bg-[var(--color-surface)] p-4"
            >
              <h3 className="text-[13.5px] font-semibold">{chain.title}</h3>
              <ol className="mt-2 space-y-1">
                {chain.steps.map((step, index) => (
                  <li
                    key={index}
                    className="flex gap-2 text-[12.5px] leading-snug text-[var(--color-ink-muted)]"
                  >
                    <span className="text-[var(--color-ink-faint)]">↓</span>
                    {step}
                  </li>
                ))}
              </ol>
              <p className="mt-2.5 border-t border-[var(--color-border)] pt-2 text-[11.5px] leading-relaxed text-[var(--color-ink-faint)]">
                <span className="font-semibold">Stops here without: </span>
                {chain.requires}
              </p>
            </div>
          ))}
        </div>
      </Section>

      {/* ---------------------------------------------- indicators ------ */}
      <Section title="The indicators">
        <p className="mb-4 text-[14px] leading-relaxed text-[var(--color-ink-muted)]">
          Mean temperature is the headline, but it is rarely the number that
          matters for a decision. Threshold counts, extremes and dry-spell
          lengths carry far more of the consequence.
        </p>
        <div className="space-y-4">
          {indicatorsByFamily().map((group) => (
            <div key={group.family.id}>
              <h3 className="flex items-center gap-2 text-[13.5px] font-semibold">
                <span
                  className="inline-block h-2 w-2 rounded-full"
                  style={{ background: group.family.color }}
                />
                {group.family.label}
              </h3>
              <p className="mt-0.5 text-[12px] text-[var(--color-ink-faint)]">
                {group.family.description}
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {group.indicators.map((indicator) => (
                  <span
                    key={indicator.id}
                    title={indicator.description}
                    className="rounded border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-1 text-[11.5px] text-[var(--color-ink-muted)]"
                  >
                    {indicator.label}
                    <span className="ml-1 text-[var(--color-ink-faint)]">
                      {indicator.unit}
                    </span>
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </Section>

      <footer className="hairline mt-10 pt-6">
        <p className="text-[13px] text-[var(--color-ink-muted)]">
          Ready to look at the data?{" "}
          <Link href="/" className="font-medium text-[var(--color-brand-deep)] underline">
            Open the explorer
          </Link>{" "}
          or read the{" "}
          <Link href="/methodology" className="font-medium text-[var(--color-brand-deep)] underline">
            methodology
          </Link>
          .
        </p>
      </footer>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-11">
      <h2 className="mb-3.5 text-[18px] font-semibold tracking-tight">{title}</h2>
      {children}
    </section>
  );
}

function Callout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-5 rounded-(--radius-control) border-l-2 border-[var(--color-brand)] bg-[var(--color-brand-tint)] py-3 pl-4 pr-4">
      <p className="text-[13px] leading-relaxed text-[var(--color-ink-muted)]">
        {children}
      </p>
    </div>
  );
}

function ecsValues(): number[] {
  return Object.values(MODELS)
    .map((model) => model.ecs as number | null)
    .filter((ecs): ecs is number => ecs !== null);
}

function minEcs() {
  return Math.min(...ecsValues()).toFixed(1);
}

function maxEcs() {
  return Math.max(...ecsValues()).toFixed(1);
}
