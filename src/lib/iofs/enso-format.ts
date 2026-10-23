/** Pure display helpers for ENSO seasons — safe to import from client components (no server-only modules). */

const SEASON_LONG: Record<string, string> = {
  DJF: "Dec–Feb", JFM: "Jan–Mar", FMA: "Feb–Apr", MAM: "Mar–May", AMJ: "Apr–Jun", MJJ: "May–Jul",
  JJA: "Jun–Aug", JAS: "Jul–Sep", ASO: "Aug–Oct", SON: "Sep–Nov", OND: "Oct–Dec", NDJ: "Nov–Jan",
};
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/** "OND 2026" → "Oct–Dec 2026" */
export function seasonName(label: string): string {
  const [abbr, year] = label.split(" ");
  return `${SEASON_LONG[abbr ?? ""] ?? abbr} ${year}`;
}

/** "2026-10-08" → "8 October 2026" */
export function longDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return `${d} ${MONTHS[(m ?? 1) - 1]} ${y}`;
}

export function signed(value: number | null | undefined, digits = 2): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  return `${value > 0 ? "+" : ""}${value.toFixed(digits)}`;
}
