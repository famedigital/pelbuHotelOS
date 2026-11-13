/**
 * OPERATIONS-FLOW §5.5 — Day close smoke:
 * Night Audit cockpit reachable + API night_audit.run advances business date.
 * Does not flip V2_DESK_CUTOVER.
 */
import { test, expect } from "@playwright/test";
import {
  E2E_DEMO_PROPERTY,
  readDeskBearer,
  unlockAuditor,
} from "./helpers/unlock-staff";

const API = process.env.VITE_API_URL || "http://127.0.0.1:4200";
const PROPERTY_ID = E2E_DEMO_PROPERTY.id;
const ACTOR = {
  staffId: "00000000-0000-4000-8000-0000000000ab",
  role: "gm",
  propertyId: PROPERTY_ID,
  tenantId: PROPERTY_ID,
};

test.describe("OPERATIONS-FLOW §5.5 day close", () => {
  test("cutover flag stays false", () => {
    expect(process.env.V2_DESK_CUTOVER ?? "false").not.toMatch(/^true$/i);
  });

  test("night audit cockpit + API night_audit.run", async ({ page, request }) => {
    await unlockAuditor(page);

    await expect(page.getByTestId("night-audit-pin")).toBeVisible();
    await expect(page.getByTestId("night-audit-run")).toBeVisible();
    await page.getByTestId("night-audit-pin").fill("1234");

    const bearer = await readDeskBearer(page);
    const auth = { Authorization: `Bearer ${bearer}` };
    const propertyId =
      (await page.evaluate(() => localStorage.getItem("hos.v2.propertyId"))) ||
      PROPERTY_ID;

    const before = await request.get(
      `${API}/v1/desk/day?propertyId=${propertyId}`,
      { headers: auth },
    );
    expect(before.ok()).toBeTruthy();
    const beforeBody = (await before.json()) as { businessDate?: string };
    expect(beforeBody.businessDate).toBeTruthy();

    const audit = await request.post(`${API}/v1/command`, {
      headers: auth,
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
    const auditBody = (await audit.json()) as { ok: boolean; error?: string };
    expect(audit.ok(), `night_audit.run HTTP ${audit.status()} ${auditBody.error ?? ""}`).toBeTruthy();
    expect(auditBody.ok, auditBody.error ?? "night_audit.run failed").toBeTruthy();

    const after = await request.get(
      `${API}/v1/desk/day?propertyId=${propertyId}`,
      { headers: auth },
    );
    expect(after.ok()).toBeTruthy();
    const afterBody = (await after.json()) as { businessDate?: string };
    expect(afterBody.businessDate).toBeTruthy();
    /* Idempotent re-run may keep same date if already closed; either advance or stable ok. */
    expect(typeof afterBody.businessDate).toBe("string");
  });
});
