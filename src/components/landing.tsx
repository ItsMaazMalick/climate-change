"use client";

import Link from "next/link";
import { ArrowRight, ArrowUpRight, PlayCircle } from "lucide-react";

import { PathwayBars } from "@/components/ui/pathway-bars";
import { formatValue, SCENARIOS, PERIODS, type ScenarioId } from "@/lib/climate/taxonomy";
import { scenarioColorVar } from "@/lib/climate/scenario-style";
import { useCountry } from "@/lib/country-context";
import type { CountryCode } from "@/lib/climate/countries";

export interface CountryHeadline {
  code: CountryCode;
  name: string;
  flag: string;
  capital: string;
  delta: number | null;
  projected?: number | null;
}

const PROVENANCE = ["World Bank CCKP", "CMIP6", "0.25° · ~25 km", "30 GCMs", "baseline 1995–2014"];

export function Landing({
  headlines,
  headlineContext,
}: {
  headlines: CountryHeadline[];
  headlineContext: { scenario: string; period: string; indicator: string };
}) {
  const { setCountry } = useCountry();
  const seam = scenarioColorVar(headlineContext.scenario as ScenarioId);
  const scenarioLabel =
    SCENARIOS[headlineContext.scenario as ScenarioId]?.label ?? headlineContext.scenario;
  const periodLabel =
    PERIODS[headlineContext.period as keyof typeof PERIODS]?.shortLabel ?? headlineContext.period;

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:py-10">
      {/* ---- hero ---------------------------------------------------- */}
      <section className="section-brand grid gap-10 p-8 sm:p-11 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:p-14">
        <div className="relative z-10">
          <p className="mb-5 inline-flex items-center gap-2 rounded-(--radius-pill) border border-leaf bg-leaf-soft px-3 py-1 text-2xs font-semibold uppercase tracking-(--tracking-caps) text-brand-deep">
            <span className="h-1.5 w-1.5 rounded-(--radius-pill) bg-leaf shadow-[0_0_8px_1px_rgb(var(--leaf-glow))]" />
            Earth Scan Systems · Climate Intelligence
          </p>
          <h1 className="text-[clamp(2.15rem,4.8vw,3.5rem)] font-semibold leading-[1.03] tracking-tight text-brand-deep">
            How the climate of four countries could change under each{" "}
            <span className="relative whitespace-nowrap text-brand">
              emissions pathway
              <span
                aria-hidden
                className="absolute inset-x-0 bottom-[0.08em] -z-10 h-[0.32em] rounded-(--radius-control) bg-leaf/45"
              />
            </span>
            .
          </h1>
          <p className="mt-5 max-w-lg text-[15px] leading-relaxed text-ink-muted">
            A projection platform for Pakistan, Uzbekistan, Australia and New
            Zealand — not a forecast. Every number traces to a published CMIP6
            value or a documented derivation from one.
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link href="/explore" className="btn btn-primary group">
              Start exploring
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Link>
            <Link href="/explore?tour=1" className="btn btn-secondary">
              <PlayCircle className="h-4 w-4" /> Guided tour · 3 min
            </Link>
          </div>

          <div className="mt-9 flex flex-wrap gap-1.5">
            {PROVENANCE.map((p) => (
              <span
                key={p}
                className="rounded-(--radius-pill) border border-border bg-surface-recessed px-2.5 py-1 text-2xs font-medium text-ink-muted"
                data-numeric
              >
                {p}
              </span>
            ))}
          </div>
        </div>

        <div className="tier-recessed relative z-10 p-6">
          <PathwayBars />
        </div>
      </section>

      {/* ---- country grid ------------------------------------------------ */}
      <section className="mt-10">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-2">
          <div>
            <p className="label">Projected warming · capitals</p>
            <p className="mt-1 text-sm text-ink-muted">Choose a country to open it in Explore.</p>
          </div>
          <p className="text-xs text-ink-faint" data-numeric>
            {scenarioLabel} · {periodLabel} vs 1995–2014
          </p>
        </div>

        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {headlines.map((h) => (
            <Link
              key={h.code}
              href={`/explore?country=${h.code.toLowerCase()}`}
              onClick={() => setCountry(h.code)}
              style={{ ["--seam-color" as string]: seam }}
              className="tier-raised-seam group flex flex-col gap-6 p-5 hover:-translate-y-1.5"
            >
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <span aria-hidden className="text-lg leading-none">{h.flag}</span>
                  <span className="text-sm font-semibold text-ink">{h.name}</span>
                </span>
                <span className="flex h-8 w-8 items-center justify-center rounded-(--radius-pill) bg-surface-recessed text-ink-faint transition-all group-hover:bg-brand group-hover:text-white group-hover:shadow-[0_0_18px_2px_rgb(var(--leaf-glow)/0.5)]">
                  <ArrowUpRight className="h-4 w-4" />
                </span>
              </div>

              <div>
                <div
                  className="text-[2.75rem] font-semibold leading-[0.85] tracking-tight tabular-nums text-brand"
                  data-numeric
                >
                  {h.delta !== null ? formatValue(h.delta, "tas", "anomaly") : "—"}
                </div>
                <p className="mt-3 text-xs leading-snug text-ink-faint">
                  at {h.capital}
                  {h.projected != null && (
                    <>
                      <br />
                      <span className="tabular-nums text-ink-muted" data-numeric>
                        {formatValue(h.projected, "tas")}
                      </span>{" "}
                      projected · {periodLabel}
                    </>
                  )}
                </p>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <p className="mt-10 max-w-2xl border-t border-border pt-5 text-xs leading-relaxed text-ink-faint">
        These are physical pathways, not predictions. Individual-model values are
        national aggregates rather than grid-cell values at the selected point —
        see{" "}
        <Link href="/methodology" className="text-brand underline underline-offset-2">
          Methodology
        </Link>
        .
      </p>
    </div>
  );
}
