/**
 * Hotel email gate → staff PIN pad.
 * Seeds a local hotel session so Playwright reaches `/pin` without GoTrue.
 * Requires desk `VITE_ALLOW_LOCAL_DEMO_AUTH=1` when API has no DATABASE_URL.
 */
import { expect, type Page } from "@playwright/test";

const DEMO_PROPERTY = {
  id: "00000000-0000-4000-8000-000000000001",
  slug: "demo-hotel",
  name: "Demo Hotel",
} as const;

type UnlockOpts = {
  /** Post-PIN ready check (role home route differs). */
  ready: () => Promise<void>;
  /** Wait for live sync glow before money paths. */
  waitLiveSync?: boolean;
};

export async function unlockStaff(
  page: Page,
  staffId: "karma" | "ugyen" | "deki" | "tshering" | "tenzin",
  pin: string,
  opts: UnlockOpts,
): Promise<void> {
  await page.addInitScript((property) => {
    localStorage.setItem("hos_hotel_onboarded", "true");
    localStorage.setItem("hos_hotel_onboard_dismissed", "true");
    localStorage.setItem("hos_staff_tour_completed", "true");
    localStorage.setItem("hos.v2.propertyId", property.id);
    localStorage.setItem("hos.v2.propertySlug", property.slug);
    sessionStorage.setItem("hos.v2.hotel.token", "local-demo-hotel");
    sessionStorage.setItem("hos.v2.hotel.property", JSON.stringify(property));
  }, DEMO_PROPERTY);

  await page.goto("/pin");

  const wizardClose = page.getByRole("button", { name: "Close wizard" });
  if (await wizardClose.isVisible().catch(() => false)) {
    await wizardClose.click();
  }

  await expect(page.getByTestId(`pin-staff-${staffId}`)).toBeVisible({
    timeout: 30_000,
  });
  await page.getByTestId(`pin-staff-${staffId}`).click();
  /* selectedId change clears digits — wait before entry. */
  await page.waitForTimeout(200);
  /* Digit buttons are more reliable than window keydown under headed Chrome. */
  for (const d of pin) {
    await page.getByRole("button", { name: `Digit ${d}` }).click();
  }

  await opts.ready();

  await page
    .locator("[data-sonner-toast]")
    .filter({ hasText: /Welcome/i })
    .first()
    .waitFor({ state: "hidden", timeout: 8_000 })
    .catch(() => undefined);

  if (opts.waitLiveSync !== false) {
    /* Hydrate inventory before money path (apiOffline blocks createBooking). */
    await expect
      .poll(
        async () => page.getByTitle(/Live sync/i).getAttribute("data-glow"),
        { timeout: 20_000 },
      )
      .not.toBe("ruby");
    await page.waitForTimeout(1_200);
  }
}

export async function unlockKarma(page: Page): Promise<void> {
  await unlockStaff(page, "karma", "1234", {
    ready: async () => {
      await expect(page.getByRole("button", { name: /Fast Book/i }).first()).toBeVisible({
        timeout: 20_000,
      });
    },
  });
}

export async function unlockAuditor(page: Page): Promise<void> {
  await unlockStaff(page, "ugyen", "4567", {
    waitLiveSync: false,
    ready: async () => {
      await expect(page.getByTestId("night-audit-run")).toBeVisible({
        timeout: 25_000,
      });
    },
  });
}
