"use client";

import { useId, useState } from "react";
import { ArrowDownRight, ArrowUpRight, Info, Minus } from "lucide-react";

import { coherentDisplay } from "@/lib/climate/derive";
import { formatValue } from "@/lib/climate/taxonomy";

/**
 * The focal point of the Explore readout: one number, set large in mono type,
 * with its baseline reference and projected value as a small paired bar.
 * Raised tier with a status seam and a tone-tinted glow behind the figure.
 *
 * Everything rounds at render via `formatValue` — stored values are never
 * pre-rounded (docs/AUDIT.md, D7).
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
    tone === "adverse" ? "var(--danger)" : tone === "benign" ? "var(--ok)" : "var(--accent-600)";

  // Round the triple together so baseline + change = projected on screen (D7).
  // `projected` from the API is already baseline + delta at full precision; we
  // only re-derive the *displayed* value so the three never disagree by a tenth.
  const shown = coherentDisplay(baseline, delta, indicatorId);
  const hasDelta = shown.delta !== null;
  const Arrow =
    !hasDelta || shown.delta === 0 ? Minus : shown.delta! > 0 ? ArrowUpRight : ArrowDownRight;

  // Baseline vs projected as a paired mini-bar (relative to a shared max).
  const b = shown.baseline;
  const p = shown.projected ?? (typeof projected === "number" ? projected : null);
  const lo = b !== null && p !== null ? Math.min(0, b, p) : 0;
  const hi = b !== null && p !== null ? Math.max(b, p) : 1;
  const span = hi - lo || 1;
  const pct = (v: number | null) => (v === null ? 0 : ((v - lo) / span) * 100);

  return (
    <div
      className="tier-raised-seam relative overflow-hidden p-5"
      data-tour="metric"
      style={seamColor ? ({ ["--seam-color" as string]: seamColor } as React.CSSProperties) : undefined}
    >
      {/* tone glow */}
      <span
        aria-hidden
        className="pointer-events-none absolute -right-10 -top-12 h-40 w-40 rounded-(--radius-pill) opacity-30 blur-3xl"
        style={{ background: toneColor }}
      />

      <div className="relative mb-3 flex items-center justify-between gap-2">
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
        <div className="h-12 w-36 animate-pulse rounded-(--radius-control) bg-surface-active" />
      ) : (
        <div className="relative flex items-end gap-2.5">
          <span
            className="text-[3.25rem] font-semibold leading-[0.82] tracking-tight tabular-nums"
            data-numeric
            style={{ color: toneColor }}
          >
            {hasDelta ? formatValue(shown.delta, indicatorId, "anomaly") : "—"}
          </span>
          <span
            className="mb-1.5 inline-flex h-7 w-7 items-center justify-center rounded-(--radius-pill)"
            style={{
              background: `color-mix(in oklab, ${toneColor} 16%, transparent)`,
              color: toneColor,
              boxShadow: `0 0 14px -2px color-mix(in oklab, ${toneColor} 60%, transparent)`,
            }}
            aria-hidden
          >
            <Arrow className="h-4 w-4" />
          </span>
        </div>
      )}

      <div className="relative mt-5 space-y-2 rounded-(--radius-control) bg-surface-recessed p-3 shadow-(--elevation-recessed)">
        <BarRow
          name="Baseline"
          value={formatValue(b, indicatorId)}
          sub={baselineLabel}
          pct={pct(b)}
          color="var(--n-400)"
        />
        <BarRow
          name="Projected"
          value={formatValue(p, indicatorId)}
          sub={epochLabel}
          pct={pct(p)}
          color={toneColor}
        />
      </div>

      {info && open && (
        <p id={infoId} className="relative mt-3 border-t border-border pt-2 text-xs leading-relaxed text-ink-muted">
          {info}
        </p>
      )}
    </div>
  );
}

function BarRow({
  name,
  value,
  sub,
  pct,
  color,
}: {
  name: string;
  value: string;
  sub: string;
  pct: number;
  color: string;
}) {
  return (
    <div className="grid grid-cols-[58px_1fr_auto] items-center gap-2.5">
      <span className="text-2xs font-medium text-ink-faint">{name}</span>
      <span className="h-2 overflow-hidden rounded-(--radius-pill) bg-surface-panel shadow-[inset_0_1px_2px_hsl(128_26%_14%/0.16)]">
        <span
          className="block h-full rounded-(--radius-pill) transition-[width] duration-500"
          style={{
            width: `${Math.max(3, Math.min(100, pct))}%`,
            background: color,
            boxShadow: `0 0 8px -1px ${color}`,
          }}
        />
      </span>
      <span className="text-right text-xs tabular-nums text-ink" data-numeric>
        {value} <span className="text-ink-faint">{sub}</span>
      </span>
    </div>
  );
}
