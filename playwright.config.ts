import { defineConfig, devices } from "@playwright/test";

/**
 * Smoke coverage for the demo. Walks the four-step path for every country and
 * asserts the invariants from docs/AUDIT.md hold in the rendered UI.
 */
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"]],
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000",
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: process.env.PLAYWRIGHT_BASE_URL
    ? undefined
    : {
        command: "pnpm build && pnpm start -p 3000",
        url: "http://localhost:3000",
        timeout: 180_000,
        reuseExistingServer: !process.env.CI,
      },
});
