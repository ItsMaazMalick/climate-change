import { cached } from "@/lib/cache";

/**
 * Machine translation for the IOFS page's UI copy and glossary text, into
 * any of the 15 real languages spoken across the 43 member states.
 *
 * Backed by Google Translate's public `translate_a/single` endpoint — the
 * same one the "Google Translate" browser extension and many open-source
 * translation libraries call. It needs no API key, which matters here: a
 * paid provider (Cloud Translation API, DeepL, Azure Translator) would be
 * more "official", but would also mean the feature simply doesn't work
 * without a key this deployment doesn't have. It was chosen over the
 * free, documented MyMemory API after a direct quality check — MyMemory
 * returned garbled, unusable output for Tajik, while this endpoint
 * produced a clean, correct translation for every language this page
 * actually needs, including the less common ones (Pashto, Tajik, Kazakh).
 *
 * Every translation is cached (so the same string in the same language is
 * never fetched twice) and capped at modest concurrency, out of courtesy
 * to an endpoint that isn't a contracted service.
 */

const ENDPOINT = "https://translate.googleapis.com/translate_a/single";

// This endpoint has no published quota — it's the same free one the
// "Google Translate" browser extension uses, with whatever informal
// anti-abuse throttling that implies. Firing requests at it concurrently
// (this page needs 100+ distinct strings translated on a cold language
// switch) was enough to trip a temporary block, after which every request —
// even spaced out, even serial — kept drawing HTTP 429 for well over a
// minute. Two defenses, calibrated against that observed behaviour:
//
// 1. Dispatch is fully serial (one in-flight request at a time) with a
//    minimum gap between requests, so a normal page load doesn't present as
//    a burst in the first place.
// 2. A circuit breaker: the first 429 opens it for `COOLDOWN_MS`, during
//    which every call short-circuits straight to the English fallback
//    instead of making a doomed live request. That stops a queue of 100+
//    pending translations from re-triggering (and likely extending) the
//    same block the instant the circuit were to retry — it costs this
//    reader a fully-English page for the length of the cooldown, not a
//    minute of hung requests. The next call after the cooldown elapses
//    tries for real and closes the breaker again on success.
const MIN_GAP_MS = 350;
const COOLDOWN_MS = 60_000;

let lastDispatchAt = 0;
let blockedUntil = 0;
let dispatchQueue: Promise<void> = Promise.resolve();

interface GoogleTranslateResponse {
  0?: Array<[string, string, ...unknown[]]>;
}

/** Runs `fn` after waiting for its turn and for `MIN_GAP_MS` since the last dispatch, serially across all callers. */
function scheduled<T>(fn: () => Promise<T>): Promise<T> {
  const turn = dispatchQueue.then(async () => {
    const wait = lastDispatchAt + MIN_GAP_MS - Date.now();
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    lastDispatchAt = Date.now();
  });
  dispatchQueue = turn;
  return turn.then(fn);
}

async function translateOne(text: string, target: string): Promise<string> {
  if (!text.trim()) return text;

  return cached(
    `iofs:translate:${target}:${text}`,
    () =>
      scheduled(async () => {
        if (Date.now() < blockedUntil) {
          throw new Error("Translate endpoint still cooling down after a rate limit.");
        }
        const url = `${ENDPOINT}?client=gtx&sl=en&tl=${encodeURIComponent(target)}&dt=t&q=${encodeURIComponent(text)}`;
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 10_000);
        try {
          const res = await fetch(url, {
            signal: controller.signal,
            headers: { "User-Agent": "Mozilla/5.0 (compatible; climate-pakistan/1.0)" },
            cache: "no-store",
          });
          if (res.status === 429) {
            blockedUntil = Date.now() + COOLDOWN_MS;
            throw new Error("Translate endpoint returned HTTP 429.");
          }
          if (!res.ok) throw new Error(`Translate endpoint returned HTTP ${res.status}`);
          const json = (await res.json()) as GoogleTranslateResponse;
          const segments = json[0] ?? [];
          const translated = segments.map((seg) => seg[0]).join("");
          return translated || text;
        } finally {
          clearTimeout(timer);
        }
      }),
    { ttlMs: 180 * 24 * 60 * 60 * 1000 }, // translations of static copy never go stale
  );
}

export async function translateBatch(texts: string[], target: string): Promise<string[]> {
  if (target === "en") return texts;
  // Serial by construction (`scheduled` above), so this just preserves
  // input order rather than adding its own concurrency.
  const out: string[] = [];
  for (const text of texts) {
    try {
      out.push(await translateOne(text, target));
    } catch {
      out.push(text); // fall back to the source text rather than fail the whole batch
    }
  }
  return out;
}
