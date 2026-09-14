import { test, expect } from "@playwright/test";
import {
  deskLogin,
  hasDeskCredentials,
} from "./helpers";

/**
 * Money-cycle smoke: login → book-ish surface → folio/check-in language →
 * POS/laundry nav. Full DB book→CI→pay→NA→CO needs PLAYWRIGHT_MONEY_CYCLE=1;
 * missing secrets → skip (not fail).
 */

test.describe("Pelbu money path smoke", () => {
  test.skip(
    !hasDeskCredentials(),
    "Set DESK_PIN or PLAYWRIGHT_DESK_* credentials",
  );

  test("login → reservations / StayHub surface", async ({ page }) => {
    await deskLogin(page);
    await page.goto("/erp/reservations");
    await expect(page.getByText(/reservation|stay|guest/i).first()).toBeVisible({
      timeout: 30_000,
    });
    const newCta = page.getByRole("link", { name: /new|fast book|reserve/i }).first();
    if (await newCta.isVisible().catch(() => false)) {
      await expect(newCta).toBeVisible();
    }
  });

  test("check-in board loads with day-1 / folio language", async ({ page }) => {
    await deskLogin(page);
    await page.goto("/erp/arrivals");
    await expect(page.locator("body")).toContainText(/arrival|check-?in|guest/i, {
      timeout: 30_000,
    });
    await page.goto("/erp/check-in");
    await expect(page.locator("body")).toContainText(/check-?in|room|guest|folio/i, {
      timeout: 30_000,
    });
  });

  test("night audit desk reachable", async ({ page }) => {
    await deskLogin(page);
    await page.goto("/erp/night-audit");
    await expect(page.locator("body")).toContainText(/night audit|close|business date/i, {
      timeout: 30_000,
    });
  });

  test("POS settle surface + laundry desk", async ({ page }) => {
    await deskLogin(page);
    await page.goto("/erp/pos");
    await expect(page.locator("body")).toContainText(/register|ticket|pos|kitchen/i, {
      timeout: 30_000,
    });
    await page.goto("/erp/laundry");
    await expect(page.locator("body")).toContainText(/laundry|bag|order|intake/i, {
      timeout: 30_000,
    });
  });

  test("folio city ledger opens", async ({ page }) => {
    await deskLogin(page);
    await page.goto("/erp/folios");
    await expect(page.locator("body")).toContainText(/folio|balance|guest|ledger/i, {
      timeout: 30_000,
    });
  });
});
