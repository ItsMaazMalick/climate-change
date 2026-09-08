"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCountry } from "@/lib/country-context";
import { COUNTRIES, COUNTRY_CODES, CountryCode } from "@/lib/climate/countries";

const NAV = [
  { href: "/", label: "Explorer", exact: true },
  { href: "/compare", label: "Compare" },
  { href: "/hotspots", label: "Hotspots" },
  { href: "/places", label: "Places" },
  { href: "/learn", label: "Learn" },
  { href: "/methodology", label: "Methodology" },
];

export function SiteHeader() {
  const pathname = usePathname();
  const { country, config, setCountry } = useCountry();

  return (
    <header className="sticky top-0 z-40 border-b border-[var(--color-border)] bg-white/90 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-[1800px] items-center gap-4 px-4 sm:gap-6">
        <Link href="/" className="group flex items-center gap-2.5" aria-label="Earth Scan Systems">
          <EssMark />
          <span className="flex items-baseline gap-1.5">
            <span className="text-[15px] leading-none">
              <span className="wordmark-earth">EARTH SCAN</span>{" "}
              <span className="wordmark-systems">SYSTEMS</span>
            </span>
            <span
              className="hidden border-l border-[var(--color-border-strong)] pl-1.5 text-[13px] font-medium text-[var(--color-ink-muted)] sm:inline"
            >
              Climate {config.shortName}
            </span>
          </span>
        </Link>

        {/* Country Selector Switcher */}
        <div className="flex items-center">
          <div className="flex items-center rounded-lg border border-[var(--color-border-strong)] bg-[var(--color-surface)] p-0.5 shadow-xs">
            {COUNTRY_CODES.map((code) => {
              const c = COUNTRIES[code];
              const isSelected = country === code;
              return (
                <button
                  key={code}
                  type="button"
                  onClick={() => setCountry(code)}
                  aria-pressed={isSelected}
                  className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[12px] font-medium transition-all ${
                    isSelected
                      ? "bg-white font-semibold text-[var(--color-ink)] shadow-xs ring-1 ring-[var(--color-border)]"
                      : "text-[var(--color-ink-muted)] hover:text-[var(--color-ink)]"
                  }`}
                  title={`Switch view to ${c.name}`}
                >
                  <span className="text-sm leading-none">{c.flag}</span>
                  <span className="hidden sm:inline">{c.shortName}</span>
                </button>
              );
            })}
          </div>
        </div>

        <nav className="flex items-center gap-0.5" aria-label="Primary">
          {NAV.map((item) => {
            const active = item.exact
              ? pathname === item.href
              : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`rounded-md px-2.5 py-1.5 text-[13px] transition-colors ${
                  active
                    ? "bg-[var(--color-brand-tint)] font-semibold text-[var(--color-brand-deep)]"
                    : "text-[var(--color-ink-muted)] hover:bg-[var(--color-surface)] hover:text-[var(--color-ink)]"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto hidden items-center gap-2 text-[11px] text-[var(--color-ink-faint)] lg:flex">
          <span className="rounded border border-[var(--color-border)] bg-[var(--color-surface)] px-1.5 py-0.5 font-mono">
            CMIP6
          </span>
          <span>World Bank CCKP · 0.25°</span>
        </div>
      </div>
    </header>
  );
}

/**
 * The ESS mark, redrawn as inline SVG.
 *
 * The source logo is a 2,560 px raster with a photographic fill; at 22 px in
 * a header that is a 120 KB download to render a green circle. This keeps
 * the mark's three elements — the scanned globe, the orbit, the lens — in
 * the brand green and brown, at any size, for a few hundred bytes.
 */
function EssMark() {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      className="shrink-0"
    >
      <circle cx="11" cy="10.5" r="7" fill="var(--color-brand)" opacity="0.9" />
      <path
        d="M4.6 4.2c3.6-2 9.6-1.4 12.6 1.6"
        stroke="var(--color-brand)"
        strokeWidth="1.5"
        strokeLinecap="round"
        opacity="0.65"
      />
      <circle cx="17.6" cy="5.6" r="1.5" fill="var(--color-earth)" />
      <circle cx="14.2" cy="14.4" r="4.4" fill="none" stroke="var(--color-earth)" strokeWidth="1.7" />
      <path
        d="M17.6 17.8l3.1 3.1"
        stroke="var(--color-earth)"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}
