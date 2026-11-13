/**
 * Desk unlock for Playwright FO / StayHub journeys.
 *
 * Live droplet API rejects synthetic local-demo tokens. Mint a desk JWT with
 * DESK_JWT_SECRET (from apps/api/.env) so /v1/command accepts money paths.
 */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, type APIRequestContext, type Page } from "@playwright/test";

export const E2E_DEMO_PROPERTY = {
  id:
    process.env.E2E_DEMO_PROPERTY_ID?.trim() ||
    "d06e89f8-86e6-4201-bbd2-5e115d422357",
  slug: process.env.E2E_DEMO_PROPERTY_SLUG?.trim() || "pelbu-olakha",
  name: process.env.E2E_DEMO_PROPERTY_NAME?.trim() || "Pelbu Suites Olakha",
} as const;

type DeskProperty = {
  id: string;
  slug: string;
  name: string;
};

type StaffKey = "karma" | "ugyen" | "deki" | "tshering" | "tenzin";

type UnlockOpts = {
  ready: () => Promise<void>;
  waitLiveSync?: boolean;
  homePath?: string;
};

const API = process.env.VITE_API_URL || "http://127.0.0.1:4200";

const STAFF_PRESETS: Record<
  StaffKey,
  {
    staffId: string;
    fullName: string;
    deskRole: string;
    homeRoute: string;
    pin: string;
  }
> = {
  karma: {
    staffId: "b2381f84-898a-412e-8a21-8612d40ba7b9",
    fullName: "Choki Wangmo",
    deskRole: "fo",
    homeRoute: "/desk",
    pin: "1234",
  },
  ugyen: {
    staffId: "3812d45d-606c-4e3b-a70f-7dbbbcc11173",
    fullName: "Meg Raj",
    deskRole: "gm",
    homeRoute: "/night-audit",
    pin: "4567",
  },
  deki: {
    staffId: "b2381f84-898a-412e-8a21-8612d40ba7b9",
    fullName: "Choki Wangmo",
    deskRole: "cashier",
    homeRoute: "/pos",
    pin: "2345",
  },
  tshering: {
    staffId: "49ed3b54-36a9-491a-86c8-dc806d1c3bfd",
    fullName: "Rigzang",
    deskRole: "hk",
    homeRoute: "/housekeeping",
    pin: "3456",
  },
  tenzin: {
    staffId: "3812d45d-606c-4e3b-a70f-7dbbbcc11173",
    fullName: "Meg Raj",
    deskRole: "gm",
    homeRoute: "/owner",
    pin: "9999",
  },
};

function loadJwtSecret(): string {
  if (process.env.DESK_JWT_SECRET?.trim()) return process.env.DESK_JWT_SECRET.trim();
  const apiDir = resolve(dirname(fileURLToPath(import.meta.url)), "../../../api");
  for (const name of [".env", ".env.local"]) {
    try {
      const raw = readFileSync(resolve(apiDir, name), "utf8");
      for (const line of raw.split(/\r?\n/)) {
        const m = /^DESK_JWT_SECRET=(.*)$/.exec(line.trim());
        if (m) return m[1].trim().replace(/^["']|["']$/g, "");
      }
    } catch {
      /* try next */
    }
  }
  throw new Error("DESK_JWT_SECRET required for StayHub e2e against live API");
}

function issueDeskToken(input: {
  staffId: string;
  fullName: string;
  deskRole: string;
  propertyId: string;
  homeRoute: string;
}): string {
  const secret = loadJwtSecret();
  const payload = {
    sub: input.staffId,
    propertyId: input.propertyId,
    role: "staff" as const,
    staffId: input.staffId,
    staffName: input.fullName,
    deskRole: input.deskRole,
    homeRoute: input.homeRoute,
    iat: Date.now(),
  };
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = createHash("sha256").update(`${body}:${secret}`).digest("base64url");
  return `${body}.${sig}`;
}

async function resolveE2eProperty(request: APIRequestContext): Promise<DeskProperty> {
  try {
    const res = await request.get(`${API}/v1/auth/hotels`);
    if (res.ok()) {
      const body = (await res.json()) as {
        ok?: boolean;
        hotels?: Array<{ id: string; slug: string; name: string }>;
      };
      const hotels = body.hotels ?? [];
      const live = hotels.filter((h) => {
        const slug = h.slug.toLowerCase();
        const name = h.name.toLowerCase();
        if (slug === "demo-hotel" || name === "demo" || name === "demo hotel") return false;
        if (slug.includes("seed") || name.includes("seed archive")) return false;
        return true;
      });
      const preferred =
        live.find((h) => h.slug === E2E_DEMO_PROPERTY.slug) ||
        live.find((h) => h.slug === "pelbu-olakha") ||
        live.find((h) => /pelbu/i.test(h.slug) || /pelbu/i.test(h.name)) ||
        live[0];
      if (preferred) {
        return { id: preferred.id, slug: preferred.slug, name: preferred.name };
      }
    }
  } catch {
    /* fall through */
  }
  return { ...E2E_DEMO_PROPERTY };
}

export async function unlockStaff(
  page: Page,
  staffKey: StaffKey,
  _pin: string,
  opts: UnlockOpts,
): Promise<void> {
  const property = await resolveE2eProperty(page.request);
  const preset = STAFF_PRESETS[staffKey];
  const home = opts.homePath || preset.homeRoute;
  const token = issueDeskToken({
    staffId: preset.staffId,
    fullName: preset.fullName,
    deskRole: preset.deskRole,
    propertyId: property.id,
    homeRoute: home,
  });

  await page.addInitScript(
    (args: {
      property: DeskProperty;
      token: string;
      staff: {
        id: string;
        fullName: string;
        deskRole: string;
        employeeCode: string | null;
      };
    }) => {
      localStorage.setItem("hos_hotel_onboarded", "true");
      localStorage.setItem("hos_hotel_onboard_dismissed", "true");
      localStorage.setItem("hos_staff_tour_completed", "true");
      localStorage.setItem("hos.v2.propertyId", args.property.id);
      localStorage.setItem("hos.v2.propertySlug", args.property.slug);
      localStorage.setItem("hos_desk_role", args.staff.deskRole);
      sessionStorage.setItem("hos.v2.hotel.token", args.token);
      sessionStorage.setItem("hos.v2.hotel.property", JSON.stringify(args.property));
      sessionStorage.setItem("hos.v2.desk.token", args.token);
      sessionStorage.setItem("hos.v2.desk.staff", JSON.stringify(args.staff));
      sessionStorage.setItem("hos.v2.desk.property", JSON.stringify(args.property));
    },
    {
      property,
      token,
      staff: {
        id: preset.staffId,
        fullName: preset.fullName,
        deskRole: preset.deskRole,
        employeeCode: null,
      },
    },
  );

  await page.goto(home);

  const wizardClose = page.getByRole("button", { name: "Close wizard" });
  if (await wizardClose.isVisible().catch(() => false)) {
    await wizardClose.click();
  }

  await opts.ready();

  await page
    .locator("[data-sonner-toast]")
    .filter({ hasText: /Welcome|hydrated/i })
    .first()
    .waitFor({ state: "hidden", timeout: 8_000 })
    .catch(() => undefined);

  if (opts.waitLiveSync !== false) {
    await expect
      .poll(
        async () => page.getByTitle(/Live sync/i).getAttribute("data-glow"),
        { timeout: 20_000 },
      )
      .not.toBe("ruby");
    await page.waitForTimeout(1_200);
  }
}

/** Staff JWT from the unlocked page session — for API command calls. */
export async function readDeskBearer(page: Page): Promise<string> {
  const token = await page.evaluate(() => sessionStorage.getItem("hos.v2.desk.token"));
  if (!token) throw new Error("Missing hos.v2.desk.token after unlock");
  return token;
}

/** Prefer Deluxe King; fall back to first room-type chip. */
export async function pickSellableRoomType(page: Page): Promise<void> {
  const preferred = page
    .getByRole("button", { name: /Deluxe King|Executive King/i })
    .first();
  if (await preferred.isVisible().catch(() => false)) {
    await preferred.click();
    return;
  }
  const anyType = page
    .locator('[role="dialog"] button')
    .filter({ hasText: /King|Twin|Suite|Deluxe|Executive/i })
    .first();
  await expect(anyType).toBeVisible({ timeout: 15_000 });
  await anyType.click();
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
