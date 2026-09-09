"use client";

import Image from "next/image";
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
  // { href: "/user-guide", label: "User Guide" },
  { href: "/methodology", label: "Methodology" },
];

export function SiteHeader() {
  const pathname = usePathname();
  const { country, config, setCountry } = useCountry();

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200/90 bg-white/90 backdrop-blur-xl shadow-xs">
      <div className="mx-auto flex h-14 max-w-[1800px] items-center justify-between gap-3 px-4 sm:gap-6 sm:px-6">
        {/* Brand & Orbit Mark */}
        <div className="flex items-center gap-4">
          <Link
            href="/"
            className="group flex items-center gap-3 transition-transform hover:scale-[1.02]"
            aria-label="Earth Scan Systems — home"
          >
            {/*
              The official mark. `priority` because it sits above the fold and
              is the largest element painted in the header, so it is the LCP
              candidate on every page.
            */}
            <Image
              src="/brand/earth-scan-systems.webp"
              alt="Earth Scan Systems"
              width={141}
              height={40}
              priority
              className="h-8 w-auto sm:h-10"
            />
            <span className="hidden rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-[11px] font-bold text-emerald-700 shadow-xs md:inline-flex items-center gap-1.5">
              <span>{config.flag}</span>
              <span>{config.shortName}</span>
            </span>
          </Link>

          {/* Clean Country Segment Switcher */}
          <div className="flex items-center rounded-xl border border-slate-200 bg-slate-100 p-1 shadow-inner">
            {COUNTRY_CODES.map((code) => {
              const c = COUNTRIES[code];
              const isSelected = country === code;
              return (
                <button
                  key={code}
                  type="button"
                  onClick={() => setCountry(code)}
                  aria-pressed={isSelected}
                  className={`flex items-center gap-1.5 rounded-lg px-3 py-1 text-[12px] font-bold transition-all cursor-pointer ${isSelected
                    ? "bg-white text-emerald-700 shadow-sm border border-slate-200/80 ring-1 ring-emerald-500/20"
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/60"
                    }`}
                  title={`Switch active country to ${c.name}`}
                >
                  <span className="text-sm leading-none">{c.flag}</span>
                  <span className="font-bold">{c.shortName}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Navigation Tabs */}
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
                className={`rounded-lg px-3 py-1.5 text-[13px] font-bold transition-all ${active
                  ? "bg-emerald-50 text-emerald-800 border border-emerald-200 shadow-xs"
                  : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                  }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* Live Satellite Status */}
        <div className="flex items-center gap-2 text-[11.5px]">
          <div className="hidden items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50/80 px-3 py-1 text-emerald-800 lg:flex font-mono text-[11px] font-bold shadow-xs">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-75"></span>
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-600"></span>
            </span>
            <span>CMIP6 0.25° TELEMETRY</span>
          </div>
        </div>
      </div>
    </header>
  );
}
