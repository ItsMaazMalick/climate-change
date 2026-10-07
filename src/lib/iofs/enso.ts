import { cached } from "@/lib/cache";

/**
 * Live ENSO (El Niño–Southern Oscillation) state, read directly from NOAA's
 * Climate Prediction Center.
 *
 * Three real, public, key-free text products, the same ones a forecaster
 * reads:
 *
 *  - RONI.ascii.txt   — the Relative Oceanic Niño Index, seasonal, 1950→present
 *  - sstoi.indices     — monthly Niño-region sea-surface temperatures
 *  - ensodisc.txt       — CPC's monthly written diagnostic discussion
 *
 * Nothing here is invented: the severity tier, the "is this a Super El Niño"
 * call and the historical episode ranking are all computed from the RONI
 * series itself, not hand-typed thresholds dressed up as data.
 */

const RONI_URL = "https://www.cpc.ncep.noaa.gov/data/indices/RONI.ascii.txt";
const NINO34_URL = "https://www.cpc.ncep.noaa.gov/data/indices/sstoi.indices";
const DISCUSSION_URL =
  "https://www.cpc.ncep.noaa.gov/products/analysis_monitoring/enso_advisory/ensodisc.txt";

const MONTH_NAMES = [
  "", "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
] as const;

const SEASON_MONTH: Record<string, number> = {
  DJF: 1, JFM: 2, FMA: 3, MAM: 4, AMJ: 5, MJJ: 6,
  JJA: 7, JAS: 8, ASO: 9, SON: 10, OND: 11, NDJ: 12,
};

export interface EnsoPoint {
  year: number;
  month: number;
  label: string;
  roni: number | null;
  nino34: number | null;
  nino34Sst: number | null;
}

export type EnsoPhase = "El Niño" | "La Niña" | "Neutral";

export interface EnsoTier {
  phase: EnsoPhase;
  /** Weak / Moderate / Strong / Super (El Niño only — RONI ≥ 2.0 by NOAA convention) / "" for neutral. */
  tier: string;
  label: string;
}

/** NOAA's own 0.5-wide bins, applied to whichever phase the sign indicates. */
export function classifyRoni(roni: number | null): EnsoTier {
  if (roni === null || !Number.isFinite(roni)) {
    return { phase: "Neutral", tier: "", label: "No reading" };
  }
  const phase: EnsoPhase = roni >= 0.5 ? "El Niño" : roni <= -0.5 ? "La Niña" : "Neutral";
  if (phase === "Neutral") return { phase, tier: "", label: "ENSO-neutral" };
  const mag = Math.abs(roni);
  const tier = mag >= 2.0 ? "Super" : mag >= 1.5 ? "Strong" : mag >= 1.0 ? "Moderate" : "Weak";
  return { phase, tier, label: `${tier} ${phase}` };
}

async function fetchNoaaText(url: string): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20_000);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": "climate-pakistan/1.0 (IOFS climate & ENSO panel)" },
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`NOAA CPC returned HTTP ${res.status} for ${url}`);
    // CPC serves these as Windows-1252/Latin-1, not UTF-8 — "Niño" is a single
    // 0xD1 byte, which `res.text()` (UTF-8) turns into a replacement
    // character. Decoding explicitly keeps the accent intact.
    const buffer = await res.arrayBuffer();
    return new TextDecoder("windows-1252").decode(buffer);
  } finally {
    clearTimeout(timer);
  }
}

function parseRoni(text: string): Array<{ year: number; month: number; roni: number | null }> {
  const out: Array<{ year: number; month: number; roni: number | null }> = [];
  for (const line of text.trim().split("\n")) {
    const parts = line.trim().split(/\s+/);
    if (parts.length < 3) continue;
    const month = SEASON_MONTH[parts[0]!.toUpperCase()];
    if (!month) continue;
    const year = Number(parts[1]);
    const raw = Number(parts[2]);
    if (!Number.isFinite(year)) continue;
    const roni = Number.isFinite(raw) && raw !== -99.9 && raw !== -999 ? raw : null;
    out.push({ year, month, roni });
  }
  return out;
}

function parseNino34(text: string): Map<string, { anom: number; sst: number }> {
  const map = new Map<string, { anom: number; sst: number }>();
  for (const line of text.trim().split("\n")) {
    const parts = line.trim().split(/\s+/);
    if (parts.length < 10 || !/^\d+$/.test(parts[0]!)) continue;
    const year = Number(parts[0]);
    const month = Number(parts[1]);
    const sst = Number(parts[8]);
    const anom = Number(parts[9]);
    if (![year, month, sst, anom].every(Number.isFinite)) continue;
    map.set(`${year}-${month}`, { anom, sst });
  }
  return map;
}

interface DiscussionInfo {
  issued: string | null;
  alertStatus: string | null;
  synopsis: string | null;
  sourceUrl: string;
}

function parseDiscussion(text: string): DiscussionInfo {
  const dateMatch = text.match(/\b\d{1,2}\s+(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{4}\b/);
  const alertMatch = text.match(/ENSO Alert System Status:\s*(.+)/);
  const synopsisMatch = text.match(/Synopsis:\s*([\s\S]*?)\n\s*\n/);
  return {
    issued: dateMatch?.[0]?.trim() ?? null,
    alertStatus: alertMatch?.[1]?.trim() ?? null,
    synopsis: synopsisMatch?.[1]?.replace(/\s+/g, " ").trim() ?? null,
    sourceUrl: DISCUSSION_URL,
  };
}

async function loadHistory(): Promise<EnsoPoint[]> {
  return cached(
    "iofs:enso:history",
    async () => {
      const [roniText, nino34Text] = await Promise.all([
        fetchNoaaText(RONI_URL),
        fetchNoaaText(NINO34_URL),
      ]);
      const roniRecords = parseRoni(roniText);
      const nino34Map = parseNino34(nino34Text);

      return roniRecords
        .map((r) => {
          const n34 = nino34Map.get(`${r.year}-${r.month}`);
          return {
            year: r.year,
            month: r.month,
            label: `${MONTH_NAMES[r.month]} ${r.year}`,
            roni: r.roni,
            nino34: n34?.anom ?? null,
            nino34Sst: n34?.sst ?? null,
          };
        })
        .sort((a, b) => a.year - b.year || a.month - b.month);
    },
    { ttlMs: 6 * 60 * 60 * 1000 }, // NOAA updates these monthly; refresh every 6h
  );
}

async function loadDiscussion(): Promise<DiscussionInfo> {
  return cached(
    "iofs:enso:discussion:v2",
    async () => {
      try {
        const text = await fetchNoaaText(DISCUSSION_URL);
        return parseDiscussion(text);
      } catch {
        return { issued: null, alertStatus: null, synopsis: null, sourceUrl: DISCUSSION_URL };
      }
    },
    { ttlMs: 6 * 60 * 60 * 1000 },
  );
}

export interface EnsoEpisode {
  key: string;
  label: string;
  startLabel: string;
  peakRoni: number;
  peakLabel: string;
  phase: EnsoPhase;
  tier: string;
}

/**
 * Group the real RONI series into discrete El Niño / La Niña episodes
 * (consecutive seasons past the ±0.5 threshold) and report each one's peak —
 * the same definition NOAA uses to say "1997–98 peaked at RONI 2.8". This is
 * computed from the fetched series, not a hand-typed historical table.
 */
export function deriveEpisodes(history: EnsoPoint[]): EnsoEpisode[] {
  const episodes: EnsoEpisode[] = [];
  let run: EnsoPoint[] = [];
  let runPhase: EnsoPhase | null = null;

  const flush = () => {
    if (run.length === 0 || !runPhase) return;
    const peak = run.reduce((best, p) => {
      const v = p.roni ?? 0;
      return Math.abs(v) > Math.abs(best.roni ?? 0) ? p : best;
    }, run[0]!);
    const startYear = run[0]!.year;
    const endYear = run[run.length - 1]!.year;
    const tier = classifyRoni(peak.roni).tier;
    episodes.push({
      key: `${startYear}-${endYear}`,
      label: startYear === endYear ? `${startYear}` : `${startYear}–${String(endYear).slice(2)}`,
      startLabel: run[0]!.label,
      peakRoni: Number((peak.roni ?? 0).toFixed(2)),
      peakLabel: peak.label,
      phase: runPhase,
      tier,
    });
    run = [];
    runPhase = null;
  };

  for (const point of history) {
    const phase: EnsoPhase | null =
      point.roni === null ? null : point.roni >= 0.5 ? "El Niño" : point.roni <= -0.5 ? "La Niña" : null;
    if (phase && phase === runPhase) {
      run.push(point);
    } else {
      flush();
      if (phase) {
        runPhase = phase;
        run = [point];
      }
    }
  }
  flush();

  return episodes;
}

export interface EnsoSnapshot {
  current: EnsoPoint | null;
  tier: EnsoTier;
  history: EnsoPoint[];
  episodes: EnsoEpisode[];
  elNinoEpisodes: EnsoEpisode[];
  discussion: DiscussionInfo;
  sources: { roni: string; nino34: string; discussion: string };
}

export async function getEnsoSnapshot(): Promise<EnsoSnapshot> {
  const [history, discussion] = await Promise.all([loadHistory(), loadDiscussion()]);
  const current = [...history].reverse().find((p) => p.roni !== null) ?? null;
  const tier = classifyRoni(current?.roni ?? null);
  const episodes = deriveEpisodes(history);
  const elNinoEpisodes = episodes
    .filter((e) => e.phase === "El Niño")
    .sort((a, b) => b.peakRoni - a.peakRoni);

  return {
    current,
    tier,
    history,
    episodes,
    elNinoEpisodes,
    discussion,
    sources: { roni: RONI_URL, nino34: NINO34_URL, discussion: DISCUSSION_URL },
  };
}
