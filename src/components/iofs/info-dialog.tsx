"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { Info, X } from "lucide-react";

import { GLOSSARY, type GlossaryEntry } from "@/lib/iofs/glossary";
import { T } from "./translation-context";

interface InfoDialogContextValue {
  open: (id: string, meaningOverride?: string) => void;
  close: () => void;
}

const InfoDialogContext = createContext<InfoDialogContextValue | null>(null);

/**
 * One shared dialog instance for the whole `/iofs` page — every `InfoButton`
 * just asks this provider to open its own glossary id, matching how the
 * sibling ESS dashboard keeps a single active info panel at a time rather
 * than letting every trigger own its own popover.
 */
export function InfoDialogProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<{ id: string; meaningOverride?: string } | null>(null);

  const open = useCallback((id: string, meaningOverride?: string) => {
    setState({ id, meaningOverride });
  }, []);
  const close = useCallback(() => setState(null), []);

  const entry = state ? GLOSSARY[state.id] : null;

  return (
    <InfoDialogContext.Provider value={{ open, close }}>
      {children}
      {entry && <InfoDialog entry={entry} meaningOverride={state?.meaningOverride} onClose={close} />}
    </InfoDialogContext.Provider>
  );
}

/** The small "ⓘ" trigger, dropped next to any term that deserves a plain-language explanation. */
export function InfoButton({
  id,
  meaningOverride,
  label,
  className = "",
}: {
  /** Key into `GLOSSARY`. */
  id: string;
  /** Replaces the entry's static `meaning` with a live-computed one (e.g. today's actual RONI reading). */
  meaningOverride?: string;
  label?: string;
  className?: string;
}) {
  const ctx = useContext(InfoDialogContext);
  if (!ctx || !GLOSSARY[id]) return null;

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        ctx.open(id, meaningOverride);
      }}
      aria-label={label ? `What does ${label} mean?` : "What does this mean?"}
      className={`inline-flex shrink-0 items-center justify-center rounded-(--radius-pill) p-0.5 text-ink-faint/70 transition-colors hover:bg-surface-hover hover:text-accent ${className}`}
    >
      <Info className="h-3.5 w-3.5" />
    </button>
  );
}

function InfoDialog({
  entry,
  meaningOverride,
  onClose,
}: {
  entry: GlossaryEntry;
  meaningOverride?: string;
  onClose: () => void;
}) {
  const titleId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);
  const meaning = meaningOverride ?? entry.meaning;

  // Mount-triggered rather than a CSS @keyframe: the dialog's whole lifetime
  // is owned by this component's own mount/unmount (the provider conditionally
  // renders it), so a plain two-phase opacity/scale flip on mount gives the
  // same "pop in" feel without needing new global keyframes just for this.
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const raf = requestAnimationFrame(() => setShown(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
    };
  }, [onClose]);

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4" role="presentation">
      <div
        aria-hidden
        className="absolute inset-0 bg-[#16211a]/45 backdrop-blur-sm transition-opacity duration-200"
        style={{ opacity: shown ? 1 : 0 }}
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="tier-overlay relative max-h-[80vh] w-full max-w-[420px] overflow-y-auto p-5 transition-[opacity,transform] duration-200 ease-out sm:p-6"
        style={{ opacity: shown ? 1 : 0, transform: shown ? "scale(1)" : "scale(0.96)" }}
      >
        <button
          ref={closeRef}
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute right-3.5 top-3.5 flex h-7 w-7 items-center justify-center rounded-(--radius-pill) text-ink-faint transition-colors hover:bg-surface-hover hover:text-ink"
        >
          <X className="h-4 w-4" />
        </button>

        <h2 id={titleId} className="pr-8 text-base font-bold tracking-tight text-ink">
          <T>{entry.title}</T>
        </h2>

        {entry.define && entry.define.length > 0 && (
          <div className="mt-3.5 space-y-2.5">
            {entry.define.map((d) => (
              <div key={d.term}>
                <div className="text-[10.5px] font-bold uppercase tracking-wide text-accent">
                  <T>{d.term}</T>
                </div>
                <p className="mt-0.5 text-[13px] leading-relaxed text-ink-muted">
                  <T>{d.text}</T>
                </p>
              </div>
            ))}
          </div>
        )}

        {meaning && (
          <InfoBlock label="What does this mean?" className={entry.define?.length ? "mt-3.5" : "mt-3"}>
            {meaning}
          </InfoBlock>
        )}

        {entry.implication && (
          <InfoBlock label="Agricultural implication" className="mt-3">
            {entry.implication}
          </InfoBlock>
        )}

        {entry.takeaway && (
          <div className="mt-3 rounded-(--radius-control) border border-accent/25 bg-accent-soft px-3.5 py-3">
            <div className="text-[10.5px] font-bold uppercase tracking-wide text-accent">
              <T>Takeaway</T>
            </div>
            <p className="mt-0.5 text-[13px] leading-relaxed text-ink">
              <T>{entry.takeaway}</T>
            </p>
          </div>
        )}

        {entry.source && (
          <p className="mt-3.5 border-t border-border pt-3 text-[11px] text-ink-faint">
            <T>Source</T>: {entry.source}
          </p>
        )}
      </div>
    </div>,
    document.body,
  );
}

function InfoBlock({ label, children, className = "" }: { label: string; children: string; className?: string }) {
  return (
    <div className={className}>
      <div className="text-[10.5px] font-bold uppercase tracking-wide text-ink-faint">
        <T>{label}</T>
      </div>
      <p className="mt-0.5 text-[13px] leading-relaxed text-ink-muted">
        <T>{children}</T>
      </p>
    </div>
  );
}

