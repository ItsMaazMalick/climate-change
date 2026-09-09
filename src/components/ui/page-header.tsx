import type { ReactNode } from "react";

/**
 * The header every step page opens with: a step kicker, a title, and one
 * plain sentence saying what the screen answers.
 */
export function PageHeader({
  kicker,
  step,
  title,
  children,
}: {
  kicker: string;
  step?: number;
  title: string;
  children?: ReactNode;
}) {
  return (
    <header className="mb-8 max-w-2xl">
      <p className="label mb-3 flex items-center gap-2">
        {step != null && (
          <span
            className="flex h-5 w-5 items-center justify-center rounded-(--radius-pill) bg-ink text-[11px] font-semibold text-ink-inverse tabular-nums"
            data-numeric
          >
            {step}
          </span>
        )}
        {kicker}
      </p>
      <h1 className="text-[clamp(1.6rem,3vw,2rem)] font-semibold leading-tight tracking-tight text-ink">
        {title}
      </h1>
      {children && (
        <p className="mt-2.5 text-sm leading-relaxed text-ink-muted">{children}</p>
      )}
    </header>
  );
}
