"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { iofsLanguage } from "@/lib/iofs/languages";

interface TranslationContextValue {
  lang: string;
  setLang: (code: string) => void;
  /** Translate one string. Calls made within the same short window are coalesced into one batched request; results are cached for the session. */
  translate: (text: string) => Promise<string>;
}

const TranslationContext = createContext<TranslationContextValue | null>(null);

const STORAGE_KEY = "iofs_language";

// A language switch fires one `translate()` call per `<T>`/`useTranslatedText`
// on the page at once — 150+ of them. Sending each as its own HTTP request
// used to blow straight through the API's per-minute rate limit; everything
// past that point silently fell back to English (see `flushLang` below). Both
// numbers mirror the server's own batching: `BATCH_MAX_SIZE` matches
// `bodySchema`'s `texts` cap in `app/api/iofs/translate/route.ts`, and the
// window is long enough to catch every `<T>` mounted in the same commit
// (React flushes all of a commit's passive effects synchronously, well
// inside one macrotask) without feeling like a delay to the reader.
const BATCH_WINDOW_MS = 50;
const BATCH_MAX_SIZE = 60;

// Static UI copy is pre-translated offline by `scripts/warm-iofs-
// translations.ts` into `lib/iofs/translations/<lang>.json` — one dictionary
// per language, code-split so only the active language's bundle is ever
// downloaded. Checking it first means the overwhelming majority of `<T>`
// calls resolve from a value already sitting in the loaded JS, with no
// network round trip and no exposure to the live endpoint's rate limiting at
// all. Only text the warm script didn't know about (right now: the live NOAA
// forecast synopsis) falls through to the batched live path below, which is
// why that path still needs to exist and stay rate-limit-safe on its own.
const dictionaryCache = new Map<string, Record<string, string>>();
const dictionaryLoading = new Map<string, Promise<Record<string, string>>>();

function loadDictionary(lang: string): Promise<Record<string, string>> {
  const cached = dictionaryCache.get(lang);
  if (cached) return Promise.resolve(cached);
  const loading = dictionaryLoading.get(lang);
  if (loading) return loading;

  const promise = import(`../../lib/iofs/translations/${lang}.json`)
    .then((mod) => {
      const dict = (mod as { default?: Record<string, string> }).default ?? (mod as Record<string, string>);
      dictionaryCache.set(lang, dict);
      return dict;
    })
    .catch(() => ({}) as Record<string, string>) // not warmed yet for this language — the live path covers it
    .finally(() => {
      dictionaryLoading.delete(lang);
    });
  dictionaryLoading.set(lang, promise);
  return promise;
}

/**
 * One page-wide language choice, shared by every `<T>` so switching
 * languages re-translates the whole page rather than one component at a
 * time. Persisted to localStorage so a returning reader keeps their choice.
 */
export function TranslationProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState("en");
  const cache = useRef(new Map<string, string>());
  // Pending requests, grouped by the language they were requested in — keyed
  // this way (rather than read from a ref at flush time) so a language
  // switch mid-batch can never hand a request queued for one language to a
  // fetch targeting another.
  const pendingByLang = useRef(new Map<string, Map<string, Array<(text: string) => void>>>());
  const batchTimers = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  const flushLang = useCallback(async (targetLang: string) => {
    batchTimers.current.delete(targetLang);
    const bucket = pendingByLang.current.get(targetLang);
    if (!bucket) return;
    pendingByLang.current.delete(targetLang);

    const entries = [...bucket.entries()];
    for (let i = 0; i < entries.length; i += BATCH_MAX_SIZE) {
      const chunk = entries.slice(i, i + BATCH_MAX_SIZE);
      const texts = chunk.map(([text]) => text);
      try {
        const res = await fetch("/api/iofs/translate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ texts, target: targetLang }),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const payload: { data?: { translations?: string[] } } = await res.json();
        const translations = payload.data?.translations ?? texts;
        chunk.forEach(([text, resolvers], idx) => {
          const translated = translations[idx] ?? text;
          cache.current.set(`${targetLang}:${text}`, translated);
          resolvers.forEach((resolve) => resolve(translated));
        });
      } catch {
        chunk.forEach(([text, resolvers]) => resolvers.forEach((resolve) => resolve(text)));
      }
    }
  }, []);

  // Hydrate from localStorage only after mount, deliberately — the server
  // has no localStorage, so the initial render must start at the same "en"
  // on both sides, then correct itself client-side once storage is
  // reachable. Doing this via a lazy useState initializer instead would
  // read "en" on the server and the saved language on the client's very
  // first render, which is exactly the server/client mismatch React's
  // hydration warns about. (Same pattern, same trade-off, as the sibling
  // `CountryProvider` in `lib/country-context.tsx`.)
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved && (saved === "en" || iofsLanguage(saved))) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setLangState(saved);
      }
    } catch {
      /* ignore */
    }
  }, []);

  const setLang = useCallback((code: string) => {
    setLangState(code);
    try {
      localStorage.setItem(STORAGE_KEY, code);
    } catch {
      /* ignore */
    }
  }, []);

  const translate = useCallback(
    (text: string): Promise<string> => {
      if (lang === "en" || !text.trim()) return Promise.resolve(text);
      const key = `${lang}:${text}`;
      const hit = cache.current.get(key);
      if (hit !== undefined) return Promise.resolve(hit);

      return loadDictionary(lang).then((dict) => {
        const fromBundle = dict[text];
        if (fromBundle) {
          cache.current.set(key, fromBundle);
          return fromBundle;
        }

        // Not pre-warmed — queue it on the live, rate-limit-safe path.
        return new Promise<string>((resolve) => {
          let bucket = pendingByLang.current.get(lang);
          if (!bucket) {
            bucket = new Map();
            pendingByLang.current.set(lang, bucket);
          }
          const resolvers = bucket.get(text);
          if (resolvers) resolvers.push(resolve);
          else bucket.set(text, [resolve]);

          if (!batchTimers.current.has(lang)) {
            batchTimers.current.set(
              lang,
              setTimeout(() => flushLang(lang), BATCH_WINDOW_MS),
            );
          }
        });
      });
    },
    [lang, flushLang],
  );

  const value = useMemo(() => ({ lang, setLang, translate }), [lang, setLang, translate]);

  return <TranslationContext.Provider value={value}>{children}</TranslationContext.Provider>;
}

export function useTranslation(): TranslationContextValue {
  const ctx = useContext(TranslationContext);
  if (!ctx) throw new Error("useTranslation() must be used inside a TranslationProvider.");
  return ctx;
}

/**
 * Renders `children` (plain English UI copy) directly, and swaps in the
 * live-translated text once it resolves for the page's current language.
 * Falls back to the English source instantly and silently on any failure.
 */
export function T({ children }: { children: string }) {
  const { lang, translate } = useTranslation();
  const key = `${lang}:${children}`;
  const [resolved, setResolved] = useState<{ key: string; text: string } | null>(null);

  useEffect(() => {
    if (lang === "en") return;
    let cancelled = false;
    translate(children).then((text) => {
      if (!cancelled) setResolved({ key, text });
    });
    return () => {
      cancelled = true;
    };
  }, [key, lang, children, translate]);

  const display = lang === "en" || resolved?.key !== key ? children : resolved.text;
  return <>{display}</>;
}

/**
 * The string-returning counterpart to `<T>`, for the places a translated
 * value has to be a plain string rather than renderable children — an
 * `aria-label`, a `title` attribute, or a prop on a shared component that
 * only accepts `string` (e.g. `PageHeader`'s `title`).
 */
export function useTranslatedText(text: string): string {
  const { lang, translate } = useTranslation();
  const key = `${lang}:${text}`;
  const [resolved, setResolved] = useState<{ key: string; text: string } | null>(null);

  useEffect(() => {
    if (lang === "en") return;
    let cancelled = false;
    translate(text).then((translated) => {
      if (!cancelled) setResolved({ key, text: translated });
    });
    return () => {
      cancelled = true;
    };
  }, [key, lang, text, translate]);

  return lang === "en" || resolved?.key !== key ? text : resolved.text;
}
