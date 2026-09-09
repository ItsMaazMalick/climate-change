"use client";

import { useId, useState } from "react";
import { Info } from "lucide-react";

import { formatValue } from "@/lib/climate/taxonomy";

/**
 * The focal point of the Explore readout: one number, set large in mono type,
 * with its baseline reference and signed change. Raised elevation tier.
 *
 * Everything here rounds at render via `formatValue` — stored values are never
 * pre-rounded (see docs/AUDIT.md, D7).
 */
export function MetricCard({
  label,
  indicatorId,
  baseline,
  projected,
  delta,
  epochLabel,
  baselineLabel = "1995–2014",
  tone = "neutral",
  info,
  loading,
}: {
  label: string;
  indicatorId: string;
  baseline: number | null | undefined;
  projected: number | null | undefined;
  delta: number | null | undefined;
  epochLabel: string;
  baselineLabel?: string;
  tone?: "adverse" | "benign" | "neutral";
  info?: string;
  loading?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const infoId = useId();

  const toneColor =
    tone === "adverse"
      ? "var(--danger)"
      : tone === "benign"
        ? "var(--ok)"
        : "var(--ink)";

  return (
    <div className="tier-raised p-4" data-tour="metric">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="label">{label}</span>
        {info && (
          <button
            type="button"
            aria-label={open ? "Hide definition" : "Show definition"}
            aria-expanded={open}
            aria-controls={infoId}
            onClick={() => setOpen((v) => !v)}
            className="rounded-(--radius-control) p-1 text-ink-faint transition-colors hover:bg-surface-hover hover:text-ink"
          >
            <Info className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {loading ? (
        <div className="h-9 w-28 animate-pulse rounded-(--radius-control) bg-surface-active" />
      ) : (
        <div
          className="text-2xl font-semibold leading-none tabular-nums"
          data-numeric
          style={{ color: toneColor }}
        >
          {delta !== null && delta !== undefined
            ? formatValue(delta, indicatorId, "anomaly")
            : "—"}
        </div>
      )}

      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
        <dt className="text-ink-faint">Baseline</dt>
        <dd className="text-right tabular-nums text-ink" data-numeric>
          {formatValue(baseline ?? null, indicatorId)}
          <span className="ml-1 text-ink-faint">{baselineLabel}</span>
        </dd>
        <dt className="text-ink-faint">Projected</dt>
        <dd className="text-right tabular-nums text-ink" data-numeric>
          {formatValue(projected ?? null, indicatorId)}
          <span className="ml-1 text-ink-faint">{epochLabel}</span>
        </dd>
      </dl>

      {info && open && (
        <p id={infoId} className="mt-3 border-t border-border pt-2 text-xs leading-relaxed text-ink-muted">
          {info}
        </p>
      )}
    </div>
  );
}
