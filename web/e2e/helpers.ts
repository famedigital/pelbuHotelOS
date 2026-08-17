import { expect, type Page } from "@playwright/test";

/**
 * Shared desk e2e helpers. Secrets optional — missing → callers skip.
 * Falls back: PLAYWRIGHT_DESK_PIN → DESK_PIN; BASE_URL → NEXT_PUBLIC_SITE_URL → localhost.
 */

export function playwrightBaseURL(): string {
  return (
    process.env.PLAYWRIGHT_BASE_URL?.replace(/\/$/, "") ||
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ||
    "http://127.0.0.1:3000"
  );
}

export function deskPin(): string | undefined {
  return (
    process.env.PLAYWRIGHT_DESK_PIN?.trim() ||
    process.env.DESK_PIN?.trim() ||
    undefined
  );
}

export function deskEmail(): string | undefined {
  return process.env.PLAYWRIGHT_DESK_EMAIL?.trim() || undefined;
}

export function deskPassword(): string | undefined {
  return process.env.PLAYWRIGHT_DESK_PASSWORD?.trim() || undefined;
}

/** True when we can attempt desk login (PIN or email+password). */
export function hasDeskCredentials(): boolean {
  const pin = deskPin();
  const email = deskEmail();
  const password = deskPassword();
  return Boolean(pin || (email && password));
}

/** Full money mutation cycle (creates real booking) — opt-in only. */
export function moneyCycleEnabled(): boolean {
  return process.env.PLAYWRIGHT_MONEY_CYCLE === "1" && hasDeskCredentials();
}

export async function deskLogin(page: Page): Promise<void> {
  const pin = deskPin();
  const email = deskEmail();
  const password = deskPassword();
  const base = playwrightBaseURL();

  // Prefer cookie injection — avoids login rate-limit after failed PIN attempts
  if (pin) {
    await page.context().addCookies([
      {
        name: "pelbu_desk_session",
        value: `ok:${pin}`,
        url: base,
        httpOnly: true,
        sameSite: "Lax",
      },
    ]);
    await page.goto("/erp", { waitUntil: "domcontentloaded" });
    if (!page.url().includes("/erp/login")) {
      return;
    }
  }

  await page.goto("/erp/login", { waitUntil: "domcontentloaded" });

  // Already authenticated → middleware may bounce off login
  if (/\/erp(\/|$)/.test(page.url()) && !page.url().includes("/erp/login")) {
    return;
  }

  if (pin) {
    // Prefer shared Desk PIN form — Staff Auth also has name=pin above it
    const deskPinField = page.getByLabel(/^desk pin$/i);
    const openDesk = page.getByRole("button", { name: /open desk/i });
    if (
      (await deskPinField.isVisible().catch(() => false)) &&
      (await openDesk.isVisible().catch(() => false))
    ) {
      await deskPinField.fill(pin);
      await openDesk.click();
    } else {
      const pinInput = page
        .locator("form")
        .filter({ has: openDesk })
        .locator('input[name="pin"]');
      if (await pinInput.isVisible().catch(() => false)) {
        await pinInput.fill(pin);
        await openDesk.click();
      }
    }
  } else if (email && password) {
    await page
      .locator(
        'input[type="email"], input[name="email"], input[name="employee_code"], input[name="code"]',
      )
      .first()
      .fill(email);
    await page
      .locator('input[type="password"]:not([name="pin"])')
      .first()
      .fill(password);
    await page
      .getByRole("button", { name: /sign in|log in|continue/i })
      .first()
      .click();
  }

  await page.waitForURL(
    (url) => {
      const p = url.pathname;
      return p.startsWith("/erp") && !p.includes("/erp/login");
    },
    { timeout: 45_000 },
  );
}

export async function expectNoCrash(page: Page, path: string): Promise<void> {
  const res = await page.goto(path, { waitUntil: "domcontentloaded" });
  const status = res?.status() ?? 0;
  expect(status, `${path} HTTP status`).toBeLessThan(500);
  await expect(page.locator("body")).toBeVisible({ timeout: 30_000 });
  const bodyText = await page.locator("body").innerText().catch(() => "");
  expect(
    bodyText,
    `${path} should not show Next.js crash overlay`,
  ).not.toMatch(/Application error: a client-side exception/i);
  // Desk routes must not bounce to login after deskLogin()
  if (path.startsWith("/erp") && path !== "/erp/login") {
    expect(page.url(), `${path} still on login`).not.toMatch(/\/erp\/login/);
    expect(bodyText, `${path} looks like login wall`).not.toMatch(
      /Open desk|Shared desk PIN/i,
    );
  }
}

/** Horizontal document overflow past viewport (layout smoke). */
export async function assertNoHorizontalOverflow(page: Page): Promise<void> {
  const overflow = await page.evaluate(() => {
    const doc = document.documentElement;
    const body = document.body;
    const scrollW = Math.max(doc.scrollWidth, body.scrollWidth);
    const clientW = doc.clientWidth;
    return { scrollW, clientW, overflowPx: scrollW - clientW };
  });
  expect(
    overflow.overflowPx,
    `horizontal overflow ${overflow.overflowPx}px (scroll=${overflow.scrollW}, client=${overflow.clientW})`,
  ).toBeLessThanOrEqual(8);
}

/** ERP nav hrefs — keep in sync with erp-nav ERP_MODULES tabs. */
export const ERP_NAV_HREFS = [
  "/erp",
  "/erp/calendar",
  "/erp/calendar/day-sheet",
  "/erp/arrivals",
  "/erp/in-house",
  "/erp/departures",
  "/erp/reservations",
  "/erp/sales-claims",
  "/erp/rate-approvals",
  "/erp/guests",
  "/erp/loyalty",
  "/erp/group",
  "/erp/rooms",
  "/erp/rooms/layout",
  "/erp/housekeeping",
  "/erp/lost-found",
  "/erp/maintenance",
  "/erp/laundry",
  "/erp/pos",
  "/erp/menu",
  "/erp/menu/print",
  "/erp/pos/reservations",
  "/erp/pos/recipe-cost",
  "/erp/pos/menu-engineering",
  "/erp/pos/loyalty",
  "/erp/kitchen",
  "/erp/kitchen/day-pack",
  "/erp/kitchen/outlets",
  "/erp/kitchen/compliance",
  "/erp/kitchen/shopping",
  "/erp/kitchen/labor",
  "/erp/kitchen/food-cost",
  "/erp/kds",
  "/erp/payments",
  "/erp/invoices",
  "/erp/folios",
  "/erp/night-audit",
  "/erp/finance/banking",
  "/erp/finance/expenses",
  "/erp/finance/gst",
  "/erp/finance",
  "/erp/reports",
  "/erp/agents",
  "/erp/agents/confirmed",
  "/erp/agents/call-tasks",
  "/erp/agents/rate-downloads",
  "/erp/marketing",
  "/erp/rate-plans",
  "/erp/partners",
  "/erp/allotments",
  "/erp/channel",
  "/erp/hr",
  "/erp/hr/access",
  "/erp/hr/positions",
  "/erp/hr/vacancies",
  "/erp/hr/recruitment",
  "/erp/hr/rota",
  "/erp/hr/attendance",
  "/erp/hr/leave",
  "/erp/hr/isr",
  "/erp/hr/payroll",
  "/erp/inventory",
  "/erp/inventory/locations",
  "/erp/inventory/moves",
  "/erp/inventory/audits",
  "/erp/inventory/purchase-orders",
  "/erp/inventory/assets",
  "/erp/settings",
  "/erp/rates",
  "/erp/front-public",
  "/erp/front-public/media",
  "/erp/front-public/media/upload",
  "/erp/properties/new",
  "/erp/dot-assessment",
  "/erp/training",
] as const;

export const PUBLIC_HREFS = [
  "/",
  "/rooms",
  "/book",
  "/dine",
  "/cafe",
  "/restaurant",
  "/bar",
  "/spa",
  "/meeting",
  "/order",
  "/contact",
  "/agents",
  "/faq",
] as const;

/** Wave A–B: FO critical surfaces from ERP-AUDIT. */
export const WAVE_AB_ROUTES: ReadonlyArray<{
  path: string;
  expectText: RegExp;
  cta?: RegExp;
}> = [
  { path: "/erp/calendar", expectText: /calendar|rack|room|occupancy/i },
  { path: "/erp/calendar/day-sheet", expectText: /day sheet|occupancy|room/i },
  {
    path: "/erp/arrivals",
    expectText: /arrival|check-?in|guest/i,
    cta: /check.?in|arrive|open/i,
  },
  { path: "/erp/in-house", expectText: /in.?house|stay|guest|room/i },
  {
    path: "/erp/departures",
    expectText: /departure|check.?out|leave|guest/i,
  },
  {
    path: "/erp/reservations",
    expectText: /reservation|stay|guest|booking/i,
    cta: /new|fast book|reserve|add/i,
  },
  {
    path: "/erp/fast-book",
    expectText: /book|guest|room|rate|stay/i,
  },
  { path: "/erp/rooms", expectText: /room|unit|status|housekeeping|hk/i },
  {
    path: "/erp/housekeeping",
    expectText: /housekeeping|clean|dirty|ready|hk/i,
  },
  { path: "/erp/payments", expectText: /payment|pay|cash|folio|collect/i },
  { path: "/erp/folios", expectText: /folio|ledger|balance|guest/i },
  {
    path: "/erp/night-audit",
    expectText: /night audit|close|business date/i,
  },
  { path: "/erp/invoices", expectText: /invoice|fiscal|tax|gst|inv/i },
];
