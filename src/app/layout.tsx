import type { Metadata, Viewport } from "next";
import { CountryProvider } from "@/lib/country-context";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";

import "./globals.css";

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
    "Explore how the climate could change under CMIP6 emissions pathways across Pakistan and Uzbekistan — by location, indicator, model and time horizon.",
  keywords: [
    "Pakistan", "Uzbekistan", "climate change", "CMIP6", "SSP", "climate projection",
    "IPCC", "Indus", "Aral Sea", "heatwave", "monsoon", "climate adaptation",
  ],
  openGraph: {
    siteName: "Earth Scan Systems",
    title: "Climate Intelligence Explorer — Earth Scan Systems",
    description:
      "How climate could change across Pakistan and Uzbekistan, by location and emissions pathway.",
    type: "website",
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: "#8dc63e",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen antialiased">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-[var(--color-brand-deep)] focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-white"
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
