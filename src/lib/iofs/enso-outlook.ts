import { cached } from "@/lib/cache";

import { fetchNoaaText } from "./enso";

/**
 * NOAA CPC's official ENSO outlook — the same numbers NOAA publishes each month on three pages:
 *
 *  - /enso/roni/probabilities/ — chance of La Niña / Neutral / El Niño for 9 overlapping 3-month seasons
 *  - /enso/roni/strengths/     — chance of each strength category (we keep "very strong", index ≥ +2.0 °C)
 *  - /enso/roni/outlook/       — forecast RONI percentiles (the 50 % column is the median)
 *
 * plus the "historic event" chance (3-month RONI ≥ +2.5 °C) that CPC quotes in its bulletin.
 *
 * The tables carry no years, so seasons are labelled from the bulletin's issue date. Nothing is invented: if a table
 * is missing, can't be parsed, or belongs to a different month than the bulletin, `getEnsoOutlook` returns `null`
 * and the UI shows an honest "unavailable" state. There is no seeded fallback.
 */

const BASE = "https://cpc.ncep.noaa.gov/products/analysis_monitoring/enso/roni";
export const CPC_URLS = {
  probabilities: `${BASE}/probabilities/`,
  strengths: `${BASE}/strengths/`,
  outlook: `${BASE}/outlook/`,
  bulletin: "https://www.cpc.ncep.noaa.gov/products/analysis_monitoring/enso_advisory/ensodisc.txt",
} as const;

const SEASON_MIDDLE_MONTH: Record<string, number> = {
  DJF: 1, JFM: 2, FMA: 3, MAM: 4, AMJ: 5, MJJ: 6, JJA: 7, JAS: 8, ASO: 9, SON: 10, OND: 11, NDJ: 12,
};
const MONTHS = [
  "january", "february", "march", "april", "may", "june",
  "july", "august", "september", "october", "november", "december",
];
const MONTH_INITIAL = "JFMAMJJASOND";

export interface EnsoOutlookSeason {
  /** e.g. "OND 2026" (year of the middle month, like the RONI file) */
  season: string;
  /** % chance of El Niño / Neutral / La Niña conditions, as published */
  elNino: number;
  neutral: number;
  laNina: number;
  /** % chance that the 3-month RONI is ≥ +2.0 °C (NOAA's "very strong") */
  veryStrong: number | null;
  /** NOAA's forecast RONI (°C): median and the 5th / 95th percentiles */
  roniMedian: number | null;
  roniP5: number | null;
  roniP95: number | null;
}

export interface EnsoOutlook {
  seasons: EnsoOutlookSeason[];
  /** Bulletin issue date, YYYY-MM-DD */
  issued: string;
  /** Chance that a 3-month RONI reaches +2.5 °C or more (stronger than any event since 1950), from the bulletin text */
  historicChances: { season: string; pct: number }[] | null;
  /** Probabilities page — kept as `sourceUrl` for the chart's citation link */
  sourceUrl: string;
}

export interface CpcRow {
  abbr: string;
  cells: number[];
}

/** Rows of the CPC table with this id: season abbreviation + numeric cells. [] if the table is missing or malformed. */
export function parseCpcTable(html: string, tableId: string): CpcRow[] {
  const table = new RegExp(`<table[^>]*id="${tableId}"[^>]*>([\\s\\S]*?)</table>`, "i").exec(html)?.[1];
  if (!table) return [];
  const rows: CpcRow[] = [];
  for (const tr of table.split(/<tr[\s>]/i).slice(1)) {
    const abbr = /<abbr>\s*([A-Z]{3})\b/.exec(tr)?.[1];
    if (!abbr || !(abbr in SEASON_MIDDLE_MONTH)) continue;
    const cells = [...tr.matchAll(/<td[^>]*>\s*(-?\d+(?:\.\d+)?)\s*<\/td>/gi)].map((m) => Number(m[1]));
    if (cells.length) rows.push({ abbr, cells });
  }
  return rows;
}

/** Label seasons with the year of their MIDDLE month (the RONI file's convention), counting forward from the issue month. */
export function seasonLabels(abbrs: string[], issued: string): string[] {
  const issueYear = Number(issued.slice(0, 4));
  const issueMonth = Number(issued.slice(5, 7));
  const first = SEASON_MIDDLE_MONTH[abbrs[0] ?? ""];
  if (!first) return [];
  let year = issueYear + (first - issueMonth > 6 ? -1 : issueMonth - first > 6 ? 1 : 0);
  let prev = first;
  return abbrs.map((a, i) => {
    const m = SEASON_MIDDLE_MONTH[a]!;
    if (i > 0 && m < prev) year += 1;
    prev = m;
    return `${a} ${year}`;
  });
}

export function buildOutlookSeasons(
  probs: CpcRow[],
  strengths: CpcRow[],
  roni: CpcRow[],
  issued: string,
): EnsoOutlookSeason[] {
  if (!probs.length) return [];
  const labels = seasonLabels(
    probs.map((r) => r.abbr),
    issued,
  );
  return probs.map((p, i) => {
    const s = strengths.find((r) => r.abbr === p.abbr && r.cells.length === 9);
    const q = roni.find((r) => r.abbr === p.abbr && r.cells.length === 7);
    return {
      season: labels[i]!,
      laNina: p.cells[0]!,
      neutral: p.cells[1]!,
      elNino: p.cells[2]!,
      veryStrong: s ? s.cells[8]! : null,
      roniMedian: q ? q.cells[3]! : null,
      roniP5: q ? q.cells[0]! : null,
      roniP95: q ? q.cells[6]! : null,
    };
  });
}

/**
 * "…the chance is 54% for September-November, 83% for October-December, and 70% for November-January" →
 * season labels + percentages. null when the sentence is absent or doesn't parse (never guessed).
 */
export function parseHistoricChances(discussion: string, issued: string): { season: string; pct: number }[] | null {
  const sentence = /chance is\s+([^.]*\d+%[^.]*)\./i.exec(discussion.replace(/\s+/g, " "))?.[1];
  if (!sentence) return null;
  const issueYear = Number(issued.slice(0, 4));
  const issueMonth = Number(issued.slice(5, 7));
  const out: { season: string; pct: number }[] = [];
  for (const m of sentence.matchAll(/(\d{1,3})%\s+for\s+([A-Za-z]+)-([A-Za-z]+)/g)) {
    const a = MONTHS.findIndex((n) => n.startsWith(m[2]!.slice(0, 3).toLowerCase()));
    const b = MONTHS.findIndex((n) => n.startsWith(m[3]!.slice(0, 3).toLowerCase()));
    if (a < 0 || b < 0 || (b - a + 12) % 12 !== 2) return null;
    const abbr = [0, 1, 2].map((k) => MONTH_INITIAL[(a + k) % 12]).join("");
    const mid = ((a + 1) % 12) + 1;
    const year = issueYear + (mid - issueMonth > 6 ? -1 : issueMonth - mid > 6 ? 1 : 0);
    out.push({ season: `${abbr} ${year}`, pct: Number(m[1]) });
  }
  return out.length ? out : null;
}

const pageIssue = (html: string): string | null => {
  const found = [...html.matchAll(/Issued\s+([A-Z][a-z]+)\s+(\d{4})/g)].at(-1);
  return found ? `${found[1]} ${found[2]}` : null;
};

async function fetchHtml(url: string): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20_000);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": "climate-pakistan/1.0 (IOFS climate & ENSO panel)" },
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`NOAA CPC returned HTTP ${res.status} for ${url}`);
    return await res.text();
  } finally {
    clearTimeout(timer);
  }
}

async function loadOutlook(): Promise<EnsoOutlook> {
  const [bulletin, pr, st, ol] = await Promise.all([
    fetchNoaaText(CPC_URLS.bulletin),
    fetchHtml(CPC_URLS.probabilities),
    fetchHtml(CPC_URLS.strengths),
    fetchHtml(CPC_URLS.outlook),
  ]);
  const issue = /NWS\s+(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})/.exec(bulletin);
  const monthIdx = issue ? MONTHS.indexOf(issue[2]!.toLowerCase()) : -1;
  if (!issue || monthIdx < 0) throw new Error("bulletin issue date not found");
  const issued = `${issue[3]}-${String(monthIdx + 1).padStart(2, "0")}-${issue[1]!.padStart(2, "0")}`;

  const bulletinMonth = `${issue[2]![0]!.toUpperCase()}${issue[2]!.slice(1).toLowerCase()} ${issue[3]}`;
  const months = [pageIssue(pr), pageIssue(st), pageIssue(ol)];
  if (months.some((m) => m !== bulletinMonth)) {
    throw new Error(`CPC tables (${months.join(", ")}) do not match the bulletin issued ${bulletinMonth}`);
  }

  const seasons = buildOutlookSeasons(
    parseCpcTable(pr, "probabilities-table"),
    parseCpcTable(st, "probabilities-table"),
    parseCpcTable(ol, "outlook-table"),
    issued,
  );
  if (seasons.length < 5) throw new Error("CPC outlook tables could not be parsed");
  return { seasons, issued, historicChances: parseHistoricChances(bulletin, issued), sourceUrl: CPC_URLS.probabilities };
}

export async function getEnsoOutlook(): Promise<EnsoOutlook | null> {
  try {
    // Failures throw out of the cached function, so they are never cached; success is kept for 3 h so a new
    // bulletin (2nd Thursday of the month) shows up the same day.
    return await cached("iofs:enso:outlook:v2", loadOutlook, { ttlMs: 3 * 60 * 60 * 1000 });
  } catch {
    return null;
  }
}
