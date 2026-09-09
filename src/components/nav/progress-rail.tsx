"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { stepForPath, WORKFLOW } from "@/lib/climate/workflow";

/**
 * The four-step spine, rendered as a segmented pill with the current position
 * marked. Every primary screen is one of these four, in order.
 */
export function ProgressRail() {
  const pathname = usePathname();
  const current = stepForPath(pathname);

  return (
    <nav aria-label="Workflow steps" className="hidden items-center lg:flex">
      <ol className="flex items-center">
        {WORKFLOW.map((step) => {
          const active = current?.id === step.id;
          const done = current ? step.n < current.n : false;
          const href = step.id === "profile" ? "/places" : step.route;
          return (
            <li key={step.id}>
              <Link
                href={href}
                aria-current={active ? "step" : undefined}
                title={step.question}
                className={`flex items-center gap-1.5 rounded-(--radius-pill) px-2.5 py-1.5 text-xs font-medium transition-all motion-state ${
 active
                    ? "bg-ink text-ink-inverse shadow-[0_1px_2px_hsl(220_48%_16%/0.3),0_6px_14px_-4px_hsl(220_48%_16%/0.4)]"
                    : "text-ink-faint hover:text-ink"
                }`}
              >
                <span
                  className={`flex h-4.5 w-4.5 items-center justify-center rounded-(--radius-pill) text-[10px] font-semibold tabular-nums ${
 active
                      ? "bg-[rgb(var(--accent-glow))] text-white"
                      : done
                        ? "bg-ok/20 text-ok"
                        : "border border-border-strong text-ink-faint"
                  }`}
                  data-numeric
                >
                  {step.n}
                </span>
                <span>{step.label}</span>
              </Link>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
