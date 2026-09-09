import Link from "next/link";

import { gridCoverage } from "@/lib/climate/grid";
import {
  DATASETS,
  MODELS,
  PERIODS,
  SSP_IDS,
  SCENARIOS,
} from "@/lib/climate/taxonomy";

export const metadata = {
  title: "Methodology",
  description:
    "Data sources, processing pipeline, spatial resolution, known limitations and citations.",
};

export const revalidate = 3600;

/**
 * Methodology and limitations.
 *
 * Rendered on the server from the live catalogue and the actual grid
 * manifest, so the coverage numbers here describe this deployment rather than
 * an aspiration written once and left to drift.
 */
export default async function MethodologyPage() {
  const coverage = await gridCoverage();

  return (
    <div className="mx-auto max-w-3xl px-5 py-10">
      <header className="mb-10">
        <h1 className="text-[28px] font-semibold leading-tight tracking-tight">
          Methodology
        </h1>
        <p className="mt-3 text-[14.5px] leading-relaxed text-[var(--color-ink-muted)]">
          Where the numbers come from, what was done to them, and what they
          cannot tell you.
        </p>
      </header>

      <div className="mb-10 rounded-(--radius-container) border-l-4 border-warn bg-surface-recessed p-4">
        <p className="text-[13px] font-semibold text-ink">
          Read this before quoting an individual model
        </p>
        <p className="mt-1.5 text-[13px] leading-relaxed text-ink-muted">
          The 30-member ensemble is published <strong>only as a national spatial
          aggregate</strong>. Gridded fields exist for the ensemble percentiles
          (median, 10th, 90th), not per model. So on this platform the
          model-spread <em>envelope</em> at a point is local, but the
          <em> per-model list</em> is a country-wide average — not a grid-cell
          value at the selected coordinate. Every panel that shows individual
          models says so. This is the limitation a reviewer should probe first.
        </p>
      </div>

      {/* ---------------------------------------------------- sources --- */}
      <Section title="Data sources">
        <div className="space-y-3">
          {Object.values(DATASETS).map((dataset) => (
            <div
              key={dataset.id}
              className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4"
            >
              <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                <h3 className="text-[14px] font-semibold">{dataset.label}</h3>
                <span className="rounded border border-[var(--color-border)] px-1.5 py-0.5 font-mono text-[10px] uppercase text-[var(--color-ink-faint)]">
                  {dataset.kind}
                </span>
              </div>
              <p className="mt-1.5 text-[13px] leading-relaxed text-[var(--color-ink-muted)]">
                <span className="font-medium text-[var(--color-ink)]">
                  Answers:
                </span>{" "}
                {dataset.answers}
              </p>
              <dl className="tnum mt-2.5 grid grid-cols-2 gap-x-4 gap-y-1 text-[11.5px] text-[var(--color-ink-faint)] sm:grid-cols-3">
                <Meta label="Provider" value={dataset.provider} />
                <Meta label="Resolution" value={dataset.resolution} />
                <Meta label="Coverage" value={dataset.temporalRange} />
              </dl>
            </div>
          ))}
        </div>

        <Callout>
          These three are never combined. A short-range forecast, an
          observational reanalysis and a multi-decadal projection answer
          different questions with different methods and different error
          characteristics. They are kept in separate stores, separate endpoints
          and separate parts of the interface for that reason.
        </Callout>
      </Section>

      {/* ---------------------------------------------------- pipeline -- */}
      <Section title="Processing pipeline">
        <p className="text-[14px] leading-relaxed text-[var(--color-ink-muted)]">
          Raw CMIP6 output is not usable directly: it arrives as global NetCDF
          rasters, one file per variable, model, scenario, product, aggregation,
          percentile and period. The pipeline reduces those to the smallest
          artefact that can still answer a point query.
        </p>

        <ol className="mt-4 space-y-2.5">
          {[
            {
              step: "Source",
              detail:
                "Global 0.25° NetCDF fields, ~8 MB each, from the World Bank CCKP open data bucket on S3.",
            },
            {
              step: "Subset",
              detail:
                "Clip to 60.5–78.0 °E, 23.5–37.25 °N — a 71 × 56 lattice of 3,976 cells covering Pakistan including Azad Jammu & Kashmir and Gilgit-Baltistan.",
            },
            {
              step: "Reduce",
              detail:
                "Flatten to a stacked array indexed layer-major and then row-major from the south-west corner, with the grid geometry stored once rather than per field. Annual fields have one layer, seasonal four and monthly twelve. A national annual field compresses to roughly 11 KB.",
            },
            {
              step: "Index",
              detail:
                "Precompute which grid cells fall inside each of the 7 provinces and 126 districts, using point-in-polygon against the unsimplified boundaries so no border cell is lost to simplification.",
            },
            {
              step: "Serve",
              detail:
                "Point queries read the lattice directly. Anything not rasterised locally falls back to the CCKP aggregate API, and the response says which source answered.",
            },
          ].map((item, index) => (
            <li key={item.step} className="flex gap-3">
              <span className="tnum mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-[var(--color-border-strong)] text-[10px] font-semibold text-[var(--color-ink-faint)]">
                {index + 1}
              </span>
              <div>
                <span className="text-[13.5px] font-semibold">{item.step}</span>
                <p className="text-[13px] leading-relaxed text-[var(--color-ink-muted)]">
                  {item.detail}
                </p>
              </div>
            </li>
          ))}
        </ol>

        <Callout>
          Deliberately, the database is not a scientific data warehouse. Putting
          every raw NetCDF value into Postgres would mean hundreds of millions of
          rows to answer questions that a 25 KB array answers in microseconds.
          The pipeline computes application-ready products; the store serves
          them.
        </Callout>
      </Section>

      {/* ---------------------------------------------------- coverage -- */}
      <Section title="Coverage in this deployment">
        <div className="grid gap-3 sm:grid-cols-3">
          <Stat label="Rasterised fields" value={coverage.fieldCount.toLocaleString()} />
          <Stat label="Grid payload" value={`${coverage.sizeMb} MB`} />
          <Stat label="Grid cells" value="3,976" />
        </div>
        <p className="mt-3 text-[12.5px] leading-relaxed text-[var(--color-ink-muted)]">
          Locally rasterised indicators:{" "}
          <span className="font-mono text-[11.5px]">
            {coverage.variables.join(", ") || "none yet"}
          </span>
          . Anything outside that list is still fully queryable — it is served
          from the upstream aggregate API as a national average, and every
          response and panel says so explicitly rather than presenting a
          country-wide mean as a local value.
        </p>
        <p className="mt-2 text-[11.5px] text-[var(--color-ink-faint)]">
          Grid last built {new Date(coverage.generatedAt).toUTCString()}.
        </p>
      </Section>

      {/* ---------------------------------------------------- choices --- */}
      <Section title="Analytical choices">
        <div className="space-y-3">
          <Choice title="Ensemble median as the default">
            The 10th and 90th percentiles are percentiles <em>across models</em>,
            not confidence intervals. An individual model carries only a mean,
            because a cross-model percentile of a single model is not a
            meaningful quantity — the API rejects that combination rather than
            silently returning something.
          </Choice>
          <Choice title="Anomalies against 1995–2014">
            Models agree far better on change than on absolute values. The
            baseline is the one CCKP publishes every anomaly against, so
            anomalies here are the upstream product rather than a subtraction
            done locally, and no bias is introduced by re-differencing.
          </Choice>
          <Choice title="Equal-weighted area aggregation">
            Province and district means weight every grid cell equally. A 0.25°
            cell varies about 15% in area between Karachi and Gilgit; that is
            small next to the model spread already shown, and equal weighting
            keeps values reproducible against CCKP&rsquo;s own aggregates.
          </Choice>
          <Choice title="Colour scales clipped to the 2nd–98th percentile">
            A handful of extreme Karakoram cells would otherwise flatten
            contrast across the plains where most people live. Diverging scales
            are forced symmetric about zero so that equal changes of opposite
            sign are equally saturated.
          </Choice>
          <Choice title="Units taken from the files, not from the variable names">
            Several CCKP variable codes do not mean what they look like.
            <code className="mx-1 rounded bg-[var(--color-surface-raised)] px-1 font-mono text-[11.5px]">sd</code>
            is the ETCCDI &ldquo;summer days&rdquo; count, not snow depth;
            <code className="mx-1 rounded bg-[var(--color-surface-raised)] px-1 font-mono text-[11.5px]">r95ptot</code>
            is a percentage share of wet-day rainfall, not a millimetre total;
            <code className="mx-1 rounded bg-[var(--color-surface-raised)] px-1 font-mono text-[11.5px]">cdd65</code>
            is published in Fahrenheit degree-days; and the precipitation
            anomaly is in millimetres rather than percent. Every unit shown on
            this platform is taken from the
            <code className="mx-1 rounded bg-[var(--color-surface-raised)] px-1 font-mono text-[11.5px]">units</code>
            attribute of the source file and pinned by a test.
          </Choice>
          <Choice title="Model disagreement shown, not hidden">
            Where CCKP publishes an agreement classification, cells in which
            models conflict on the sign of change are drawn faded. The median is
            still the median; its direction is simply not robust there.
          </Choice>
        </div>
      </Section>

      {/* ---------------------------------------------------- limits ---- */}
      <Section title="Limitations">
        <div className="space-y-3">
          <Limit title="25 km cells cannot resolve a city">
            A grid cell spans roughly 25 km. Urban heat islands, valley
            inversions and coastal breezes all operate below that scale.
            Karachi&rsquo;s cell describes the region, not the neighbourhood.
          </Limit>
          <Limit title="Complex terrain is where downscaling is weakest">
            In the Hindu Kush–Karakoram–Himalaya, elevation changes by kilometres
            within a single cell. Snow, precipitation phase and glacier mass
            balance are all sensitive to exactly that, and are correspondingly
            less reliable in the north than on the plains.
          </Limit>
          <Limit title="The South Asian monsoon is a known model weakness">
            CMIP6 models disagree more on monsoon precipitation than on almost
            any other regional signal, and aerosol forcing — which differs
            between SSPs by construction — has a first-order effect on it.
            Precipitation projections for Pakistan deserve markedly more caution
            than temperature ones.
          </Limit>
          <Limit title="Twenty-year means say nothing about a given year">
            Every value here is a climatology. A projection of +2 °C for
            2040–2059 does not mean 2047 will be 2 °C warmer than 2002.
          </Limit>
          <Limit title="Time series are national only">
            The archive publishes continuous annual traces as spatial aggregates.
            Any chart running 1950–2100 on this platform describes Pakistan as a
            whole, and is labelled accordingly.
          </Limit>
          <Limit title="No impact modelling">
            This platform reports climate variables. It has no hydrological, crop,
            health or economic model, and makes no claim about floods, yields or
            mortality.
          </Limit>
        </div>
      </Section>

      {/* ---------------------------------------------------- scope ----- */}
      <Section title="Scope">
        <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
          <ScopeItem label="Scenarios" value={`${SSP_IDS.length} SSP pathways`}>
            {SSP_IDS.map((id) => SCENARIOS[id].label).join(", ")}
          </ScopeItem>
          <ScopeItem
            label="Models"
            value={`${Object.keys(MODELS).length - 1} GCM realisations + ensemble`}
          >
            Bias-corrected and statistically downscaled by the World Bank.
          </ScopeItem>
          <ScopeItem label="Periods" value={`${Object.keys(PERIODS).length} windows`}>
            {Object.values(PERIODS).map((p) => p.shortLabel).join(", ")}
          </ScopeItem>
          <ScopeItem label="Geography" value="7 provinces, 126 districts">
            Boundaries from geoBoundaries (gbOpen, public domain), simplified for
            web delivery.
          </ScopeItem>
        </dl>
      </Section>

      {/* ---------------------------------------------------- citation -- */}
      <Section title="Citation">
        <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
          <ul className="space-y-2.5 text-[12.5px] leading-relaxed text-[var(--color-ink-muted)]">
            <li>
              World Bank Group.{" "}
              <em>
                Climate Change Knowledge Portal — CMIP6 bias-corrected downscaled
                projections, 0.25°
              </em>
              . Available at climateknowledgeportal.worldbank.org.
            </li>
            <li>
              Eyring, V. et al. (2016). Overview of the Coupled Model
              Intercomparison Project Phase 6 (CMIP6) experimental design and
              organization. <em>Geoscientific Model Development</em> 9, 1937–1958.
            </li>
            <li>
              O&rsquo;Neill, B. C. et al. (2016). The Scenario Model
              Intercomparison Project (ScenarioMIP) for CMIP6.{" "}
              <em>Geoscientific Model Development</em> 9, 3461–3482.
            </li>
            <li>
              IPCC (2021). <em>Climate Change 2021: The Physical Science Basis</em>.
              Contribution of Working Group I to the Sixth Assessment Report.
            </li>
            <li>
              Runfola, D. et al. (2020). geoBoundaries: A global database of
              political administrative boundaries. <em>PLoS ONE</em> 15(4).
            </li>
          </ul>

          <p className="mt-4 text-[12px] font-semibold text-ink">Suggested citation</p>
          <p className="mt-1 text-[12.5px] leading-relaxed text-[var(--color-ink-muted)]">
            Earth Scan Systems (2026). <em>Climate Intelligence Platform: CMIP6
            downscaled projections for Pakistan, Uzbekistan, Australia and New
            Zealand.</em> Data: World Bank Climate Change Knowledge Portal.
          </p>

          <pre className="mt-3 overflow-x-auto rounded-(--radius-control) border border-[var(--color-border)] bg-surface-recessed p-3 font-mono text-[11px] leading-relaxed text-[var(--color-ink-muted)]">
{`@misc{ess_climate_platform_2026,
  author       = {{Earth Scan Systems}},
  title        = {Climate Intelligence Platform: CMIP6 downscaled
                  projections for Pakistan, Uzbekistan, Australia
                  and New Zealand},
  year         = {2026},
  note         = {Data: World Bank Climate Change Knowledge Portal,
                  CMIP6 bias-corrected downscaled projections (0.25{\\deg}).
                  Baseline 1995--2014.},
  howpublished = {\\url{https://climateknowledgeportal.worldbank.org/}}
}`}
          </pre>
        </div>
      </Section>

      <footer className="hairline mt-10 pt-6">
        <p className="text-[13px] text-[var(--color-ink-muted)]">
          Unsure how to read the numbers?{" "}
          <Link href="/learn" className="font-medium text-[var(--color-brand-deep)] underline">
            Start here
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

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="label">{label}</dt>
      <dd className="text-[var(--color-ink-muted)]">{value}</dd>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-3.5">
      <div className="label mb-1">{label}</div>
      <div className="tnum text-[20px] font-semibold">{value}</div>
    </div>
  );
}

function Choice({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
      <h3 className="text-[13.5px] font-semibold">{title}</h3>
      <p className="mt-1 text-[13px] leading-relaxed text-[var(--color-ink-muted)]">
        {children}
      </p>
    </div>
  );
}

function Limit({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border-l-2 border-[var(--color-border-strong)] pl-4">
      <h3 className="text-[13.5px] font-semibold">{title}</h3>
      <p className="mt-0.5 text-[13px] leading-relaxed text-[var(--color-ink-muted)]">
        {children}
      </p>
    </div>
  );
}

function ScopeItem({
  label,
  value,
  children,
}: {
  label: string;
  value: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <dt className="label">{label}</dt>
      <dd className="text-[13.5px] font-semibold">{value}</dd>
      <dd className="mt-0.5 text-[12px] leading-relaxed text-[var(--color-ink-faint)]">
        {children}
      </dd>
    </div>
  );
}

function Callout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-5 rounded-lg border-l-2 border-[var(--color-brand)] bg-[var(--color-brand-tint)] py-3 pl-4 pr-4">
      <p className="text-[13px] leading-relaxed text-[var(--color-ink-muted)]">
        {children}
      </p>
    </div>
  );
}
