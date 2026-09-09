"use client";

import { useMemo } from "react";

import { buildScale } from "@/lib/colors";
import { INDICATORS, type ProductId } from "@/lib/climate/taxonomy";

interface LegendProps {
  min: number | null;
  max: number | null;
  unit: string;
  indicatorId: string;
  product: ProductId;
  hasDisagreement?: boolean;
}

/**
 * Colour legend.
 *
 * Rendered as a continuous gradient rather than binned swatches because the
 * underlying field is continuous, and binning invites reading a class
 * boundary as a physical threshold when it is only a rendering choice.
 */
export function Legend({
  min,
  max,
  unit,
  indicatorId,
  product,
  hasDisagreement,
}: LegendProps) {
  const scale = useMemo(() => {
    if (min === null || max === null) return null;
    return buildScale({ min, max, indicatorId, product });
  }, [min, max, indicatorId, product]);

  if (!scale) return null;

  const stops = scale.ticks(24);
  const gradient = `linear-gradient(to right, ${stops
    .map((stop, index) => `${stop.color} ${(index / (stops.length - 1)) * 100}%`)
    .join(", ")})`;

  const [lo, hi] = scale.domain;
  const labels = scale.diverging
    ? [lo, lo / 2, 0, hi / 2, hi]
    : [lo, lo + (hi - lo) / 4, lo + (hi - lo) / 2, lo + (3 * (hi - lo)) / 4, hi];

  const indicator = INDICATORS[indicatorId];
  const precision = indicator?.precision ?? 1;

  return (
    <div className="tier-overlay p-3">
      <div className="label mb-2">
        {product === "anomaly" ? "Change vs 1995–2014" : indicator?.label}
        <span className="ml-1.5 font-normal normal-case tracking-normal text-ink-faint">
          ({unit})
        </span>
      </div>

      <div
        className="h-3 w-full rounded-xs ring-1 ring-inset ring-border"
        style={{ background: gradient }}
        role="presentation"
      />

      <div className="mt-1.5 flex justify-between text-[10.5px] font-medium text-ink-muted tabular-nums" data-numeric>
        {labels.map((value, index) => (
          <span key={index}>
            {value > 0 && scale.diverging ? "+" : ""}
            {value.toFixed(precision)}
          </span>
        ))}
      </div>

      <div className="mt-2.5 flex items-center gap-2 border-t border-border pt-2 text-[10px] leading-snug text-ink-faint">
        <span className="hatch-oob inline-block h-3.5 w-3.5 shrink-0 rounded-xs border border-border-strong" />
        <span>Hatched = outside data coverage.</span>
      </div>

      {hasDisagreement && (
        <div className="mt-1.5 flex items-start gap-2 text-[10px] leading-snug text-ink-faint">
          <span
            className="mt-0.5 inline-block h-3.5 w-3.5 shrink-0 rounded-xs border border-border-strong"
            style={{ background: "currentColor", opacity: 0.4 }}
          />
          <span>
            Paler regions are where models disagree on the sign of the change —
            the colour is the median, but its direction is not robust.
          </span>
        </div>
      )}
    </div>
  );
}
