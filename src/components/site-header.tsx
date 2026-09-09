"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { MoreHorizontal } from "lucide-react";

import { CountrySelect } from "@/components/nav/country-select";
import { ProgressRail } from "@/components/nav/progress-rail";
import { REFERENCE_LINKS } from "@/lib/climate/workflow";

export function SiteHeader() {
  const pathname = usePathname();
  const router = useRouter();

  const restartTour = () => {
    try {
      localStorage.removeItem("climate_tour_done");
    } catch {
      /* ignore */
    }
    const step = pathname.startsWith("/explore") ? "/explore" : "/explore";
    router.push(`${step}?tour=1`);
  };

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-surface-panel/95 shadow-[0_1px_0_rgba(255,255,255,0.6)_inset,0_1px_3px_hsl(220_48%_16%/0.06),0_16px_40px_-28px_hsl(220_48%_16%/0.4)]">
      <div className="mx-auto flex h-14 max-w-[1760px] items-center gap-4 px-4 sm:px-6">
        <Link href="/" className="flex shrink-0 items-center gap-3" aria-label="Earth Scan Systems — home">
          <Image
            src="/brand/earth-scan-systems.webp"
            alt="Earth Scan Systems"
            width={141}
            height={40}
            priority
            className="h-7 w-auto sm:h-8"
          />
        </Link>

        <CountrySelect />

        <div className="mx-auto rounded-(--radius-pill) border border-border bg-surface-recessed p-1 shadow-(--elevation-recessed)">
          <ProgressRail />
        </div>

        <nav aria-label="Reference" className="hidden items-center gap-1 md:flex">
          {REFERENCE_LINKS.map((item) => {
            const active = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`rounded-(--radius-control) px-2.5 py-1.5 text-xs font-medium transition-colors ${
 active ? "bg-surface-active text-ink" : "text-ink-faint hover:bg-surface-hover hover:text-ink"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <details className="group relative shrink-0">
          <summary
            className="flex h-8 w-8 cursor-pointer list-none items-center justify-center rounded-(--radius-control) text-ink-faint transition-colors hover:bg-surface-hover hover:text-ink [&::-webkit-details-marker]:hidden"
            aria-label="More"
          >
            <MoreHorizontal className="h-4 w-4" />
          </summary>
          <div className="tier-overlay absolute right-0 top-10 z-50 w-48 p-1 text-sm">
            <div className="md:hidden">
              {REFERENCE_LINKS.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="block rounded-(--radius-control) px-3 py-2 text-ink-muted hover:bg-surface-hover"
                >
                  {item.label}
                </Link>
              ))}
              <div className="my-1 h-px bg-border" />
            </div>
            <button
              type="button"
              onClick={restartTour}
              className="block w-full rounded-(--radius-control) px-3 py-2 text-left text-ink-muted hover:bg-surface-hover"
            >
              Restart guided tour
            </button>
          </div>
        </details>
      </div>
    </header>
  );
}
