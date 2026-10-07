"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { IOFS_LANGUAGES, iofsLanguage } from "@/lib/iofs/languages";
import { useTranslation } from "./translation-context";

/**
 * A fixed, bottom-anchored language picker — the Google Translate widget
 * convention: current language as a pill in the corner, the full list
 * opening upward above it, one real country flag per language. Fixed
 * position rather than inline so it stays reachable while scrolling a page
 * this long.
 */
export function LanguageSwitcher() {
  const { lang, setLang } = useTranslation();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const current = iofsLanguage(lang) ?? IOFS_LANGUAGES[0]!;

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node))
        setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const others = IOFS_LANGUAGES.filter((l) => l.code !== lang);

  return (
    <div ref={rootRef} className="fixed bottom-0 right-4 z-[2000] w-44 text-sm">
      {open && (
        <div className="mb-1 max-h-72 overflow-y-auto bg-surface-panel shadow-(--elevation-overlay)">
          {others.map((l) => (
            <button
              key={l.code}
              type="button"
              onClick={() => {
                setLang(l.code);
                setOpen(false);
              }}
              className="flex w-full items-center gap-2.5 border-b border-border/60 px-3 py-2 text-left text-ink transition-colors last:border-b-0 hover:bg-surface-hover"
            >
              <span className="text-base leading-none" aria-hidden>
                {l.flag}
              </span>
              <span className="truncate">{l.nativeName}</span>
            </button>
          ))}
        </div>
      )}

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label="Change page language"
        className="flex w-full items-center gap-2.5 bg-surface-panel px-3 py-2 shadow-(--elevation-overlay) transition-colors hover:bg-surface-hover"
      >
        <span className="text-base leading-none" aria-hidden>
          {current.flag}
        </span>
        <span className="flex-1 truncate text-left text-ink">
          {current.nativeName}
        </span>
        {open ? (
          <ChevronUp className="h-4 w-4 shrink-0 text-ink-faint" />
        ) : (
          <ChevronDown className="h-4 w-4 shrink-0 text-ink-faint" />
        )}
      </button>
    </div>
  );
}
