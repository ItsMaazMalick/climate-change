"use client";

import Link from "next/link";
import { ArrowRight, PlayCircle } from "lucide-react";

import { formatValue, SCENARIOS, PERIODS } from "@/lib/climate/taxonomy";
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

const PROVENANCE = "World Bank CCKP · CMIP6 · 0.25° (~25 km) · 30 GCMs · baseline 1995–2014";

export function Landing({
  headlines,
  headlineContext,
}: {
  headlines: CountryHeadline[];
  headlineContext: { scenario: string; period: string; indicator: string };
}) {
  const { setCountry } = useCountry();
  const scenarioLabel = SCENARIOS[headlineContext.scenario as keyof typeof SCENARIOS]?.label ?? headlineContext.scenario;
  const periodLabel = PERIODS[headlineContext.period as keyof typeof PERIODS]?.shortLabel ?? headlineContext.period;

  return (
    <div className="mx-auto flex min-h-[calc(100vh-3.5rem)] max-w-5xl flex-col justify-center px-6 py-12">
      <p className="label mb-3">Earth Scan Systems · Climate Intelligence</p>
      <h1 className="max-w-3xl text-2xl font-semibold leading-[1.1] tracking-[var(--tracking-tight)]">
        How the climate of Pakistan, Uzbekistan, Australia and New Zealand could
        change under each emissions pathway.
      </h1>
      <p className="mt-4 max-w-2xl text-base text-ink-muted">
        A projection platform, not a forecast. Every number here traces to a
        published CMIP6 value or a documented derivation from one.
      </p>

      <div
        className="mt-6 inline-flex w-fit items-center gap-2 rounded-(--radius-control) border border-border bg-surface-recessed px-3 py-1.5 text-xs text-ink-faint"
        data-numeric
      >
        {PROVENANCE}
      </div>

      <div className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {headlines.map((h) => (
          <Link
            key={h.code}
            href={`/explore?country=${h.code.toLowerCase()}`}
            onClick={() => setCountry(h.code)}
            className="tier-raised group flex flex-col gap-3 p-4 transition-transform motion-state hover:-translate-y-0.5"
          >
            <div className="flex items-center gap-2">
              <span aria-hidden className="text-lg leading-none">{h.flag}</span>
              <span className="text-sm font-medium text-ink">{h.name}</span>
            </div>
            <div>
              <div className="text-xl font-semibold leading-none text-ink" data-numeric>
                {h.delta !== null ? formatValue(h.delta, "tas", "anomaly") : "—"}
              </div>
              <p className="mt-1.5 text-xs leading-snug text-ink-faint">
                projected warming at {h.capital}
                <br />
                {scenarioLabel} · {periodLabel} vs 1995–2014
              </p>
            </div>
            <span className="mt-auto inline-flex items-center gap-1 text-xs font-medium text-accent opacity-0 transition-opacity group-hover:opacity-100">
              Explore {h.name} <ArrowRight className="h-3 w-3" />
            </span>
          </Link>
        ))}
      </div>

      <div className="mt-10 flex flex-wrap items-center gap-3">
        <Link
          href="/explore"
          className="inline-flex items-center gap-2 rounded-(--radius-control) bg-accent px-4 py-2.5 text-sm font-medium text-accent-ink transition-colors hover:bg-accent-hover"
        >
          Start exploring <ArrowRight className="h-4 w-4" />
        </Link>
        <Link
          href="/explore?tour=1"
          className="inline-flex items-center gap-2 rounded-(--radius-control) border border-border px-4 py-2.5 text-sm font-medium text-ink-muted transition-colors hover:bg-surface-hover"
        >
          <PlayCircle className="h-4 w-4" /> Guided tour (3 min)
        </Link>
      </div>

      <p className="mt-8 max-w-2xl text-xs leading-relaxed text-ink-faint">
        These are physical pathways, not predictions. Individual-model values are
        national aggregates rather than grid-cell values at the selected point —
        see Methodology.
      </p>
    </div>
  );
}
