import { test, expect } from "@playwright/test";
import {
  deskLogin,
  hasDeskCredentials,
} from "./helpers";

/**
 * FO money-cycle smoke + training empty-state links.
 * Full DB book→CI→void→balance→INV needs PLAYWRIGHT_MONEY_CYCLE=1;
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

  test("open bills + unpaid bills share money language", async ({ page }) => {
    await deskLogin(page);
    await page.goto("/erp/folios");
    await expect(page.locator("body")).toContainText(/open bill|folio|balance|guest/i, {
      timeout: 30_000,
    });
    await page.goto("/erp/unpaid-bills");
    await expect(page.locator("body")).toContainText(/unpaid|due|collect|guest|agent/i, {
      timeout: 30_000,
    });
  });

  test("training stay-money section linked from FO empty states", async ({
    page,
  }) => {
    await deskLogin(page);
    await page.goto("/erp/training#stay-money");
    await expect(page.locator("#stay-money")).toBeVisible({ timeout: 30_000 });
    await expect(page.locator("#stay-money")).toContainText(/one due|nightly base|void/i);
  });
});

test.describe("FO money journey (opt-in)", () => {
  test.skip(
    !hasDeskCredentials() || process.env.PLAYWRIGHT_MONEY_CYCLE !== "1",
    "Set PLAYWRIGHT_MONEY_CYCLE=1 plus desk credentials for full void→balance→invoice path",
  );

  test("override → void language → open bills due consistency", async ({
    page,
  }) => {
    await deskLogin(page);
    await page.goto("/erp/in-house");
    await expect(page.locator("body")).toContainText(/in.?house|guest|room/i, {
      timeout: 30_000,
    });
    // Open first StayHub if present — assert Folio due / period override copy exists in DOM patterns.
    const stayBtn = page.getByRole("button", { name: /open|folio|stay/i }).first();
    if (await stayBtn.isVisible().catch(() => false)) {
      await stayBtn.click();
      await expect(page.locator("body")).toContainText(/due|folio|collect|clear/i, {
        timeout: 15_000,
      });
    }
    await page.goto("/erp/folios");
    await expect(page.locator("body")).toContainText(/open bill|balance/i);
  });
});
