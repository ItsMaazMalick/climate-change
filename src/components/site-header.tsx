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
    <header className="sticky top-0 z-40 border-b border-[var(--color-border)] bg-white/95 backdrop-blur-md shadow-xs">
      <div className="mx-auto flex h-14 max-w-[1800px] items-center justify-between gap-3 px-4 sm:gap-6 sm:px-6">
        {/* Brand */}
        <div className="flex items-center gap-4">
          <Link href="/" className="group flex items-center gap-2.5 transition-transform hover:scale-[1.01]" aria-label="Earth Scan Systems">
            <EssMark />
            <span className="flex items-baseline gap-2">
              <span className="text-[15px] tracking-tight">
                <span className="wordmark-earth">EARTH SCAN</span>{" "}
                <span className="wordmark-systems">SYSTEMS</span>
              </span>
              <span className="hidden rounded-full bg-[var(--color-brand-tint)] px-2 py-0.5 text-[11px] font-semibold text-[var(--color-brand-deep)] border border-[var(--color-border)] md:inline-flex items-center gap-1">
                <span>{config.flag}</span>
                <span>{config.shortName}</span>
              </span>
            </span>
          </Link>

          {/* Country Switcher Segment */}
          <div className="flex items-center rounded-lg border border-[var(--color-border-strong)] bg-slate-100/80 p-0.5 shadow-inner">
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
                      ? "bg-white font-bold text-[var(--color-ink)] shadow-xs ring-1 ring-slate-200"
                      : "text-[var(--color-ink-muted)] hover:text-[var(--color-ink)] hover:bg-white/50"
                  }`}
                  title={`Switch active country to ${c.name}`}
                >
                  <span className="text-sm leading-none">{c.flag}</span>
                  <span className="font-semibold">{c.shortName}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Navigation */}
        <nav className="hidden items-center gap-1 md:flex" aria-label="Primary">
          {NAV.map((item) => {
            const active = item.exact
              ? pathname === item.href
              : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`rounded-lg px-3 py-1.5 text-[13px] font-medium transition-all ${
                  active
                    ? "bg-[var(--color-brand-tint)] font-semibold text-[var(--color-brand-deep)] ring-1 ring-[var(--color-brand)]/20 shadow-xs"
                    : "text-[var(--color-ink-muted)] hover:bg-slate-100 hover:text-[var(--color-ink)]"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* Metadata / Live Status Pill */}
        <div className="flex items-center gap-2 text-[11.5px]">
          <div className="hidden items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-emerald-800 lg:flex font-medium">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500"></span>
            </span>
            <span>CMIP6 0.25° Downscaled</span>
          </div>
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
