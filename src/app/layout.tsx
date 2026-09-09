import type { Metadata, Viewport } from "next";
import { Suspense } from "react";
import { DM_Sans, JetBrains_Mono } from "next/font/google";
import { CountryProvider } from "@/lib/country-context";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { GuidedTour } from "@/components/tour/guided-tour";
import { PresenterMode } from "@/components/present/presenter-mode";

import "./globals.css";

const sansFont = DM_Sans({
  subsets: ["latin"],
  variable: "--font-ui-next",
  display: "swap",
  weight: ["400", "500", "700"],
});

const monoFont = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono-next",
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
      <body className="min-h-screen">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-(--radius-control) focus:bg-accent focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-white"
        >
          Skip to content
        </a>
        <CountryProvider>
          <SiteHeader />
          <main id="main">{children}</main>
          <SiteFooter />
          <Suspense fallback={null}>
            <GuidedTour />
            <PresenterMode />
          </Suspense>
        </CountryProvider>
      </body>
    </html>
  );
}
