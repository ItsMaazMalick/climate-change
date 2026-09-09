import { AlertTriangle, Inbox } from "lucide-react";
import type { ReactNode } from "react";

/**
 * Three consistent variants for the three things a data panel can be doing:
 * waiting for a choice, loading, or failing. The old build rendered blank grey
 * rectangles during load, which reads as broken.
 */

export function EmptyState({
  title,
  children,
  icon,
}: {
  title: string;
  children?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div className="tier-flat flex flex-col items-center gap-2 px-6 py-10 text-center">
      <span className="text-ink-faint">{icon ?? <Inbox className="h-5 w-5" />}</span>
      <p className="text-sm font-medium text-ink">{title}</p>
      {children && <p className="max-w-xs text-xs leading-relaxed text-ink-faint">{children}</p>}
    </div>
  );
}

export function ErrorState({
  title = "Couldn't load this panel",
  detail,
}: {
  title?: string;
  detail?: string;
}) {
  return (
    <div className="tier-flat flex flex-col items-center gap-2 border-danger/30 px-6 py-8 text-center">
      <AlertTriangle className="h-5 w-5 text-danger" />
      <p className="text-sm font-medium text-ink">{title}</p>
      {detail && <p className="max-w-xs text-xs leading-relaxed text-ink-faint">{detail}</p>}
    </div>
  );
}

export function SkeletonLoader({
  lines = 3,
  className = "",
}: {
  lines?: number;
  className?: string;
}) {
  return (
    <div className={`space-y-2 ${className}`} aria-hidden>
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          className="h-3 animate-pulse rounded-(--radius-control) bg-surface-active"
          style={{ width: `${90 - i * 12}%` }}
        />
      ))}
    </div>
  );
}

export function SkeletonBlock({ height = 96 }: { height?: number }) {
  return (
    <div
      className="animate-pulse rounded-(--radius-container) bg-surface-active"
      style={{ height }}
      aria-hidden
    />
  );
}
