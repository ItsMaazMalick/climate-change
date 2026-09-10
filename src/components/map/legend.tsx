"use client";

import { useMemo } from "react";

import { buildClassedScale } from "@/lib/colors";
import { formatValue, INDICATORS, type ProductId } from "@/lib/climate/taxonomy";

interface LegendProps {
  /** The region values actually drawn, so the legend and the map agree. */
  values: Array<number | null | undefined>;
  unit: string;
  indicatorId: string;
  product: ProductId;
  hasDisagreement?: boolean;
}

/**
 * Discrete swatches with numeric breakpoints.
 *
 * A continuous gradient bar is honest about the underlying field being
 * continuous, but it cannot tell a reader which band a given polygon falls in
 * — and once the scale is classed to the data, the class edges *are* the
 * information. Each swatch is labelled with its lower bound, so any colour on
 * the map can be read back to a number and a unit.
 */
export function Legend({
  values,
  unit,
  indicatorId,
  product,
  hasDisagreement,
}: LegendProps) {
  const scale = useMemo(
    () => buildClassedScale({ values, indicatorId, product }),
    [values, indicatorId, product],
  );

  if (scale.breaks.length === 0) return null;

  const indicator = INDICATORS[indicatorId];

  return (
    <div className="tier-overlay p-3">
      <div className="label mb-2">
        {product === "anomaly" ? "Change vs 1995–2014" : indicator?.label}
        <span className="ml-1.5 font-normal normal-case tracking-normal text-ink-faint">
          ({unit})
        </span>
      </div>

      <div className="flex" role="img" aria-label={`Colour scale, ${scale.breaks.length} classes`}>
        {scale.breaks.map((b, i) => (
          <div key={i} className="flex-1">
            <div
              className="h-3 first:rounded-l-xs last:rounded-r-xs"
              style={{ background: b.color }}
            />
          </div>
        ))}
      </div>

      <div className="mt-1 flex justify-between text-[10px] font-medium tabular-nums text-ink-muted" data-numeric>
        <span>{formatValue(scale.breaks[0]!.from, indicatorId, product)}</span>
        <span>
          {formatValue(scale.breaks[scale.breaks.length - 1]!.to, indicatorId, product)}
        </span>
      </div>

      <ul className="mt-2 grid grid-cols-2 gap-x-3 gap-y-0.5 border-t border-border pt-2 text-[10px] text-ink-muted">
        {scale.breaks.map((b, i) => (
          <li key={i} className="flex items-center gap-1.5">
            <span
              aria-hidden
              className="h-2.5 w-2.5 shrink-0 rounded-xs ring-1 ring-inset ring-border"
              style={{ background: b.color }}
            />
            <span className="tabular-nums" data-numeric>
              {formatValue(b.from, indicatorId, product)}
            </span>
          </li>
        ))}
      </ul>

      <div className="mt-2 flex items-center gap-2 border-t border-border pt-2 text-[10px] leading-snug text-ink-faint">
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
