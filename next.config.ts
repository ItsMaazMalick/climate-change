import type { NextConfig } from "next";

const config: NextConfig = {
  output: process.env.DOCKER_BUILD === "1" ? "standalone" : undefined,
  reactStrictMode: true,
  poweredByHeader: false,

  /*
   * Ship the climate data with the serverless functions.
   *
   * `src/lib/climate/grid.ts` reads the grid documents and the admin cell
   * index from `path.join(process.cwd(), "data", ...)`. That path is built at
   * runtime, so Next's tracer cannot see it and would not bundle `data/` into
   * the lambdas — which is why the map renders from a local `next start` (the
   * files sit at the working directory) but comes up empty on Vercel, where
   * the function has no `data/` at all. Every read is defensive and returns a
   * fallback, so the failure is silent: the API answers 422 and the map draws
   * nothing rather than erroring.
   *
   * The raw geoBoundaries dumps under data/geo are build inputs only, so the
   * glob deliberately takes just the cell sidecars.
   */
  outputFileTracingIncludes: {
    "/api/climate/**": ["./data/grid/**", "./data/geo/*-cells.json"],
    "/api/health": ["./data/grid/**", "./data/geo/*-cells.json"],
    "/api/meta": ["./data/grid/**", "./data/geo/*-cells.json"],
  },

  experimental: {
    optimizePackageImports: ["d3-array", "d3-scale", "d3-shape"],
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
        ],
      },
      {
        source: "/geo/:path*",
        headers: [
          { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
        ],
      },
      /*
       * The /iofs dashboard is meant to be embedded as an iframe on partner
       * sites (escan-systems.com). The site-wide `X-Frame-Options:
       * SAMEORIGIN` above blocks that for every route by default; this adds
       * a `frame-ancestors` CSP for just this one path, which every modern
       * browser treats as taking precedence over X-Frame-Options when both
       * are present (and Next.js header overriding applies per header key,
       * not per rule, so the SAMEORIGIN value above is untouched for every
       * other route). Add more partner origins to the list as needed.
       */
      {
        source: "/iofs",
        headers: [
          {
            key: "Content-Security-Policy",
            value: "frame-ancestors 'self' https://escan-systems.com https://*.escan-systems.com;",
          },
        ],
      },
    ];
  },
};

export default config;
