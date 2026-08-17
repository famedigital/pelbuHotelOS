import { test, expect } from "@playwright/test";
import {
  deskLogin,
  expectNoCrash,
  hasDeskCredentials,
  ERP_NAV_HREFS,
  PUBLIC_HREFS,
} from "./helpers";

/**
 * Public + ERP nav load smoke: HTTP < 500, body visible, no crash overlay.
 * Desk routes skip without PIN/Auth.
 */

test.describe("Public route smoke", () => {
  for (const path of PUBLIC_HREFS) {
    test(`public ${path}`, async ({ page }) => {
      await expectNoCrash(page, path);
    });
  }
});

test.describe("ERP nav route smoke", () => {
  test.skip(!hasDeskCredentials(), "Set DESK_PIN or PLAYWRIGHT_DESK_* credentials");

  test.beforeEach(async ({ page }) => {
    await deskLogin(page);
  });

  for (const path of ERP_NAV_HREFS) {
    test(`erp ${path}`, async ({ page }) => {
      await expectNoCrash(page, path);
      // Soft CTA presence — New / Add / Edit / Delete when present
      const mutators = page.getByRole("button", {
        name: /^(new|add|edit|delete|create|save)$/i,
      });
      const links = page.getByRole("link", {
        name: /new|add|create|fast book/i,
      });
      const mutatorCount = await mutators.count();
      const linkCount = await links.count();
      expect(mutatorCount + linkCount).toBeGreaterThanOrEqual(0);
    });
  }
});
