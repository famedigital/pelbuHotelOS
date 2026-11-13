/**
 * StayView / Group StayHub smoke — multi-room Fast Book → Group shell →
 * party net control + Rooms tab. Money path remains FIT e2e authority.
 */
import { test, expect } from "@playwright/test";
import { unlockKarma } from "./helpers/unlock-staff";

const API = process.env.VITE_API_URL || "http://127.0.0.1:4200";

test.describe("StayView · Group StayHub smoke", () => {
  test("API health", async ({ request }) => {
    const res = await request.get(`${API}/health`);
    expect(res.ok()).toBeTruthy();
  });

  test("multi-room book opens Group StayHub with party net", async ({ page }) => {
    const guest = `Group E2E ${Date.now().toString(36)}`;
    await unlockKarma(page);

    await page.getByRole("button", { name: /Fast Book/i }).first().click();
    await expect(page.getByTestId("fast-book-guest-name")).toBeVisible();
    await page.getByTestId("fast-book-guest-name").fill(guest);

    const start = new Date();
    start.setUTCDate(start.getUTCDate() + 20 + Math.floor(Math.random() * 30));
    const end = new Date(start);
    end.setUTCDate(end.getUTCDate() + 2);
    const ymd = (d: Date) => d.toISOString().slice(0, 10);
    await page.getByLabel("Check-in").fill(ymd(start));
    await page.getByLabel("Check-out").fill(ymd(end));

    /* Bump Rooms stepper to 2. */
    await page.getByRole("button", { name: "Increase Rooms" }).click();

    await page.getByRole("button", { name: /Executive King/i }).first().click();
    await page.getByTestId("fast-book-submit").click();

    const bookToast = page
      .locator("[data-sonner-toast]")
      .filter({ hasText: /Booking confirmed|Hold reserved|API offline|cannot create/i })
      .first();
    await expect(bookToast).toBeVisible({ timeout: 45_000 });
    const toastText = (await bookToast.innerText()).replace(/\s+/g, " ");
    expect(toastText).toMatch(/Booking confirmed|Hold reserved/i);

    await expect(page.getByRole("dialog", { name: /Group StayHub|StayHub/i })).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByRole("dialog", { name: /Group StayHub/i })).toBeVisible({
      timeout: 15_000,
    });

    await expect(page.getByRole("button", { name: /Guests & Docs/i }).first()).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByTestId("stayhub-guests-docs")).toBeVisible({
      timeout: 15_000,
    });

    const guestRow = page.locator("[data-testid^=stayhub-guest-row-]").first();
    await expect(guestRow).toBeVisible();
    const stayIdAttr = await guestRow.getAttribute("data-testid");
    const stayId = stayIdAttr?.replace("stayhub-guest-row-", "") ?? "";
    expect(stayId.length).toBeGreaterThan(4);

    await page.getByTestId(`stayhub-guest-name-${stayId}`).fill(`${guest} Lead`);
    await page.getByTestId(`stayhub-guest-cid-${stayId}`).fill("P-BT-E2E-9001");
    await page.getByTestId(`stayhub-companion-name-${stayId}`).fill(`${guest} Plus`);
    await page.getByTestId(`stayhub-guest-save-${stayId}`).click();
    await expect(
      page.locator("[data-sonner-toast]").filter({ hasText: /Saved/i }),
    ).toBeVisible({ timeout: 20_000 });

    await page.getByRole("button", { name: /^Rooms/i }).first().click();
    await expect(page.getByTestId("stayhub-party-net")).toBeVisible({
      timeout: 15_000,
    });

    /* Uniform party rate stamps master-stream package authority after CI path. */
    const partyNet = page.getByTestId("stayhub-party-net");
    await partyNet.fill("5400");
    await page.getByTestId("stayhub-apply-party-net").click();
    await expect(
      page
        .locator("[data-sonner-toast]")
        .filter({ hasText: /Uniform Nu\.|uniform .*rooms/i })
        .first(),
    ).toBeVisible({ timeout: 20_000 });

    /* Folio tab sticks (no hydrate restomp). Guest Bill ≠ Agency bill. */
    await page.getByRole("button", { name: /^Folio$/i }).first().click();
    await expect(page.getByText(/Guest lines|Cash tendered|Show voided/i).first()).toBeVisible({
      timeout: 10_000,
    });
    await page.waitForTimeout(400);
    await expect(page.getByText(/Guest lines|Cash tendered|Show voided/i).first()).toBeVisible();

    await page.getByTestId("stayhub-guest-bill").click();
    await expect(page.getByRole("dialog", { name: /Fiscal paper/i })).toBeVisible({
      timeout: 10_000,
    });
    await expect(page.getByRole("dialog", { name: /Group agency bill/i })).toHaveCount(0);
    await page.keyboard.press("Escape");

    await page.getByRole("button", { name: /Agency bill/i }).first().click();
    await expect(page.getByRole("dialog", { name: /Group agency bill/i })).toBeVisible({
      timeout: 10_000,
    });
    await expect(page.getByText(/Amount payable \(in words\)/i)).toBeVisible();
    await page.keyboard.press("Escape");

    await page.goto("/stayview");
    await expect(page.getByRole("heading", { name: /StayView/i }).first()).toBeVisible({
      timeout: 20_000,
    });
    await expect(
      page
        .getByPlaceholder(/Guest, room, PS-/i)
        .or(page.getByRole("button", { name: /Search/i }))
        .first(),
    ).toBeAttached({ timeout: 15_000 });
  });
});
