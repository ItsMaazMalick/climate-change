"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, ArrowRight, X } from "lucide-react";

import { COUNTRIES, DEFAULT_COUNTRY, type CountryCode } from "@/lib/climate/countries";

const DONE_KEY = "climate_tour_done";
/** How long to wait for an anchor that mounts only after its data arrives. */
const ANCHOR_TIMEOUT_MS = 6000;

interface TourStep {
  selector: string;
  title: string;
  body: string;
  /** Where this step lives. `profile` resolves to the active country's capital. */
  route: "/explore" | "/compare" | "/hotspots" | "profile";
}

// Follows the demo path in docs/DEMO-SCRIPT.md, anchored to real controls.
const STEPS: TourStep[] = [
  {
    selector: '[data-tour="country"]',
    title: "Pick a country",
    body: "One selector, top-left. It drives every default, the map extent and the wording on every panel. It lives in the URL, so the view you reach is a link you can send.",
    route: "/explore",
  },
  {
    selector: '[data-tour="where"]',
    title: "Where",
    body: "Choose a location — a city, a region, or click the map. Switching country resets this to that country's capital, so you never read a number for the wrong place.",
    route: "/explore",
  },
  {
    selector: '[data-tour="which-future"]',
    title: "Which future",
    body: "An emissions pathway and a 20-year horizon. These are physical forcing scenarios, not predictions.",
    route: "/explore",
  },
  {
    selector: '[data-tour="map"]',
    title: "Read the map",
    body: "Every district is shaded by its own value on the diverging ramp. Hover for the number, click to move the readout to that point.",
    route: "/explore",
  },
  {
    selector: '[data-tour="metric"]',
    title: "The headline number",
    body: "Baseline, projected and change — always against 1995–2014. Projected is baseline plus change, derived in one place and asserted in dev, so the three can never disagree.",
    route: "/explore",
  },
  {
    selector: '[data-tour="readout"]',
    title: "The plain sentence",
    body: "Above the number is the line to read aloud: what changes, by how much, under which pathway, by when.",
    route: "/explore",
  },
  {
    selector: '[data-tour="next-step"]',
    title: "Move through the demo",
    body: "This card carries your country, location, pathway and horizon to the next step. You can run the whole walkthrough by clicking only this.",
    route: "/explore",
  },
  {
    selector: '[data-tour="compare-1"]',
    title: "Step 2 · Compare pathways",
    body: "Same place, same horizon, five emissions pathways. Each has its own absolute value — five forcing pathways cannot share one number. The gap between them is the part still decided by choices.",
    route: "/compare",
  },
  {
    selector: '[data-tour="compare-2"]',
    title: "Compare models",
    body: "Same place, same pathway — thirty different global climate models. Equilibrium climate sensitivity explains most of the spread. These are national aggregates, and the panel says so.",
    route: "/compare",
  },
  {
    selector: '[data-tour="hotspots-ranking"]',
    title: "Step 3 · Hotspots",
    body: "Every administrative region ranked by the size of its projected change, on the criterion named in the header. Click any row to open it back in Explore.",
    route: "/hotspots",
  },
  {
    selector: '[data-tour="place-indicators"]',
    title: "Step 4 · Place profile",
    body: "The full dossier for one place: every indicator against the 1995–2014 baseline, the trajectory to 2100, seasonality, and the physical mechanisms behind the numbers.",
    route: "profile",
  },
];

interface Box {
  top: number;
  left: number;
  width: number;
  height: number;
}

const TIP_W = 360;
const TIP_H = 210;
const PAD = 8;

export function GuidedTour() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const active = params.get("tour") === "1";

  const [i, setI] = useState(0);
  const [box, setBox] = useState<Box | null>(null);
  const [missing, setMissing] = useState(false);
  const [vw, setVw] = useState(1440);
  const [vh, setVh] = useState(900);
  const tipRef = useRef<HTMLDivElement>(null);
  // Portalling needs a real document; this is false on the server snapshot and
  // true on the client without a setState-in-effect round trip.
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );

  // Reset the measurement when the step changes — adjusting state during
  // render rather than in an effect, so there is no extra paint with a stale
  // highlight box.
  const [measuredStep, setMeasuredStep] = useState(i);
  if (measuredStep !== i) {
    setMeasuredStep(i);
    setBox(null);
    setMissing(false);
  }

  const finish = useCallback(
    (completed: boolean) => {
      if (completed) {
        try {
          localStorage.setItem(DONE_KEY, "1");
        } catch {
          /* private mode — the tour simply offers itself again */
        }
      }
      const url = new URL(window.location.href);
      url.searchParams.delete("tour");
      router.replace(url.pathname + (url.search || ""));
    },
    [router],
  );

  // Which page the current step lives on. `profile` resolves to the active
  // country's capital so the last step always has a real dossier to show.
  const countryParam = (params.get("country") ?? "").toUpperCase();
  const country: CountryCode = (
    countryParam in COUNTRIES ? countryParam : DEFAULT_COUNTRY
  ) as CountryCode;
  const routeFor = useCallback(
    (step: TourStep) =>
      step.route === "profile"
        ? `/places/${COUNTRIES[country].defaultCityId}`
        : step.route,
    [country],
  );

  // Carry the tour — and the country — across the step's page change. Without
  // this the tour would end the moment it left /explore.
  useEffect(() => {
    if (!active) return;
    const target = routeFor(STEPS[i]!);
    if (pathname === target || pathname.startsWith(`${target}/`)) return;
    const search = new URLSearchParams(window.location.search);
    search.set("tour", "1");
    search.set("country", country.toLowerCase());
    router.push(`${target}?${search.toString()}`);
  }, [active, i, pathname, router, routeFor, country]);

  useEffect(() => {
    const onResize = () => {
      setVw(window.innerWidth);
      setVh(window.innerHeight);
    };
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  /**
   * Track the anchor continuously while a step is open.
   *
   * Three of the anchors — the metric card, the readout and the Next card —
   * only mount once their API call resolves, and the page scrolls to bring an
   * anchor into view. Measuring once (as the first version did) caught the
   * element missing or mid-scroll, so the highlight sat in the wrong place or
   * never appeared. A rAF loop is cheap and handles late mounts, smooth
   * scrolling, resizes and layout shifts uniformly.
   */
  useEffect(() => {
    if (!active) return;

    let raf = 0;
    let lastScrollAt = 0;
    const startedAt = performance.now();

    const tick = () => {
      const el = document.querySelector(STEPS[i]!.selector);
      if (el) {
        const r = el.getBoundingClientRect();
        if (r.width > 0 || r.height > 0) {
          const vpH = window.innerHeight;
          // Steps 5–7 sit inside the scrollable readout aside and mount only
          // once their request resolves, so a one-shot scroll fired too early
          // or against the wrong element. Re-scroll whenever the anchor is not
          // comfortably in view, throttled so it never fights the user.
          const inView = r.top >= 8 && r.bottom <= vpH - 8;
          const now = performance.now();
          if (!inView && now - lastScrollAt > 700) {
            lastScrollAt = now;
            el.scrollIntoView({ block: "center", behavior: "smooth" });
          }
          // Clamp so an element taller than the viewport still yields a sane
          // ring and scrim geometry.
          const top = Math.max(4, r.top);
          const bottom = Math.min(vpH - 4, r.bottom);
          setBox({
            top,
            left: r.left,
            width: r.width,
            height: Math.max(24, bottom - top),
          });
          setMissing(false);
        }
      } else if (performance.now() - startedAt > ANCHOR_TIMEOUT_MS) {
        // Anchor genuinely absent — show the step centred rather than stalling.
        setMissing(true);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [active, i, pathname]);

  const last = i === STEPS.length - 1;
  const next = useCallback(() => {
    if (last) finish(true);
    else setI((v) => v + 1);
  }, [last, finish]);
  const back = useCallback(() => setI((v) => Math.max(v - 1, 0)), []);

  // Keyboard: arrows move, Escape exits, Tab stays inside the dialog.
  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        finish(false);
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        next();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        back();
      } else if (e.key === "Tab") {
        const focusables = tipRef.current?.querySelectorAll<HTMLElement>(
          'button:not([disabled])',
        );
        if (!focusables || focusables.length === 0) return;
        const first = focusables[0]!;
        const lastEl = focusables[focusables.length - 1]!;
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          lastEl.focus();
        } else if (!e.shiftKey && document.activeElement === lastEl) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [active, finish, next, back]);

  // Move focus into the card on each step so a keyboard user follows along.
  useEffect(() => {
    if (!active) return;
    const t = setTimeout(() => {
      tipRef.current?.querySelector<HTMLElement>("[data-tour-primary]")?.focus();
    }, 60);
    return () => clearTimeout(t);
  }, [active, i]);

  if (!active || !mounted) return null;

  const step = STEPS[i]!;
  const hole = missing ? null : box;

  // Place the card beside the target: below if there is room, else above,
  // else centred. Always clamped inside the viewport.
  let tipTop: number;
  let tipLeft: number;
  if (hole) {
    const below = vh - (hole.top + hole.height);
    tipTop =
      below > TIP_H + 24
        ? hole.top + hole.height + 12
        : hole.top > TIP_H + 24
          ? hole.top - TIP_H - 12
          : Math.max(PAD, vh / 2 - TIP_H / 2);
    tipLeft = hole.left + hole.width / 2 - TIP_W / 2;
  } else {
    tipTop = vh / 2 - TIP_H / 2;
    tipLeft = vw / 2 - TIP_W / 2;
  }
  tipTop = Math.min(Math.max(PAD, tipTop), Math.max(PAD, vh - TIP_H - PAD));
  tipLeft = Math.min(Math.max(PAD, tipLeft), Math.max(PAD, vw - TIP_W - PAD));

  // Rendered into <body>: the tour must never be clipped by an ancestor's
  // overflow, nor trapped beneath a stacking context. The map HUD sits at
  // z-index 1001 and Leaflet's own panes at 400–700, so 9999 clears everything.
  return createPortal(
    <div className="fixed inset-0 z-[9999]" role="presentation">
      {/* Scrim. Four panes around the hole so clicks outside are captured and
          the highlighted control stays visually clear. */}
      {hole ? (
        <>
          <ScrimPane onClick={() => finish(false)} style={{ top: 0, left: 0, right: 0, height: Math.max(0, hole.top - 6) }} />
          <ScrimPane onClick={() => finish(false)} style={{ top: Math.max(0, hole.top + hole.height + 6), left: 0, right: 0, bottom: 0 }} />
          <ScrimPane onClick={() => finish(false)} style={{ top: Math.max(0, hole.top - 6), left: 0, width: Math.max(0, hole.left - 6), height: hole.height + 12 }} />
          <ScrimPane onClick={() => finish(false)} style={{ top: Math.max(0, hole.top - 6), left: hole.left + hole.width + 6, right: 0, height: hole.height + 12 }} />
          <span
            aria-hidden
            className="pointer-events-none absolute rounded-(--radius-container) transition-all motion-panel"
            style={{
              top: hole.top - 6,
              left: hole.left - 6,
              width: hole.width + 12,
              height: hole.height + 12,
              boxShadow:
                "0 0 0 2px var(--leaf-500), 0 0 0 6px rgb(var(--leaf-glow) / 0.28), 0 18px 40px -12px hsl(128 26% 14% / 0.45)",
            }}
          />
        </>
      ) : (
        <ScrimPane onClick={() => finish(false)} style={{ inset: 0 }} />
      )}

      <div
        ref={tipRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="tour-title"
        aria-describedby="tour-body"
        className="tier-overlay absolute p-4 transition-all motion-panel"
        style={{ top: tipTop, left: tipLeft, width: TIP_W }}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="label mb-1" data-numeric>
              Step {i + 1} of {STEPS.length}
            </p>
            <p id="tour-title" className="text-sm font-semibold text-ink">
              {step.title}
            </p>
          </div>
          <button
            type="button"
            onClick={() => finish(false)}
            aria-label="Close guided tour"
            className="-mr-1 -mt-1 rounded-(--radius-control) p-1 text-ink-faint transition-colors hover:bg-surface-hover hover:text-ink"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <p id="tour-body" className="mt-2 text-xs leading-relaxed text-ink-muted">
          {step.body}
        </p>

        {missing && (
          <p className="mt-2 rounded-(--radius-control) border border-border bg-surface-recessed px-2.5 py-1.5 text-2xs leading-snug text-ink-faint">
            This panel is still loading, so it isn&rsquo;t highlighted yet.
          </p>
        )}

        <div className="mt-4 flex items-center justify-between gap-3">
          <div className="flex gap-1" role="tablist" aria-label="Tour progress">
            {STEPS.map((s, n) => (
              <button
                key={s.selector}
                type="button"
                role="tab"
                aria-selected={n === i}
                aria-label={`Step ${n + 1}: ${s.title}`}
                onClick={() => setI(n)}
                className={`h-1.5 rounded-(--radius-pill) transition-all motion-state ${
                  n === i ? "w-5 bg-brand" : "w-1.5 bg-border-strong hover:bg-ink-faint"
                }`}
              />
            ))}
          </div>

          <div className="flex items-center gap-1.5">
            {i > 0 && (
              <button
                type="button"
                onClick={back}
                className="inline-flex items-center gap-1 rounded-(--radius-control) px-2.5 py-1.5 text-xs font-medium text-ink-muted transition-colors hover:bg-surface-hover hover:text-ink"
              >
                <ArrowLeft className="h-3.5 w-3.5" /> Back
              </button>
            )}
            <button
              type="button"
              data-tour-primary
              onClick={next}
              className="btn btn-primary px-3! py-1.5! text-xs"
            >
              {last ? "Done" : "Next"}
              {!last && <ArrowRight className="h-3.5 w-3.5" />}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function ScrimPane({
  style,
  onClick,
}: {
  style: React.CSSProperties;
  onClick: () => void;
}) {
  return (
    <div
      onClick={onClick}
      className="absolute bg-[hsl(128_26%_10%/0.5)] transition-all motion-panel"
      style={style}
    />
  );
}
