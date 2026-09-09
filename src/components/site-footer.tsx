"use client";

import { usePathname } from "next/navigation";
import Image from "next/image";
import Link from "next/link";

/**
 * Site footer.
 *
 * Carries the two things a public-facing data platform is obliged to make
 * findable: who published it, and what it was built from.
 */
export function SiteFooter() {
  const pathname = usePathname();

  // The explorer is a full-viewport application view with its own scrolling
  // panels; a footer below it would either be unreachable or would break the
  // three-column layout. It belongs on the document pages only.
  if (pathname === "/") return null;

  return (
    <footer className="mt-16 border-t border-[var(--color-border)] bg-[var(--color-surface)]">
      <div className="mx-auto grid max-w-[1800px] gap-8 px-5 py-9 md:grid-cols-[1.4fr_1fr_1fr]">
        <div>
          <Image
            src="/brand/earth-scan-systems.webp"
            alt="Earth Scan Systems"
            width={166}
            height={47}
            className="h-10 w-auto"
          />
          <p className="mt-1.5 max-w-sm text-[12.5px] leading-relaxed text-[var(--color-ink-muted)]">
            Data-driven decision support for farmers, industry and the
            stakeholders around them. Towards a carbon-neutral, sustainable
            planet.
          </p>
          <p className="mt-3 text-[11.5px] text-[var(--color-ink-faint)]">
            Craigieburn, Victoria 3064, Australia · DHA Phase V Sector G,
            Islamabad, Pakistan
          </p>
        </div>

        <div>
          <h2 className="label mb-2">This platform</h2>
          <ul className="space-y-1.5 text-[12.5px]">
            {([
              { href: "/", label: "Explorer" },
              { href: "/compare", label: "Compare" },
              { href: "/hotspots", label: "Hotspots" },
              { href: "/learn", label: "How to read a projection" },
              { href: "/methodology", label: "Methodology & limits" },
            ] as const).map(({ href, label }) => (
              <li key={href}>
                <Link
                  href={href}
                  className="text-[var(--color-ink-muted)] transition-colors hover:text-[var(--color-brand-deep)]"
                >
                  {label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h2 className="label mb-2">Data</h2>
          <p className="text-[12.5px] leading-relaxed text-[var(--color-ink-muted)]">
            CMIP6 bias-corrected downscaled projections at 0.25°, from the
            World Bank Climate Change Knowledge Portal. Administrative
            boundaries from geoBoundaries. Short-range weather from
            Open-Meteo.
          </p>
          <p className="mt-3 text-[11.5px] text-[var(--color-ink-faint)]">
            Projections are not forecasts. See{" "}
            <Link href="/methodology" className="underline">
              methodology
            </Link>{" "}
            for what these numbers can and cannot support.
          </p>
        </div>
      </div>

      <div className="border-t border-[var(--color-border)]">
        <div className="mx-auto flex max-w-[1800px] flex-wrap items-center gap-x-4 gap-y-1 px-5 py-3 text-[11.5px] text-[var(--color-ink-faint)]">
          <span>© {new Date().getFullYear()} Earth Scan Systems</span>
          <a
            href="https://escan-systems.com/"
            className="transition-colors hover:text-[var(--color-brand-deep)]"
          >
            escan-systems.com
          </a>
          <a
            href="mailto:contact@escan-systems.com"
            className="transition-colors hover:text-[var(--color-brand-deep)]"
          >
            contact@escan-systems.com
          </a>
        </div>
      </div>
    </footer>
  );
}
