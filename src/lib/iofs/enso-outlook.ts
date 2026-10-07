import { cached } from "@/lib/cache";

/**
 * The 9-season ENSO probability outlook, read from the IRI/CPC objective
 * forecast page — the same joint Columbia IRI / NOAA CPC product the
 * official plume chart is built from.
 *
 * There is no clean JSON or CSV for this forecast; CPC publishes it as a
 * plot and a paragraph of prose (e.g. "El Niño probabilities remain at 100%
 * from SON 2026 through FMA 2027, followed by 99% in MAM 2027 and 90% in
 * AMJ, before declining to 61% in MJJ 2027"). This module extracts
 * (season → probability) pairs from that real paragraph rather than
 * inventing numbers: if the page's wording changes enough that extraction
 * yields fewer than five seasons, `getEnsoOutlook` returns `null` and the UI
 * shows an honest "unavailable" state — it never substitutes a seeded
 * fallback dressed up as a live reading.
 */

const IRI_URL = "https://iri.columbia.edu/our-expertise/climate/forecasts/enso/current/";

const SEASON_ORDER = [
  "DJF", "JFM", "FMA", "MAM", "AMJ", "MJJ", "JJA", "JAS", "ASO", "SON", "OND", "NDJ",
] as const;

export interface EnsoOutlookSeason {
  season: string;
  /** El Niño probability, as published. Neutral/La Niña are only shown when the source states them. */
  elNino: number;
}

export interface EnsoOutlook {
  seasons: EnsoOutlookSeason[];
  issued: string | null;
  sourceUrl: string;
}

function seasonKey(abbr: string, year: number): string {
  return `${abbr} ${year}`;
}

function seasonIndex(abbr: string): number {
  return SEASON_ORDER.indexOf(abbr.toUpperCase() as (typeof SEASON_ORDER)[number]);
}

/** Every season from `fromKey` to `toKey` inclusive, stepping forward through the cycle. */
function expandRange(fromKey: string, toKey: string): string[] {
  const [fromAbbr, fromYearStr] = fromKey.split(" ");
  const [toAbbr, toYearStr] = toKey.split(" ");
  let i = seasonIndex(fromAbbr!);
  let year = Number(fromYearStr);
  const toI = seasonIndex(toAbbr!);
  const toYear = Number(toYearStr);
  if (i === -1 || toI === -1 || !Number.isFinite(year) || !Number.isFinite(toYear)) return [];

  const out: string[] = [];
  for (let guard = 0; guard < 24; guard += 1) {
    out.push(seasonKey(SEASON_ORDER[i]!, year));
    if (i === toI && year === toYear) break;
    i += 1;
    if (i >= SEASON_ORDER.length) {
      i = 0;
      year += 1;
    }
  }
  return out;
}

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&#8220;|&#8221;|&ldquo;|&rdquo;/g, '"')
    .replace(/&#8217;|&rsquo;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const SEASON_RE = /\b(DJF|JFM|FMA|MAM|AMJ|MJJ|JJA|JAS|ASO|SON|OND|NDJ)\s?(\d{4})\b/i;

function parseOutlookText(text: string): Map<string, number> {
  const found = new Map<string, number>();

  // Pattern A: "<P>% from <S1> through <S2>" — a whole inclusive range at one probability.
  const rangeRe = /(\d{1,3})%\s+from\s+([A-Za-z]{3}\s?\d{4})\s+through\s+([A-Za-z]{3}\s?\d{4})/gi;
  for (const m of text.matchAll(rangeRe)) {
    const pct = Number(m[1]);
    const from = m[2]!.toUpperCase().replace(/\s+/, " ");
    const to = m[3]!.toUpperCase().replace(/\s+/, " ");
    for (const key of expandRange(from, to)) found.set(key, pct);
  }

  // Pattern B: "<P>% in/during <SEASON>" — a single season.
  const singleRe = /(\d{1,3})%\s+(?:in|during)\s+([A-Za-z]{3}\s?\d{4}|[A-Za-z]{3})\b/gi;
  let lastYear: number | null = null;
  for (const key of found.keys()) {
    const y = Number(key.split(" ")[1]);
    if (Number.isFinite(y)) lastYear = Math.max(lastYear ?? 0, y);
  }
  for (const m of text.matchAll(singleRe)) {
    const pct = Number(m[1]);
    const token = m[2]!.toUpperCase().trim();
    const match = token.match(SEASON_RE);
    let key: string | null = null;
    if (match) {
      key = seasonKey(match[1]!, Number(match[2]));
    } else if (/^[A-Z]{3}$/.test(token) && lastYear !== null) {
      // Bare season abbreviation ("...and 90% in AMJ,") inherits the year context.
      key = seasonKey(token, lastYear);
    }
    if (key) found.set(key, pct);
  }

  return found;
}

async function loadIriText(): Promise<{ text: string; issued: string | null }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20_000);
  try {
    const res = await fetch(IRI_URL, {
      signal: controller.signal,
      headers: { "User-Agent": "climate-pakistan/1.0 (IOFS climate & ENSO panel)" },
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`IRI returned HTTP ${res.status}`);
    const html = await res.text();
    const text = stripHtml(html);
    const issuedMatch = text.match(
      /\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{4}\s+objective ENSO outlook/i,
    );
    return { text, issued: issuedMatch ? issuedMatch[0]!.replace(/\s+objective.*/i, "") : null };
  } finally {
    clearTimeout(timer);
  }
}

export async function getEnsoOutlook(): Promise<EnsoOutlook | null> {
  return cached(
    "iofs:enso:outlook:v1",
    async () => {
      try {
        const { text, issued } = await loadIriText();
        const pairs = parseOutlookText(text);
        if (pairs.size < 5) return null;

        const seasons = [...pairs.entries()]
          .map(([season, elNino]) => ({ season, elNino }))
          .sort((a, b) => {
            const [aAbbr, aYear] = a.season.split(" ");
            const [bAbbr, bYear] = b.season.split(" ");
            const ay = Number(aYear);
            const by = Number(bYear);
            if (ay !== by) return ay - by;
            return seasonIndex(aAbbr!) - seasonIndex(bAbbr!);
          })
          .slice(0, 9);

        return { seasons, issued, sourceUrl: IRI_URL };
      } catch {
        return null;
      }
    },
    { ttlMs: 12 * 60 * 60 * 1000 },
  );
}
