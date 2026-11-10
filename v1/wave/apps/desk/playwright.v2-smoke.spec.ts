/**
 * Optional Playwright FO smoke — run when desk+api are up:
 *   pnpm --dir apps/desk exec playwright test playwright.v2-smoke.spec.ts
 *
 * Cutover gate companion to docs/v2/CUTOVER.md (does not flip V2_DESK_CUTOVER).
 */
import { test, expect } from "@playwright/test";

const DESK = process.env.V2_DESK_URL || "http://127.0.0.1:5173";
const API = process.env.HOTEL_OS_API_URL || "http://127.0.0.1:4100";

test.describe("v2-smoke", () => {
  test("API health", async ({ request }) => {
    const res = await request.get(`${API}/health`);
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.ok).toBeTruthy();
  });

  test("PIN gateway renders", async ({ page }) => {
    await page.goto(DESK);
    await expect(page.locator("body")).toContainText(/PIN|staff|Hotel OS/i);
  });
});
