import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

// Next.js 16 ships `eslint-config-next` as flat config arrays, so they are
// spread directly. Bridging them through FlatCompat — which was necessary in
// 15 — now double-loads the plugins and fails on a circular reference.
const config = [
  {
    ignores: [
      ".next/**",
      "node_modules/**",
      "src/generated/**",
      "pipeline/**",
      "data/**",
      "public/**",
    ],
  },
  ...nextCoreWebVitals,
  ...nextTypescript,
  {
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
    },
  },
];

export default config;
