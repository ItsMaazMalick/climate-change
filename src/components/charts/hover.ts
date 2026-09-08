"use client";

import { useCallback, useRef, useState } from "react";

/**
 * Shared pointer plumbing for the charts.
 *
 * Every chart here answers hover the same way: map the pointer's x position
 * to the nearest data index, and report that index plus where to anchor a
 * tooltip. Doing it once means the crosshair, the dots and the tooltip in
 * four different charts all snap on the same rule, which is what makes them
 * feel like one instrument rather than four widgets.
 *
 * The pointer is tracked in the SVG's own user-space coordinates, not in CSS
 * pixels, so hit-testing stays correct however the chart is scaled — which it
 * always is, since the charts are responsive and the viewBox is fixed.
 */

export interface HoverState {
  /** Index into the chart's data array. */
  index: number;
  /** Pointer position in SVG user space. */
  x: number;
  y: number;
  /** Pointer position relative to the container, for placing an HTML tooltip. */
  clientX: number;
  clientY: number;
  /**
   * Container width, measured in the pointer handler rather than read from
   * the ref during render — reading a ref while rendering is not safe, and
   * the width is only ever needed alongside a pointer position anyway.
   */
  containerWidth: number;
}

export interface HoverBinding {
  hover: HoverState | null;
  containerRef: React.RefObject<HTMLDivElement | null>;
  handlers: {
    onPointerMove: (event: React.PointerEvent<SVGSVGElement>) => void;
    onPointerLeave: () => void;
    onPointerDown: (event: React.PointerEvent<SVGSVGElement>) => void;
  };
  clear: () => void;
}

/**
 * @param count      number of data points
 * @param xForIndex  x position, in SVG user space, of each index
 */
export function useChartHover(
  count: number,
  xForIndex: (index: number) => number,
): HoverBinding {
  const [hover, setHover] = useState<HoverState | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const locate = useCallback(
    (event: React.PointerEvent<SVGSVGElement>) => {
      if (count === 0) return;
      const svg = event.currentTarget;
      const rect = svg.getBoundingClientRect();
      if (rect.width === 0) return;

      const viewBox = svg.viewBox.baseVal;
      // The SVG scales to its container, so screen pixels have to be mapped
      // back through the viewBox before they mean anything to the data.
      const userX = ((event.clientX - rect.left) / rect.width) * viewBox.width;
      const userY = ((event.clientY - rect.top) / rect.height) * viewBox.height;

      let best = 0;
      let bestDistance = Number.POSITIVE_INFINITY;
      for (let index = 0; index < count; index += 1) {
        const distance = Math.abs(xForIndex(index) - userX);
        if (distance < bestDistance) {
          bestDistance = distance;
          best = index;
        }
      }

      const containerRect = containerRef.current?.getBoundingClientRect();
      setHover({
        index: best,
        x: xForIndex(best),
        y: userY,
        clientX: containerRect ? event.clientX - containerRect.left : 0,
        clientY: containerRect ? event.clientY - containerRect.top : 0,
        containerWidth: containerRect?.width ?? rect.width,
      });
    },
    [count, xForIndex],
  );

  return {
    hover,
    containerRef,
    handlers: {
      onPointerMove: locate,
      // Touch: a tap should read the chart rather than do nothing.
      onPointerDown: locate,
      onPointerLeave: () => setHover(null),
    },
    clear: () => setHover(null),
  };
}

/**
 * Keep a tooltip inside its container.
 *
 * Without this, the tooltip for December hangs off the right edge of the
 * panel — which is exactly where the interesting values tend to be.
 */
export function tooltipStyle(
  clientX: number,
  containerWidth: number,
  tooltipWidth: number,
): React.CSSProperties {
  const half = tooltipWidth / 2;
  const left = Math.min(
    Math.max(clientX, half + 4),
    Math.max(containerWidth - half - 4, half + 4),
  );
  return { left, transform: "translateX(-50%)" };
}

/** Axis ticks on 1/2/5×10ⁿ steps. */
export function niceTicks(min: number, max: number, target: number): number[] {
  const span = max - min;
  if (span <= 0) return [min];
  const rough = span / target;
  const magnitude = 10 ** Math.floor(Math.log10(rough));
  const normalised = rough / magnitude;
  const step =
    (normalised < 1.5 ? 1 : normalised < 3 ? 2 : normalised < 7 ? 5 : 10) * magnitude;

  const ticks: number[] = [];
  for (let t = Math.ceil(min / step) * step; t <= max; t += step) {
    ticks.push(Number(t.toFixed(6)));
  }
  return ticks;
}

export const AXIS = "#e2e8f0";
export const AXIS_TEXT = "#64748b";
