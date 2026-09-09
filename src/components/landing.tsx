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
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:py-12">
      {/* ---- hero (inverted deep band) ------------------------------- */}
      <section className="section-deep grid gap-10 p-8 sm:p-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-center lg:p-12">
        <div>
          <p className="mb-4 flex items-center gap-2 text-2xs font-semibold uppercase tracking-[var(--tracking-caps)] text-white/55">
            <span className="inline-block h-1.5 w-1.5 rounded-(--radius-pill) bg-[rgb(var(--accent-glow))] shadow-[0_0_12px_rgb(var(--accent-glow))]" />
            Earth Scan Systems · Climate Intelligence
          </p>
          <h1 className="text-[clamp(2rem,4.4vw,3.25rem)] font-semibold leading-[1.05] tracking-tight text-white">
            How the climate of four countries could change under each emissions
            pathway.
          </h1>
          <p className="mt-5 max-w-lg text-[15px] leading-relaxed text-white/70">
            A projection platform for Pakistan, Uzbekistan, Australia and New
            Zealand — not a forecast. Every number traces to a published CMIP6
            value or a documented derivation from one.
          </p>

          <div className="mt-7 flex flex-wrap items-center gap-3">
            <Link href="/explore" className="btn btn-primary group">
              Start exploring
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
            <Link
              href="/explore?tour=1"
              className="btn border border-white/20 bg-white/5 text-white/80 hover:bg-white/10 hover:text-white"
            >
              <PlayCircle className="h-4 w-4" /> Guided tour · 3 min
            </Link>
          </div>

          <div className="mt-8 flex flex-wrap gap-1.5">
            {PROVENANCE.map((p) => (
              <span
                key={p}
                className="rounded-(--radius-pill) border border-white/12 bg-white/6 px-2.5 py-1 text-2xs font-medium text-white/70"
                data-numeric
              >
                {p}
              </span>
            ))}
          </div>
        </div>

        <div className="rounded-(--radius-container) border border-white/10 bg-white/5 p-5">
          <PathwayBars onDark />
        </div>
      </section>

      {/* ---- country grid ------------------------------------------------ */}
      <section className="mt-10">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
          <p className="label">Projected warming · capitals</p>
          <p className="text-xs text-ink-faint" data-numeric>
            {scenarioLabel} · {periodLabel} vs 1995–2014
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {headlines.map((h) => (
            <Link
              key={h.code}
              href={`/explore?country=${h.code.toLowerCase()}`}
              onClick={() => setCountry(h.code)}
              style={{ ["--seam-color" as string]: seam }}
              className="tier-raised-seam group flex flex-col gap-5 p-5 transition-transform motion-state hover:-translate-y-1"
            >
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <span aria-hidden className="text-lg leading-none">{h.flag}</span>
                  <span className="text-sm font-medium text-ink">{h.name}</span>
                </span>
                <span className="flex h-7 w-7 items-center justify-center rounded-(--radius-pill) bg-surface-recessed text-ink-faint transition-colors group-hover:bg-accent group-hover:text-accent-ink">
                  <ArrowUpRight className="h-3.5 w-3.5" />
                </span>
              </div>

              <div>
                <div
                  className="text-[2.5rem] font-semibold leading-[0.9] tracking-tight tabular-nums"
                  data-numeric
                  style={{ color: h.delta !== null ? "var(--danger)" : "var(--ink)" }}
                >
                  {h.delta !== null ? formatValue(h.delta, "tas", "anomaly") : "—"}
                </div>
                <p className="mt-2.5 text-xs leading-snug text-ink-faint">
                  at {h.capital}
                  {h.projected != null && (
                    <>
                      {" · "}
                      <span className="tabular-nums text-ink-muted" data-numeric>
                        {formatValue(h.projected, "tas")}
                      </span>{" "}
                      projected
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
        <Link href="/methodology" className="text-ink-muted underline underline-offset-2">
          Methodology
        </Link>
        .
      </p>
    </div>
  );
}
