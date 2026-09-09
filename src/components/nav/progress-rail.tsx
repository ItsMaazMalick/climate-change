"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { stepForPath, WORKFLOW } from "@/lib/climate/workflow";

/**
 * The four-step spine, rendered as a numbered rail with the current position
 * marked. Every primary screen is one of these four, in order.
 */
export function ProgressRail() {
  const pathname = usePathname();
  const current = stepForPath(pathname);

  return (
    <nav aria-label="Workflow steps" className="hidden items-center lg:flex">
      <ol className="flex items-center gap-1">
        {WORKFLOW.map((step, i) => {
          const active = current?.id === step.id;
          const done = current ? step.n < current.n : false;
          const href = step.id === "profile" ? "/places" : step.route;
          return (
            <li key={step.id} className="flex items-center">
              <Link
                href={href}
                aria-current={active ? "step" : undefined}
                title={step.question}
                className={`group flex items-center gap-2 rounded-(--radius-control) px-2.5 py-1.5 text-xs font-medium transition-colors ${
                  active
                    ? "bg-ink text-ink-inverse shadow-(--elevation-flat)"
                    : "text-ink-faint hover:bg-surface-hover hover:text-ink"
                }`}
              >
                <span
                  className={`flex h-5 w-5 items-center justify-center rounded-(--radius-pill) text-[11px] font-semibold tabular-nums ${
                    active
                      ? "bg-accent text-accent-ink"
                      : done
                        ? "bg-ok/15 text-ok"
                        : "border border-border-strong text-ink-faint"
                  }`}
                  data-numeric
                >
                  {step.n}
                </span>
                <span>{step.label}</span>
              </Link>
              {i < WORKFLOW.length - 1 && (
                <span aria-hidden className="mx-1 h-px w-4 bg-border-strong" />
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
