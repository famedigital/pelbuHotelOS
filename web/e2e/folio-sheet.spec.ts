import { expect, test } from "@playwright/test";
import { deskLogin, hasDeskCredentials } from "./helpers";

const folio =
  "/erp/folios/b43d153a-9282-433d-baba-86bdffdbf6c6?stay=1&booking=6f73719f-677d-42e3-89d0-4cecc76db106&panel=stay_money";

test("excel-style folio sheet", async ({ page }) => {
  test.setTimeout(120_000);
  test.skip(!hasDeskCredentials(), "desk credentials missing");
  await deskLogin(page);
  await page.context().addCookies([
    {
      name: "hotelos_active_property",
      value: "d06e89f8-86e6-4201-bbd2-5e115d422357",
      url: "http://localhost:3000",
    },
  ]);
  const res = await page.goto(folio, { waitUntil: "domcontentloaded" });
  expect(res?.status() ?? 0).toBeLessThan(500);
  const header = page.locator("th", { hasText: "Running due" }).first();
  await expect(header).toBeVisible({ timeout: 45_000 });
  const tables = await page.locator("table").evaluateAll((els) =>
    els.map((el) => ({
      display: getComputedStyle(el).display,
      parent: el.parentElement?.tagName,
      hidden: (el as HTMLElement).offsetParent == null,
    })),
  );
  console.log("TABLES", JSON.stringify(tables));
  await expect(page.getByRole("button", { name: "Take payment" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Add a charge" })).toBeVisible();
  await expect(page.getByRole("button", { name: "More", exact: true })).toBeVisible();
  await expect(page.getByText("Mrs. Olwyn Jung").first()).toBeVisible();

  await page.getByRole("button", { name: "Take payment" }).click();
  await expect(page.getByRole("heading", { name: "Take payment" })).toBeVisible();

  await page.getByRole("button", { name: "Add a charge" }).click();
  await expect(page.getByRole("heading", { name: "Add a charge" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Take payment" })).toBeHidden();

  await page.getByRole("button", { name: "More", exact: true }).click();
  await expect(page.getByText("Round figure")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Add a charge" })).toBeHidden();

  const rowMenu = page.getByRole("button", { name: /^Edit / }).first();
  await rowMenu.click();
  await expect(page.getByRole("button", { name: /void/i }).first()).toBeVisible();
});
