"use client";

import { useCallback, useEffect, useLayoutEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { X } from "lucide-react";

const DONE_KEY = "climate_tour_done";

interface TourStep {
  selector: string;
  title: string;
  body: string;
  /** Navigate here before showing this step. */
  path?: string;
}

// Follows the demo path. Anchored to real controls via data-tour attributes.
const STEPS: TourStep[] = [
  {
    selector: '[data-tour="country"]',
    title: "1 · Pick a country",
    body: "One selector, top-left. It sets every default, the map extent and the wording on every panel. Selection lives in the URL, so this whole view is a link you can send.",
  },
  {
    selector: '[data-tour="where"]',
    title: "2 · Where",
    body: "Choose a location — a city, or click the map. On a country switch this resets to that country's capital.",
  },
  {
    selector: '[data-tour="which-future"]',
    title: "3 · Which future",
    body: "An emissions pathway (SSP) and a 20-year horizon. These are physical pathways, not predictions.",
  },
  {
    selector: '[data-tour="map"]',
    title: "4 · Read the map",
    body: "Each admin region is shaded by its own value on the diverging ramp. Hover for the number; click to move the readout.",
  },
  {
    selector: '[data-tour="metric"]',
    title: "5 · The headline number",
    body: "Baseline, projected and change — always against 1995–2014. Projected is baseline plus change, derived in one place and checked.",
  },
  {
    selector: '[data-tour="readout"]',
    title: "6 · The plain sentence",
    body: "Above every number is the sentence to read aloud: what changes, by how much, under which pathway, by when.",
  },
  {
    selector: '[data-tour="next-step"]',
    title: "7 · Move through the demo",
    body: "This card carries your country, location, pathway and horizon to the next step. You can run the entire walkthrough by clicking only this.",
  },
];

interface Box {
  top: number;
  left: number;
  width: number;
  height: number;
}

export function GuidedTour() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const active = params.get("tour") === "1";

  const [i, setI] = useState(0);
  const [box, setBox] = useState<Box | null>(null);

  const finish = useCallback(
    (completed: boolean) => {
      if (completed) {
        try {
          localStorage.setItem(DONE_KEY, "1");
        } catch {
          /* ignore */
        }
      }
      const url = new URL(window.location.href);
      url.searchParams.delete("tour");
      router.replace(url.pathname + url.search);
    },
    [router],
  );

  // Ensure the tour runs on /explore where its anchors live.
  useEffect(() => {
    if (active && !pathname.startsWith("/explore")) {
      router.replace(`/explore?tour=1`);
    }
  }, [active, pathname, router]);

  useLayoutEffect(() => {
    if (!active) return;
    let raf = 0;
    const measure = () => {
      const el = document.querySelector(STEPS[i]!.selector);
      if (!el) {
        setBox(null);
        return;
      }
      el.scrollIntoView({ block: "center", behavior: "smooth" });
      const r = el.getBoundingClientRect();
      setBox({ top: r.top, left: r.left, width: r.width, height: r.height });
    };
    measure();
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(measure);
    };
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onScroll);
    const retry = setTimeout(measure, 250);
    return () => {
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onScroll);
      clearTimeout(retry);
      cancelAnimationFrame(raf);
    };
  }, [active, i]);

  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") finish(false);
      if (e.key === "ArrowRight") setI((v) => Math.min(v + 1, STEPS.length - 1));
      if (e.key === "ArrowLeft") setI((v) => Math.max(v - 1, 0));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active, finish]);

  if (!active) return null;

  const step = STEPS[i]!;
  const last = i === STEPS.length - 1;

  // Tooltip placement: below the target if there's room, else above.
  const belowRoom = box ? window.innerHeight - (box.top + box.height) > 200 : true;
  const tipTop = box
    ? belowRoom
      ? box.top + box.height + 12
      : Math.max(12, box.top - 12 - 176)
    : window.innerHeight / 2 - 88;
  const tipLeft = box
    ? Math.min(Math.max(12, box.left), window.innerWidth - 372)
    : window.innerWidth / 2 - 180;

  return (
    <div className="fixed inset-0 z-[100]" role="dialog" aria-modal="true" aria-label="Guided tour">
      {/* Scrim with a hole punched around the target via a huge spread shadow */}
      <div
        className="absolute inset-0 bg-[rgba(17,21,27,0.45)] transition-all duration-[var(--dur-panel)]"
        style={
          box
            ? {
                background: "transparent",
                boxShadow: `0 0 0 9999px rgba(17,21,27,0.45)`,
                position: "absolute",
                top: box.top - 6,
                left: box.left - 6,
                width: box.width + 12,
                height: box.height + 12,
                borderRadius: "8px",
                outline: "2px solid var(--accent-500)",
              }
            : undefined
        }
        onClick={() => finish(false)}
      />

      <div
        className="tier-overlay absolute w-[360px] p-4"
        style={{ top: tipTop, left: tipLeft }}
      >
        <div className="flex items-start justify-between gap-3">
          <p className="text-sm font-semibold text-ink">{step.title}</p>
          <button
            type="button"
            onClick={() => finish(false)}
            aria-label="Close tour"
            className="rounded-(--radius-control) p-1 text-ink-faint hover:bg-surface-hover"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <p className="mt-1.5 text-xs leading-relaxed text-ink-muted">{step.body}</p>

        <div className="mt-3 flex items-center justify-between">
          <div className="flex gap-1" aria-hidden>
            {STEPS.map((_, n) => (
              <span
                key={n}
                className={`h-1 w-4 rounded-(--radius-pill) ${n === i ? "bg-accent" : "bg-border-strong"}`}
              />
            ))}
          </div>
          <div className="flex items-center gap-2">
            {i > 0 && (
              <button
                type="button"
                onClick={() => setI((v) => v - 1)}
                className="rounded-(--radius-control) px-2.5 py-1.5 text-xs font-medium text-ink-muted hover:bg-surface-hover"
              >
                Back
              </button>
            )}
            <button
              type="button"
              onClick={() => (last ? finish(true) : setI((v) => v + 1))}
              className="rounded-(--radius-control) bg-accent px-3 py-1.5 text-xs font-medium text-accent-ink hover:bg-accent-hover"
            >
              {last ? "Done" : "Next"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
