"use client";

import { useId, useState } from "react";
import { ArrowDownRight, ArrowUpRight, Info, Minus } from "lucide-react";

import { formatValue } from "@/lib/climate/taxonomy";

/**
 * The focal point of the Explore readout: one number, set large in mono type,
 * with its baseline reference and signed change. Raised tier with a status
 * seam. Everything rounds at render via `formatValue` — stored values are
 * never pre-rounded (docs/AUDIT.md, D7).
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
  seamColor,
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
  seamColor?: string;
  info?: string;
  loading?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const infoId = useId();

  const toneColor =
    tone === "adverse" ? "var(--danger)" : tone === "benign" ? "var(--ok)" : "var(--ink)";
  const hasDelta = delta !== null && delta !== undefined;
  const Arrow = !hasDelta || delta === 0 ? Minus : delta! > 0 ? ArrowUpRight : ArrowDownRight;

  return (
    <div
      className="tier-raised-seam p-5"
      data-tour="metric"
      style={seamColor ? ({ ["--seam-color" as string]: seamColor } as React.CSSProperties) : undefined}
    >
      <div className="mb-3 flex items-center justify-between gap-2">
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
        <div className="h-11 w-32 animate-pulse rounded-(--radius-control) bg-surface-active" />
      ) : (
        <div className="flex items-end gap-2">
          <span
            className="text-[2.75rem] font-semibold leading-[0.95] tracking-tight tabular-nums"
            data-numeric
            style={{ color: toneColor }}
          >
            {hasDelta ? formatValue(delta, indicatorId, "anomaly") : "—"}
          </span>
          <span
            className="mb-1 inline-flex h-6 w-6 items-center justify-center rounded-(--radius-pill)"
            style={{ background: `color-mix(in oklab, ${toneColor} 12%, transparent)`, color: toneColor }}
            aria-hidden
          >
            <Arrow className="h-3.5 w-3.5" />
          </span>
        </div>
      )}

      <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 border-t border-border pt-3 text-xs">
        <dt className="text-ink-faint">Baseline</dt>
        <dd className="text-right tabular-nums text-ink" data-numeric>
          {formatValue(baseline ?? null, indicatorId)}{" "}
          <span className="text-ink-faint">{baselineLabel}</span>
        </dd>
        <dt className="text-ink-faint">Projected</dt>
        <dd className="text-right tabular-nums text-ink" data-numeric>
          {formatValue(projected ?? null, indicatorId)}{" "}
          <span className="text-ink-faint">{epochLabel}</span>
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
