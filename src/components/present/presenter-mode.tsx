"use client";

import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";

import { stepForPath } from "@/lib/climate/workflow";

/**
 * `?present=1` — projector mode. Bumps the base font 15% (everything is
 * rem-based, so this scales the whole product), thickens chart strokes, hides
 * dev affordances, and pins a footer showing the current step so the room
 * always knows where the demo is.
 */
export function PresenterMode() {
  const params = useSearchParams();
  const pathname = usePathname();
  const on = params.get("present") === "1";

  useEffect(() => {
    const root = document.documentElement;
    if (on) root.setAttribute("data-present", "1");
    else root.removeAttribute("data-present");
    return () => root.removeAttribute("data-present");
  }, [on]);

  if (!on) return null;
  const step = stepForPath(pathname);

  return (
    <footer className="fixed inset-x-0 bottom-0 z-50 flex items-center justify-between border-t border-border bg-surface-panel px-6 py-2 text-sm shadow-(--elevation-overlay)">
      <span className="font-medium text-ink">Earth Scan Systems · Climate Intelligence</span>
      {step ? (
        <span className="text-ink-muted" data-numeric>
          Step {step.n} of 4 · {step.label}
        </span>
      ) : (
        <span className="text-ink-faint">Overview</span>
      )}
    </footer>
  );
}
