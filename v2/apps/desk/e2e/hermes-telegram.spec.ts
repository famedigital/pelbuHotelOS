/**
 * Hermes Wave 1 smoke — pair link + simulate OCR apply path via desk UI.
 */
import { test, expect } from "@playwright/test";
import { unlockKarma } from "./helpers/unlock-staff";

const API = process.env.VITE_API_URL || "http://127.0.0.1:4200";

test.describe("Hermes Telegram Wave 1", () => {
  test("API health exposes hermes commands", async ({ request }) => {
    const res = await request.get(`${API}/v1/commands`);
    expect(res.ok()).toBeTruthy();
    const body = (await res.json()) as { commands: string[] };
    expect(body.commands).toContain("hermes.overview");
    expect(body.commands).toContain("hermes.ocrDocument");
    expect(body.commands).toContain("hermes.createPairToken");
  });

  test("desk Hermes: pair link + simulate OCR", async ({ page }) => {
    await unlockKarma(page);
    await page.goto("/telegram");
    await expect(page.getByTestId("hermes-telegram-page")).toBeVisible({
      timeout: 20_000,
    });

    await page.getByTestId("hermes-tab-chats").click();
    await page.getByTestId("hermes-create-pair").click();
    await expect(page.getByTestId("hermes-pair-link")).toBeVisible({
      timeout: 15_000,
    });
    const link = await page.getByTestId("hermes-pair-link").innerText();
    expect(link).toMatch(/t\.me\/.+start=pair_/);

    await page.getByTestId("hermes-tab-overview").click();
    await page.getByTestId("hermes-simulate-ocr").click();
    await expect(
      page.locator("[data-sonner-toast]").filter({ hasText: /Simulated passport OCR/i }),
    ).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId("hermes-doc-inbox")).toBeVisible({
      timeout: 10_000,
    });
    await expect(page.locator("[data-testid^=hermes-draft-]").first()).toBeVisible({
      timeout: 10_000,
    });
  });
});
