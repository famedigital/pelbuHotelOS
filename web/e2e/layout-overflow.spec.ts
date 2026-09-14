import { test, expect } from "@playwright/test";
import {
  assertNoHorizontalOverflow,
  deskLogin,
  hasDeskCredentials,
  PUBLIC_HREFS,
} from "./helpers";

/**
 * Layout overflow at 375 and 1440 — no screenshot files written.
 * Flags document scrollWidth ≫ viewport (overlap/collision proxy).
 */

const VIEWPORTS = [
  { name: "mobile-375", width: 375, height: 812 },
  { name: "desktop-1440", width: 1440, height: 900 },
] as const;

const DESK_SHELL = [
  "/erp",
  "/erp/calendar",
  "/erp/reservations",
  "/erp/pos",
  "/erp/settings",
] as const;

for (const vp of VIEWPORTS) {
  test.describe(`Layout overflow ${vp.name}`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height } });

    for (const path of PUBLIC_HREFS.slice(0, 8)) {
      test(`public ${path}`, async ({ page }) => {
        await page.goto(path, { waitUntil: "domcontentloaded" });
        await expect(page.locator("body")).toBeVisible({ timeout: 30_000 });
        await assertNoHorizontalOverflow(page);
      });
    }

    test.describe("desk shell", () => {
      test.skip(
        !hasDeskCredentials(),
        "Set DESK_PIN or PLAYWRIGHT_DESK_* credentials",
      );

      test.beforeEach(async ({ page }) => {
        await deskLogin(page);
      });

      for (const path of DESK_SHELL) {
        test(`desk ${path}`, async ({ page }) => {
          await page.goto(path, { waitUntil: "domcontentloaded" });
          await expect(page.locator("body")).toBeVisible({ timeout: 30_000 });
          expect(page.url()).not.toMatch(/\/erp\/login/);
          await assertNoHorizontalOverflow(page);
        });
      }
    });
  });
}
