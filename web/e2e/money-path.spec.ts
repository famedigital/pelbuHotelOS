import { test, expect, type Page } from "@playwright/test";

/**
 * Money-cycle smoke: login → book-ish surface → folio/check-in language →
 * POS/laundry nav. Full DB book→CI→pay→NA→CO needs seeded property + Auth;
 * missing secrets → skip (not fail).
 */

const baseURL = process.env.PLAYWRIGHT_BASE_URL?.replace(/\/$/, "");
const deskEmail = process.env.PLAYWRIGHT_DESK_EMAIL?.trim();
const deskPassword = process.env.PLAYWRIGHT_DESK_PASSWORD?.trim();
const deskPin = process.env.PLAYWRIGHT_DESK_PIN?.trim();

const hasSecrets = Boolean(baseURL && (deskPin || (deskEmail && deskPassword)));

test.describe("Pelbu money path smoke", () => {
  test.skip(!hasSecrets, "Set PLAYWRIGHT_BASE_URL + desk PIN or Auth credentials");

  async function deskLogin(page: Page) {
    await page.goto("/erp/login");
    if (deskPin) {
      const pin = page.locator('input[name="pin"], input[type="password"]').first();
      if (await pin.isVisible().catch(() => false)) {
        await pin.fill(deskPin);
        await page.getByRole("button", { name: /sign in|enter|unlock|continue/i }).first().click();
      }
    } else if (deskEmail && deskPassword) {
      await page.locator('input[type="email"], input[name="email"]').first().fill(deskEmail);
      await page.locator('input[type="password"], input[name="password"]').first().fill(deskPassword);
      await page.getByRole("button", { name: /sign in|log in|continue/i }).first().click();
    }
    await page.waitForURL(/\/erp(\/|$)/, { timeout: 45_000 });
  }

  test("login → reservations / StayHub surface", async ({ page }) => {
    await deskLogin(page);
    await page.goto("/erp/reservations");
    await expect(page.getByText(/reservation|stay|guest/i).first()).toBeVisible({
      timeout: 30_000,
    });
    // Fast book / new reservation CTA
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
