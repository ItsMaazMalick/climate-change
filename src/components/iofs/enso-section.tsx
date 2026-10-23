"use client";

import { ExternalLink, Flame, Snowflake, Waves } from "lucide-react";

import { EmptyState, ErrorState, SkeletonBlock } from "@/components/ui/states";
import { useApi } from "@/lib/hooks";
import type { EnsoSnapshot } from "@/lib/iofs/enso";
import type { EnsoOutlook } from "@/lib/iofs/enso-outlook";

import { EnsoHistoryChart } from "./enso-history-chart";
import { EnsoOutlookChart } from "./enso-outlook-chart";
import { longDate, seasonName, signed } from "@/lib/iofs/enso-format";
import { InfoButton } from "./info-dialog";
import { PacificSstMap } from "./pacific-sst-map";
import { T, useTranslatedText } from "./translation-context";

type EnsoPageData = EnsoSnapshot & { outlook: EnsoOutlook | null };

const PHASE_COLOR: Record<string, string> = {
  "El Niño": "#d6604d",
  "La Niña": "#4393c3",
  Neutral: "#94a3b8",
};

function PhaseIcon({ phase, className }: { phase: string; className?: string }) {
  if (phase === "El Niño") return <Flame className={className} />;
  if (phase === "La Niña") return <Snowflake className={className} />;
  return <Waves className={className} />;
}

export function EnsoSection() {
  const { data, error, loading } = useApi<EnsoPageData>("/api/iofs/enso");
  const unreachableTitle = useTranslatedText("Couldn't reach NOAA's Climate Prediction Center");
  const noDataTitle = useTranslatedText("No ENSO reading available right now");

  if (loading) {
    return (
      <div className="space-y-4">
        <SkeletonBlock height={180} />
        <SkeletonBlock height={260} />
      </div>
    );
  }
  if (error || !data) {
    return <ErrorState title={unreachableTitle} detail={error ?? undefined} />;
  }
  if (!data.current) {
    return <EmptyState title={noDataTitle} />;
  }

  const { current, tier, discussion, outlook } = data;
  const color = PHASE_COLOR[tier.phase] ?? PHASE_COLOR.Neutral;

  const observedSeason = seasonName(`${current.season} ${current.year}`);
  const statusMeaning = `For ${observedSeason}, the Pacific is in a ${
    tier.tier ? `${tier.tier} ` : ""
  }${tier.phase} state (RONI ${formatSigned(current.roni)})${
    discussion.alertStatus ? ` — NOAA's own alert level: ${discussion.alertStatus}.` : "."
  }`;

  const roniMeaning = `The latest RONI (${observedSeason}) of ${formatSigned(current.roni)} places the Pacific in ${tier.label.toLowerCase()}${
    tier.tier ? ` — a ${tier.tier.toLowerCase()}-tier signal by NOAA's own thresholds` : ""
  }.`;

  const nino34Normal =
    current.nino34Sst !== null && current.nino34 !== null ? current.nino34Sst - current.nino34 : null;
  const nino34Warmer = (current.nino34 ?? 0) >= 0;
  const nino34Meaning =
    current.nino34 !== null
      ? `The Niño 3.4 region is currently ${nino34Warmer ? "warmer" : "cooler"} than normally expected for ${current.label} (${current.nino34Sst?.toFixed(2) ?? "—"} °C actual vs ${nino34Normal?.toFixed(2) ?? "—"} °C normal). Persistent unusual ${nino34Warmer ? "warming" : "cooling"} in this region is an important feature of ${nino34Warmer ? "El Niño" : "La Niña"} development.`
      : undefined;

  return (
    <div className="space-y-5">
      {/* Headline status */}
      <div className="tier-raised-seam relative overflow-hidden p-5 sm:p-6">
        <span
          aria-hidden
          className="pointer-events-none absolute -right-14 -top-14 h-48 w-48 rounded-(--radius-pill) opacity-25 blur-3xl"
          style={{ background: color }}
        />
        <div className="relative flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <span
              className="mt-0.5 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-(--radius-pill)"
              style={{
                background: `color-mix(in oklab, ${color} 18%, transparent)`,
                color,
              }}
            >
              <PhaseIcon phase={tier.phase} className="h-5 w-5" />
            </span>
            <div>
              <p className="label">
                <T>Live ENSO status · Niño 3.4 region</T>
              </p>
              <h3 className="mt-1 flex items-center gap-1.5 text-xl font-semibold tracking-tight text-ink sm:text-2xl">
                <T>{tier.tier ? `${tier.tier} ${tier.phase}` : tier.label}</T>
                {tier.tier === "Super" && (
                  <span
                    className="ml-0.5 inline-flex items-center rounded-(--radius-pill) px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide"
                    style={{ background: color, color: "white" }}
                  >
                    <T>Super El Niño</T>
                  </span>
                )}
                <InfoButton id="enso-status" meaningOverride={statusMeaning} label="ENSO status" />
              </h3>
              <p className="mt-1 flex flex-wrap items-center gap-x-1 text-xs text-ink-faint">
                <span>
                  <T>Latest 3-month season</T>: {observedSeason} ·
                </span>
                <span className="inline-flex items-center gap-0.5">
                  NOAA CPC RONI {formatSigned(current.roni)}
                  <InfoButton id="roni" meaningOverride={roniMeaning} label="RONI" />
                </span>
                <span>·</span>
                <span className="inline-flex items-center gap-0.5">
                  <T>Niño 3.4 anomaly</T> {formatSigned(current.nino34)} (
                  {current.nino34Sst?.toFixed(2) ?? "—"} °C <T>observed</T>)
                  <InfoButton id="nino34-sst" meaningOverride={nino34Meaning} label="Niño 3.4 SST anomaly" />
                </span>
              </p>
              {tier.tier === "Super" && (
                <p className="mt-1.5 max-w-md text-2xs leading-relaxed text-ink-faint">
                  <T>
                    “Super El Niño” is an informal term for exceptionally strong El Niño events.
                    NOAA CPC’s own formal name for this highest category is “very strong.”
                  </T>
                </p>
              )}
            </div>
          </div>

          {discussion.alertStatus && (
            <span className="rounded-(--radius-pill) border border-border bg-surface-recessed px-3 py-1.5 text-xs font-semibold text-ink-muted">
              <T>CPC alert</T>: <T>{discussion.alertStatus}</T>
            </span>
          )}
        </div>

        {discussion.synopsis && (
          <blockquote className="relative mt-4 rounded-(--radius-control) border-l-2 border-accent bg-surface-recessed p-4 text-sm leading-relaxed text-ink-muted">
            <p>
              “<T>{discussion.synopsis}</T>”
            </p>
            <footer className="mt-2 flex items-center gap-1.5 text-xs text-ink-faint">
              NOAA Climate Prediction Center{discussion.issued ? ` · ${discussion.issued}` : ""}
              <a
                href={discussion.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-0.5 text-accent hover:underline"
              >
                <T>source</T> <ExternalLink className="h-3 w-3" />
              </a>
            </footer>
          </blockquote>
        )}
      </div>

      {outlook && <EnsoAdvisorySummary outlook={outlook} observed={current.roni} observedSeason={observedSeason} />}

      {/* Live Pacific SST imagery */}
      <div className="tier-flat overflow-hidden p-0">
        <div className="h-[420px] w-full">
          <PacificSstMap />
        </div>
        <p className="px-5 py-3 text-2xs leading-relaxed text-ink-faint">
          <T>
            Near-real-time sea-surface temperature, NASA GIBS (GHRSST L4 MUR). The dashed box
            marks the Niño 3.4 region — the primary ENSO monitoring zone the RONI index above is
            computed from.
          </T>
        </p>
      </div>

      {/* RONI + Niño 3.4 history chart */}
      <div className="tier-flat p-5">
        <div className="mb-3 flex items-baseline justify-between gap-2">
          <h4 className="flex items-center gap-1 text-sm font-semibold text-ink">
            <T>Relative Oceanic Niño Index, 1950 → present</T>
            <InfoButton id="roni-chart" label="this chart" />
          </h4>
          <span className="text-2xs text-ink-faint">
            <T>Source</T>: NOAA CPC RONI.ascii.txt
          </span>
        </div>
        <EnsoHistoryChart history={data.history} current={current} />
        <p className="mt-2 text-2xs leading-relaxed text-ink-faint">
          <T>
            RONI ≥ +0.5 °C marks an El Niño season, ≤ −0.5 °C a La Niña season. RONI adjusts the
            classic Niño 3.4 anomaly for the global warming trend, so a season is compared against
            the climate of its own time rather than a fixed 1991–2020 baseline.
          </T>
        </p>
      </div>

      {/* 9-season probability outlook */}
      <div className="tier-flat p-5">
        <h4 className="mb-3 flex items-center gap-1 text-sm font-semibold text-ink">
          <T>Where is El Niño heading? 9-season probability outlook</T>
          <InfoButton id="enso-outlook" label="this outlook" />
        </h4>
        <EnsoOutlookChart outlook={outlook} />
      </div>
    </div>
  );
}

function formatSigned(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return "—";
  return `${value > 0 ? "+" : ""}${value.toFixed(2)} °C`;
}

/**
 * The headline forecast, written from NOAA's own numbers: the chance of a record-strength event and the key figures
 * behind it. Observed and forecast values are kept visibly separate.
 */
function EnsoAdvisorySummary({
  outlook,
  observed,
  observedSeason,
}: {
  outlook: EnsoOutlook;
  observed: number | null;
  observedSeason: string;
}) {
  const top = [...(outlook.historicChances ?? [])].sort((a, b) => b.pct - a.pct)[0];
  const row = top ? outlook.seasons.find((s) => s.season === top.season) : undefined;
  if (!top || !row) return null;
  const when = seasonName(top.season);
  const lead = `El Niño is strengthening. According to NOAA's ${longDate(outlook.issued)} advisory, there is a ${top.pct}% probability that the ${when} El Niño will reach or exceed a historic RONI threshold of +2.5 °C — stronger than any event in NOAA's record since 1950.`;
  const tiles: Array<[string, string, string]> = [
    [`Observed RONI, ${observedSeason}`, `${signed(observed)} °C`, "measured"],
    [`Forecast median RONI, ${when}`, `${signed(row.roniMedian)} °C`, `90% range ${signed(row.roniP5)} to ${signed(row.roniP95)}`],
    [`El Niño probability, ${when}`, `${row.elNino}%`, "rounded"],
    [`Very strong (≥ +2.0 °C), ${when}`, row.veryStrong === null ? "—" : `${row.veryStrong}%`, "rounded"],
    [`Historic (≥ +2.5 °C), ${when}`, `${top.pct}%`, "from NOAA's bulletin"],
  ];
  return (
    <div className="tier-flat p-5" aria-label="NOAA ENSO forecast summary">
      <p className="label">
        <T>NOAA forecast</T> · {longDate(outlook.issued)}
      </p>
      <p className="mt-1 text-sm leading-relaxed text-ink">
        <T>{lead}</T>
      </p>
      <dl className="mt-3 grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-5">
        {tiles.map(([k, v, note]) => (
          <div key={k} className="rounded-(--radius-control) bg-surface-recessed p-3">
            <dt className="text-2xs text-ink-faint">
              <T>{k}</T>
            </dt>
            <dd className="mt-0.5 text-lg font-semibold tabular-nums text-ink">{v}</dd>
            <dd className="text-2xs text-ink-faint">
              <T>{note}</T>
            </dd>
          </div>
        ))}
      </dl>
      <p className="mt-3 text-2xs leading-relaxed text-ink-faint">
        <T>
          These are forecasts, not observations. 100% and 0% are rounded probabilities, not guarantees. All strength
          categories use RONI (ERSSTv6-based); older ONI values are not comparable.
        </T>
      </p>
    </div>
  );
}
