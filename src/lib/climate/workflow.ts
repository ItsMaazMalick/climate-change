/**
 * The four-step demo spine.
 *
 * Six peer nav items with no implied order is why an untrained presenter gets
 * lost. Every primary screen is one of these four steps, in this order, and
 * each answers exactly one question. Learn and Methodology are reference, not
 * steps.
 */

export interface WorkflowStep {
  n: 1 | 2 | 3 | 4;
  id: "explore" | "compare" | "hotspots" | "profile";
  label: string;
  /** Route pattern. `profile` is dynamic; `href()` fills it in. */
  route: string;
  question: string;
  /** One line under the step's page title. */
  blurb: string;
}

export const WORKFLOW: WorkflowStep[] = [
  {
    n: 1,
    id: "explore",
    label: "Explore",
    route: "/explore",
    question: "What happens to this place?",
    blurb: "Pick a location and a future. Read the projected change against the 1995–2014 baseline.",
  },
  {
    n: 2,
    id: "compare",
    label: "Compare",
    route: "/compare",
    question: "How much is uncertain, and why?",
    blurb: "Hold the place fixed. See how the answer moves across emissions pathways and across models.",
  },
  {
    n: 3,
    id: "hotspots",
    label: "Hotspots",
    route: "/hotspots",
    question: "Where is change most extreme?",
    blurb: "Rank every administrative region by the size of its projected change.",
  },
  {
    n: 4,
    id: "profile",
    label: "Place profile",
    route: "/places/[id]",
    question: "Give me the full dossier.",
    blurb: "Every indicator, every pathway, every horizon for one place — the view to screenshot.",
  },
];

export const REFERENCE_LINKS = [
  { href: "/learn", label: "Learn" },
  { href: "/methodology", label: "Methodology" },
];

/** Which step, if any, a pathname belongs to. */
export function stepForPath(pathname: string): WorkflowStep | null {
  if (pathname.startsWith("/explore")) return WORKFLOW[0]!;
  if (pathname.startsWith("/compare")) return WORKFLOW[1]!;
  if (pathname.startsWith("/hotspots")) return WORKFLOW[2]!;
  if (pathname.startsWith("/places")) return WORKFLOW[3]!;
  return null;
}

/** Carry-forward URL state shared across steps. */
export interface CarryState {
  country?: string;
  lat?: string;
  lon?: string;
  place?: string;
  area?: string;
  indicator?: string;
  scenario?: string;
  period?: string;
}

export function carryQuery(state: CarryState): string {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(state)) {
    if (v !== undefined && v !== null && v !== "") params.set(k, String(v));
  }
  const q = params.toString();
  return q ? `?${q}` : "";
}

/**
 * The next step and where it points, given the current step and the state to
 * carry. The presenter only ever needs to click this.
 */
export function nextStep(
  current: WorkflowStep["id"],
  state: CarryState,
): { step: WorkflowStep; href: string } | null {
  const idx = WORKFLOW.findIndex((s) => s.id === current);
  if (idx < 0 || idx >= WORKFLOW.length - 1) return null;
  const step = WORKFLOW[idx + 1]!;
  if (step.id === "profile") {
    const id = state.place || "islamabad";
    return { step, href: `/places/${id}${carryQuery({ ...state, place: undefined })}` };
  }
  return { step, href: `${step.route}${carryQuery(state)}` };
}
