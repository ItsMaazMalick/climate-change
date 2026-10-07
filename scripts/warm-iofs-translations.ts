/**
 * Pre-translate every static string the `/iofs` page needs into each of its
 * 15 supported languages, writing one `src/lib/iofs/translations/<lang>.json`
 * dictionary per language (`{ englishText: translatedText }`).
 *
 * `translation-context.tsx` loads that dictionary (one dynamic `import()`,
 * code-split per language) the instant a reader switches languages and
 * reads from it synchronously — no network call, no exposure to the live
 * translate endpoint's rate limiting, for anything this script covered.
 * Only text this script doesn't know about (right now: the live NOAA
 * forecast synopsis, which changes with real data rather than being part of
 * the UI) still goes through the on-demand path at `/api/iofs/translate`,
 * which keeps its own pacing and circuit breaker for exactly that reason.
 *
 * Run this after adding new static copy to the page, or after adding a
 * language to `lib/iofs/languages.ts`. It's safe to re-run any time —
 * `translateBatch` is cached, so only genuinely new strings make a live call.
 *
 *   pnpm iofs:warm-translations
 */

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { IOFS_LANGUAGES } from "../src/lib/iofs/languages";
import { IOFS_MEMBERS } from "../src/lib/iofs/members";
import { GLOSSARY } from "../src/lib/iofs/glossary";
import { STATIC_STRINGS } from "../src/lib/iofs/translation-strings";
import { translateBatch } from "../src/lib/iofs/translate";

const OUT_DIR = path.join(__dirname, "../src/lib/iofs/translations");

function glossaryStrings(): string[] {
  const out = new Set<string>();
  for (const entry of Object.values(GLOSSARY)) {
    out.add(entry.title);
    for (const d of entry.define ?? []) {
      out.add(d.term);
      out.add(d.text);
    }
    if (entry.meaning) out.add(entry.meaning);
    if (entry.implication) out.add(entry.implication);
    if (entry.takeaway) out.add(entry.takeaway);
    // `entry.source` is deliberately excluded — citations stay in English,
    // same as everywhere else on this page.
  }
  return [...out];
}

function allStrings(): string[] {
  const out = new Set<string>(STATIC_STRINGS);
  for (const s of glossaryStrings()) out.add(s);
  for (const m of IOFS_MEMBERS) out.add(m.name);
  return [...out].filter((s) => s.trim().length > 0);
}

/**
 * Merges newly-resolved translations into whatever `<lang>.json` already has
 * on disk, rather than overwriting it outright — so a run that only partly
 * gets through (the live endpoint going down mid-warm, say) can't regress
 * entries an earlier, fully-successful run already wrote.
 *
 * A translation identical to its English source is deliberately NOT
 * written: that's what `translateOne`'s catch-all fallback returns on
 * failure (a 429, a timeout, an endpoint outage), and it is
 * indistinguishable here from a genuinely-identical loanword. Leaving the
 * key out of the dictionary in either case is the safe choice — the page's
 * live-translation fallback will pick it up for a real reader, whereas
 * baking in a false "translation" that's just the English text would look
 * identical to this page but silently never get retried again.
 */
async function warmLanguage(lang: string, texts: string[]): Promise<{ resolved: number; failed: number }> {
  const file = path.join(OUT_DIR, `${lang}.json`);
  let dict: Record<string, string> = {};
  try {
    dict = JSON.parse(await readFile(file, "utf8"));
  } catch {
    /* no existing file yet */
  }

  const translations = await translateBatch(texts, lang);
  let resolved = 0;
  let failed = 0;
  texts.forEach((text, i) => {
    const translated = translations[i];
    if (translated && translated !== text) {
      dict[text] = translated;
      resolved += 1;
    } else if (!dict[text]) {
      failed += 1;
    }
  });

  await mkdir(OUT_DIR, { recursive: true });
  await writeFile(file, JSON.stringify(dict, null, 2) + "\n", "utf8");
  return { resolved, failed };
}

async function main() {
  const texts = allStrings();
  console.log(`Warming ${texts.length} strings × ${IOFS_LANGUAGES.length} languages …`);
  console.log("This calls the same rate-limited free endpoint the live page uses, so it");
  console.log("runs one language at a time and can take several minutes — that's expected.\n");

  let done = 0;
  const withFailures: string[] = [];
  for (const { code, name } of IOFS_LANGUAGES) {
    if (code === "en") {
      done += 1;
      continue;
    }
    const startedAt = Date.now();
    const { resolved, failed } = await warmLanguage(code, texts);
    done += 1;
    const secs = ((Date.now() - startedAt) / 1000).toFixed(1);
    console.log(
      `  ${done}/${IOFS_LANGUAGES.length}  ${code} (${name}) — ${secs}s — ${resolved} resolved, ${failed} still missing`,
    );
    if (failed > 0) withFailures.push(code);
  }

  if (withFailures.length === 0) {
    console.log("\nDone — every string resolved. Commit the updated src/lib/iofs/translations/*.json files.");
  } else {
    console.log(
      `\n${withFailures.length}/${IOFS_LANGUAGES.length - 1} language(s) still have unresolved strings ` +
        `(${withFailures.join(", ")}) — the live translate endpoint was rate-limited for at least part of this run.`,
    );
    console.log(
      "Re-running `pnpm iofs:warm-translations` later only re-fetches what's still missing (results are merged onto " +
        "disk, not overwritten), so it's safe to retry once the endpoint has had time to recover.",
    );
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
