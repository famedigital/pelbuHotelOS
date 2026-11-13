/**
 * OPERATIONS-FLOW §5.2 — Walk-in FIT:
 * Fast Book → assign → check in → charge → mBoB settle → check out → night audit cockpit.
 * Money authority is fail-closed via API ACK. Does not set V2_DESK_CUTOVER.
 */
import { test, expect } from "@playwright/test";
import { unlockKarma } from "./helpers/unlock-staff";

const API = process.env.VITE_API_URL || "http://127.0.0.1:4200";
const PROPERTY_ID = "00000000-0000-4000-8000-000000000001";
const ACTOR = {
  staffId: "00000000-0000-4000-8000-0000000000aa",
  role: "gm",
  propertyId: PROPERTY_ID,
  tenantId: PROPERTY_ID,
};

test.describe("OPERATIONS-FLOW §5.2 FIT", () => {
  test("API health before desk money path", async ({ request }) => {
    const res = await request.get(`${API}/health`);
    expect(res.ok()).toBeTruthy();
    const body = (await res.json()) as { ok?: boolean };
    expect(body.ok).toBeTruthy();
  });

  test("cutover flag stays false", () => {
    expect(process.env.V2_DESK_CUTOVER ?? "false").not.toMatch(/^true$/i);
  });

  test("book → CI → laundry charge → mBoB → CO → audit cockpit", async ({
    page,
    request,
  }) => {
    const guest = `FIT E2E ${Date.now().toString(36)}`;

    await unlockKarma(page);

    await page.getByRole("button", { name: /Fast Book/i }).first().click();
    await expect(page.getByTestId("fast-book-guest-name")).toBeVisible();
    await page.getByTestId("fast-book-guest-name").fill(guest);

    /* Far-future dates avoid memory-store assignment clashes from prior e2e runs. */
    const start = new Date();
    start.setUTCDate(start.getUTCDate() + 14 + Math.floor(Math.random() * 40));
    const end = new Date(start);
    end.setUTCDate(end.getUTCDate() + 1);
    const ymd = (d: Date) => d.toISOString().slice(0, 10);
    await page.getByLabel("Check-in").fill(ymd(start));
    await page.getByLabel("Check-out").fill(ymd(end));

    /* DLX-K seed has no sellable rooms — pick EXE-K; leave unassigned then smart-pick. */
    await page.getByRole("button", { name: /Executive King/i }).first().click();

    await page.getByTestId("fast-book-submit").click();

    const bookToast = page
      .locator("[data-sonner-toast]")
      .filter({ hasText: /Booking confirmed|Hold reserved|API offline|cannot create/i })
      .first();
    await expect(bookToast).toBeVisible({ timeout: 45_000 });
    const toastText = (await bookToast.innerText()).replace(/\s+/g, " ");
    expect(toastText, `Fast Book toast: ${toastText}`).toMatch(
      /Booking confirmed|Hold reserved/i,
    );
    await expect(page.getByRole("dialog", { name: /Fast Book/i })).toBeHidden({
      timeout: 10_000,
    });

    /* Footer Assign opens Room tab; DOM click avoids StaySheet viewport clipping. */
    const assignCta = page.getByRole("button", { name: /^Assign room$/ });
    await expect(assignCta).toBeVisible({ timeout: 15_000 });
    await assignCta.evaluate((el: HTMLElement) => el.click());
    const best = page.getByRole("button", { name: /Best/i }).first();
    await expect(best).toBeVisible({ timeout: 15_000 });
    await best.evaluate((el: HTMLElement) => el.click());
    await expect(
      page.locator("[data-sonner-toast]").filter({ hasText: /Assigned · Rm/i }),
    ).toBeVisible({ timeout: 20_000 });
    await page.waitForTimeout(800);

    const checkInBtn = page.getByTestId("stayhub-check-in").first();
    await expect(checkInBtn).toBeEnabled({ timeout: 30_000 });
    await checkInBtn.evaluate((el: HTMLElement) => el.click());
    /* FIT document scan gate — capture passport/CID then check in. */
    const docPanel = page.getByTestId("stayhub-doc-capture");
    await expect(docPanel).toBeVisible({ timeout: 15_000 });
    const docId = `P-E2E-${Date.now().toString(36)}`;
    const docIdField = page.getByTestId("stayhub-doc-id");
    await docIdField.click();
    await docIdField.fill("");
    await docIdField.pressSequentially(docId, { delay: 15 });
    await page.getByTestId("stayhub-doc-nat").fill("International");
    await page.getByTestId("stayhub-doc-confirm").click({ force: true });
    await expect
      .poll(
        async () => {
          const hub = page.getByRole("dialog", { name: /StayHub/i });
          const toast = await page
            .locator("[data-sonner-toast]")
            .filter({ hasText: /Checked in/i })
            .count();
          const status = await hub.getByText(/checked in/i).count();
          const collect = await hub.getByRole("button", { name: /^Collect/i }).count();
          const checkOut = await hub
            .getByTestId("stayhub-check-out")
            .count();
          return toast + status + collect + checkOut;
        },
        { timeout: 60_000 },
      )
      .toBeGreaterThan(0);

    /* StayHub must stay open across live hydrate (selection remapped to API id). */
    await expect(
      page.getByRole("button", { name: /Collect|Check out/i }).first(),
    ).toBeVisible({ timeout: 15_000 });
    await page.getByRole("button", { name: /^Room$/ }).click({ force: true });
    await expect(page.getByTestId("stayhub-guest-bill-post")).toBeVisible({
      timeout: 15_000,
    });
    await page.getByRole("button", { name: /^Laundry$/ }).click({ force: true });
    await page.getByTestId("stayhub-guest-bill-desc").fill("Laundry");
    await page.getByTestId("stayhub-guest-bill-net").fill("450");
    await page.getByTestId("stayhub-guest-bill-post").click({ force: true });
    await expect(
      page.locator("[data-sonner-toast]").filter({ hasText: /Laundry.*personal/i }),
    ).toBeVisible({ timeout: 20_000 });
    await page.waitForTimeout(1_400);

    /* Guest due skim opens Folio/streams — more stable than tab remount races. */
    await page.getByRole("button", { name: /Guest due/i }).click({ force: true });
    await page.waitForTimeout(300);
    await page.getByTestId("stayhub-rma-qr").click({ force: true });
    await expect(page.getByTestId("stayhub-confirm-qr-paid")).toBeVisible({
      timeout: 15_000,
    });
    await page.getByTestId("stayhub-confirm-qr-paid").click({ force: true });
    await expect(
      page.locator("[data-sonner-toast]").filter({ hasText: /Settled/i }),
    ).toBeVisible({ timeout: 20_000 });
    await page.waitForTimeout(1_400);

    /* Keep settling until personal due is clear (package + laundry). */
    for (let i = 0; i < 4; i += 1) {
      const co = page.getByTestId("stayhub-check-out").first();
      if (await co.isEnabled().catch(() => false)) break;
      const rma = page.getByTestId("stayhub-rma-qr");
      if (await rma.isVisible().catch(() => false)) {
        await rma.click({ force: true });
        await page.getByTestId("stayhub-confirm-qr-paid").click({ force: true });
        await page.waitForTimeout(800);
      } else {
        await page.getByRole("button", { name: /Guest due/i }).click({ force: true });
        await page.waitForTimeout(300);
      }
    }

    const checkOutBtn = page.getByTestId("stayhub-check-out").first();
    await expect(checkOutBtn).toBeEnabled({ timeout: 20_000 });
    await checkOutBtn.click({ force: true });
    await expect(
      page.locator("[data-sonner-toast]").filter({ hasText: /Checked out/i }),
    ).toBeVisible({ timeout: 30_000 });

    await page.goto("/night-audit");
    await expect(page.getByTestId("night-audit-pin")).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByTestId("night-audit-run")).toBeVisible();

    /* Authority path: API night_audit.run posts room nights / advances date. */
    const audit = await request.post(`${API}/v1/command`, {
      data: {
        command: "night_audit.run",
        input: {
          propertyId: PROPERTY_ID,
          idempotencyKey: crypto.randomUUID(),
        },
        actor: ACTOR,
      },
    });
    expect(audit.ok()).toBeTruthy();
    const auditBody = (await audit.json()) as {
      ok: boolean;
      data?: { nextDate?: string; status?: string };
      error?: string;
    };
    expect(auditBody.ok).toBeTruthy();
  });
});
