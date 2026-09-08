import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans, JetBrains_Mono } from "next/font/google";
import { CountryProvider } from "@/lib/country-context";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";

import "./globals.css";

const sansFont = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
  weight: ["400", "500", "600", "700", "800"],
});

const monoFont = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: {
    default: "Climate Intelligence Explorer — Earth Scan Systems",
    template: "%s · Climate Intelligence · ESS",
  },
  applicationName: "Climate Explorer",
  authors: [{ name: "Earth Scan Systems", url: "https://escan-systems.com/" }],
  creator: "Earth Scan Systems",
  publisher: "Earth Scan Systems",
  description:
    "Explore how the climate could change under CMIP6 emissions pathways across Uzbekistan and Pakistan — by location, indicator, model and time horizon.",
  keywords: [
    "Uzbekistan", "Pakistan", "climate change", "CMIP6", "SSP", "climate projection",
    "IPCC", "Aral Sea", "Indus", "heatwave", "climate adaptation",
  ],
  openGraph: {
    siteName: "Earth Scan Systems",
    title: "Climate Intelligence Explorer — Earth Scan Systems",
    description:
      "How climate could change across Uzbekistan and Pakistan, by location and emissions pathway.",
    type: "website",
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: "#16a34a",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${sansFont.variable} ${monoFont.variable}`} suppressHydrationWarning>
      <body className="min-h-screen bg-slate-50 font-sans text-slate-900 antialiased selection:bg-emerald-500/20 selection:text-emerald-950">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-emerald-700 focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-white"
        >
          Skip to content
        </a>
        <CountryProvider>
          <SiteHeader />
          <main id="main">{children}</main>
          <SiteFooter />
        </CountryProvider>
      </body>
    </html>
  );
}
