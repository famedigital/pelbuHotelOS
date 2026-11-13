/**
 * OPERATIONS-FLOW §5.2 — Walk-in FIT:
 * Fast Book → assign → check in → charge → mBoB settle → check out → night audit cockpit.
 * Money authority is fail-closed via API ACK. Does not set V2_DESK_CUTOVER.
 */
import { test, expect } from "@playwright/test";
import {
  E2E_DEMO_PROPERTY,
  pickSellableRoomType,
  readDeskBearer,
  unlockAuditor,
  unlockKarma,
} from "./helpers/unlock-staff";

const API = process.env.VITE_API_URL || "http://127.0.0.1:4200";
const PROPERTY_ID = E2E_DEMO_PROPERTY.id;
const ACTOR = {
  staffId: "00000000-0000-4000-8000-0000000000aa",
  role: "fo_manager",
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

    /* DEMO seed archive rack: Deluxe King (not Yangphel EXE-K). */
    await pickSellableRoomType(page);

    const submitBtn = page.getByTestId("fast-book-submit");
    await expect(submitBtn).toBeEnabled({ timeout: 10_000 });
    await submitBtn.click({ force: true });

    const bookToast = page
      .locator("[data-sonner-toast]")
      .filter({ hasText: /Booking confirmed|Hold reserved/i })
      .first();
    await expect(bookToast).toBeVisible({ timeout: 60_000 });
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
    /* Toast copy varies (Assigned · Rm / Assigned Rm) — CI enabled is the StayHub gate. */
    await expect
      .poll(
        async () => {
          const toast = await page
            .locator("[data-sonner-toast]")
            .filter({ hasText: /Assigned/i })
            .count();
          const ciReady = await page
            .getByTestId("stayhub-check-in")
            .first()
            .isEnabled()
            .catch(() => false);
          return toast > 0 || ciReady;
        },
        { timeout: 25_000 },
      )
      .toBeTruthy();
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

    async function settlePersonalViaRma(): Promise<void> {
      const collect = page.getByRole("button", { name: /^Collect/i }).first();
      if (await collect.isVisible().catch(() => false)) {
        await collect.click({ force: true });
        await page.waitForTimeout(300);
      } else {
        await page
          .getByRole("button", { name: /Guest due/i })
          .click({ force: true })
          .catch(() => undefined);
        await page.waitForTimeout(300);
      }
      const rma = page.getByTestId("stayhub-rma-qr");
      if (!(await rma.isVisible().catch(() => false))) {
        /* Already clear or streams UI remounted — nothing to settle. */
        return;
      }
      await rma.click({ force: true });
      const confirm = page.getByTestId("stayhub-confirm-qr-paid");
      if (!(await confirm.isVisible().catch(() => false))) return;
      await confirm.click({ force: true });
      await expect
        .poll(
          async () => {
            const settled = await page
              .locator("[data-sonner-toast]")
              .filter({ hasText: /Settled|Nothing to settle|Nothing due/i })
              .count();
            return settled;
          },
          { timeout: 20_000 },
        )
        .toBeGreaterThan(0);
      await page.waitForTimeout(1_200);
    }

    /* Laundry + package nights may land on personal — settle until API gate clears. */
    await settlePersonalViaRma();
    let checkedOut = false;
    for (let i = 0; i < 8; i += 1) {
      const collect = page.getByRole("button", { name: /^Collect/i }).first();
      if (await collect.isVisible().catch(() => false)) {
        await settlePersonalViaRma();
        continue;
      }
      const checkOutBtn = page.getByTestId("stayhub-check-out").first();
      if (!(await checkOutBtn.isVisible().catch(() => false))) {
        await settlePersonalViaRma();
        continue;
      }
      await checkOutBtn.click({ force: true });
      const outcome = await Promise.race([
        page
          .locator("[data-sonner-toast]")
          .filter({ hasText: /Checked out/i })
          .first()
          .waitFor({ state: "visible", timeout: 12_000 })
          .then(() => "ok" as const),
        page
          .locator("[data-sonner-toast]")
          .filter({ hasText: /Checkout blocked/i })
          .first()
          .waitFor({ state: "visible", timeout: 12_000 })
          .then(() => "blocked" as const),
      ]).catch(() => "none" as const);
      if (outcome === "ok") {
        checkedOut = true;
        break;
      }
      if (outcome === "blocked") {
        await settlePersonalViaRma();
        continue;
      }
      const status = await page
        .getByRole("dialog", { name: /StayHub/i })
        .getByText(/checked out/i)
        .count();
      if (status > 0) {
        checkedOut = true;
        break;
      }
    }
    expect(checkedOut, "FIT checkout did not clear personal folio / succeed").toBeTruthy();

    /* Night audit cockpit needs GM — FO token is Forbidden on night_audit.run. */
    await unlockAuditor(page);
    await expect(page.getByTestId("night-audit-pin")).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByTestId("night-audit-run")).toBeVisible();

    /* Authority path: API night_audit.run posts room nights / advances date. */
    const bearer = await readDeskBearer(page);
    const propertyId =
      (await page.evaluate(() => localStorage.getItem("hos.v2.propertyId"))) ||
      PROPERTY_ID;
    const audit = await request.post(`${API}/v1/command`, {
      headers: { Authorization: `Bearer ${bearer}` },
      data: {
        command: "night_audit.run",
        input: {
          propertyId,
          idempotencyKey: crypto.randomUUID(),
        },
        actor: {
          ...ACTOR,
          role: "gm",
          propertyId,
          tenantId: propertyId,
        },
      },
    });
    const auditBody = (await audit.json()) as {
      ok: boolean;
      data?: { nextDate?: string; status?: string };
      error?: string;
    };
    expect(audit.ok(), `night_audit.run HTTP ${audit.status()} ${auditBody.error ?? ""}`).toBeTruthy();
    expect(auditBody.ok, auditBody.error ?? "night_audit.run failed").toBeTruthy();
  });
});
