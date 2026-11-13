/**
 * Hermes Telegram console smoke — pair wizard + simulate OCR + new commands.
 */
import { test, expect } from "@playwright/test";
import { unlockKarma } from "./helpers/unlock-staff";

const API = process.env.VITE_API_URL || "http://127.0.0.1:4200";

test.describe("Hermes Telegram console", () => {
  test("API health exposes hermes console commands", async ({ request }) => {
    const res = await request.get(`${API}/v1/commands`);
    expect(res.ok()).toBeTruthy();
    const body = (await res.json()) as { commands: string[] };
    expect(body.commands).toContain("hermes.overview");
    expect(body.commands).toContain("hermes.ocrDocument");
    expect(body.commands).toContain("hermes.createPairToken");
    expect(body.commands).toContain("hermes.listEvents");
    expect(body.commands).toContain("hermes.getAlerts");
    expect(body.commands).toContain("hermes.notifyFolio");
  });

  test("desk Hermes: pair wizard + simulate OCR", async ({ page }) => {
    await unlockKarma(page);
    await page.goto("/telegram");
    await expect(page.getByTestId("hermes-telegram-page")).toBeVisible({
      timeout: 20_000,
    });

    // Auto-open or manual Pair…
    const wizard = page.getByTestId("hermes-pair-wizard");
    if (!(await wizard.isVisible().catch(() => false))) {
      await page.getByTestId("hermes-open-pair").click();
    }
    await expect(wizard).toBeVisible({ timeout: 10_000 });
    await page.getByTestId("hermes-pair-role-fo").click();
    await page.getByTestId("hermes-pair-mint").click();
    await expect(page.getByTestId("hermes-pair-link")).toBeVisible({
      timeout: 15_000,
    });
    const link = await page.getByTestId("hermes-pair-link").innerText();
    expect(link).toMatch(/t\.me\/.+start=pair_/);
    await page.getByRole("button", { name: "Close" }).click();

    await page.getByTestId("hermes-nav-overview").click();
    await page.getByTestId("hermes-simulate-ocr").click();
    await expect(
      page.locator("[data-sonner-toast]").filter({ hasText: /Simulated passport OCR/i }),
    ).toBeVisible({ timeout: 20_000 });

    await page.getByTestId("hermes-nav-docs").click();
    await expect(page.getByTestId("hermes-doc-inbox")).toBeVisible({
      timeout: 10_000,
    });
    await expect(page.locator("[data-testid^=hermes-draft-]").first()).toBeVisible({
      timeout: 10_000,
    });
  });
});
