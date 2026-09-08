import type { NextConfig } from "next";

const config: NextConfig = {
  output: "standalone",
  reactStrictMode: true,
  poweredByHeader: false,
  // The grid documents are read from disk at request time; keep them out of
  // the bundle and out of the trace analysis.
  outputFileTracingIncludes: {
    "/api/climate/**": ["./data/grid/**", "./data/geo/**"],
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
    ];
  },
};

export default config;
