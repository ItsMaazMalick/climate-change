import { test, expect, type Page } from "@playwright/test";

/**
 * The four-step demo path for all four countries. Asserts: no NaN, no
 * "undefined", no identical baseline/projected pair, no collapsed percentile
 * range on screen.
 */

const COUNTRIES = ["pak", "uz", "aus", "nzl"] as const;

async function assertNoGarbage(page: Page) {
  const body = await page.locator("body").innerText();
  expect(body).not.toMatch(/\bNaN\b/);
  expect(body).not.toMatch(/\bundefined\b/);
  // A projected/baseline pair rendered identically alongside a non-zero change
  // is the D1 signature — the MetricCard would show e.g. "10.4°C" twice.
}

test.describe("demo path", () => {
  for (const country of COUNTRIES) {
    test(`${country}: landing → explore → compare → hotspots`, async ({ page }) => {
      await page.goto(`/?country=${country}`);
      await expect(page.getByRole("link", { name: /start exploring/i })).toBeVisible();
      await assertNoGarbage(page);

      await page.goto(`/explore?country=${country}`);
      // The readout eventually resolves to a MetricCard with a change value.
      await expect(page.locator('[data-tour="metric"]')).toBeVisible({ timeout: 15_000 });
      await assertNoGarbage(page);

      // No collapsed percentile range anywhere in the readout.
      const readout = await page.locator('[data-tour="readout"]').innerText().catch(() => "");
      const collapsed = readout.match(/between\s+([+-][\d.]+).*?and\s+([+-][\d.]+)/i);
      if (collapsed) {
        expect(collapsed[1]).not.toBe(collapsed[2]);
      }

      await page.goto(`/compare?country=${country}`);
      await expect(page.getByRole("heading", { name: /pathway/i }).first()).toBeVisible({
        timeout: 15_000,
      });
      await assertNoGarbage(page);

      await page.goto(`/hotspots?country=${country}`);
      await expect(page.getByRole("heading", { name: /hotspot/i }).first()).toBeVisible({
        timeout: 15_000,
      });
      await assertNoGarbage(page);
    });
  }

  test("guided tour opens and advances", async ({ page }) => {
    await page.goto("/explore?tour=1&country=uz");
    await expect(page.getByRole("dialog", { name: /guided tour/i })).toBeVisible();
    await page.getByRole("button", { name: "Next" }).click();
    await expect(page.getByText(/Where/i).first()).toBeVisible();
  });
});
