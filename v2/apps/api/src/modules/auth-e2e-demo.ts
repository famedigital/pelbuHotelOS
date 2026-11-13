/**
 * Local Playwright / UAT only — HMAC hotel + staff tokens for DEMO property.
 * Gated by ALLOW_E2E_DEMO_AUTH=1. Never enable on Coolify production.
 */
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { issueDeskToken } from "../platform/desk-token.js";

const DEMO_STAFF = {
  karma: {
    staffId: "00000000-0000-4000-8000-0000000000aa",
    pin: "1234",
    fullName: "Karma Dorji",
    deskRole: "fo_manager",
    homeRoute: "/desk",
    employeeCode: "E2E-FO",
  },
  ugyen: {
    staffId: "00000000-0000-4000-8000-0000000000ab",
    pin: "4567",
    fullName: "Ugyen Penjor",
    /* gm so night_audit.run is allowed (FO matrix + day-close authority). */
    deskRole: "gm",
    homeRoute: "/night-audit",
    employeeCode: "E2E-NA",
  },
  deki: {
    staffId: "00000000-0000-4000-8000-0000000000ac",
    pin: "2345",
    fullName: "Deki Yangzom",
    deskRole: "cashier",
    homeRoute: "/pos",
    employeeCode: "E2E-POS",
  },
  tenzin: {
    staffId: "00000000-0000-4000-8000-0000000000ad",
    pin: "9999",
    fullName: "Tenzin Norbu",
    deskRole: "gm",
    homeRoute: "/owner",
    employeeCode: "E2E-GM",
  },
} as const;

type StaffKey = keyof typeof DEMO_STAFF;

function e2eEnabled(): boolean {
  return String(process.env.ALLOW_E2E_DEMO_AUTH ?? "") === "1";
}

function demoProperty(): { id: string; slug: string; name: string } {
  const id =
    process.env.E2E_DEMO_PROPERTY_ID?.trim() ||
    "c22c44c1-547c-4351-b1ec-608f6590e340";
  const slug = process.env.E2E_DEMO_PROPERTY_SLUG?.trim() || "pelbu-suites-olakha";
  const name =
    process.env.E2E_DEMO_PROPERTY_NAME?.trim() || "Pelbu Suites (seed archive)";
  return { id, slug, name };
}

export function registerAuthE2eDemoRoutes(app: FastifyInstance): void {
  app.post("/v1/auth/e2e/hotel-gate", async (_req, reply) => {
    if (!e2eEnabled()) {
      return reply.code(404).send({ ok: false, error: "Not found" });
    }
    const property = demoProperty();
    const token = issueDeskToken({
      sub: `e2e-owner:${property.id}`,
      role: "owner",
      propertyId: property.id,
      homeRoute: "/pin",
    });
    return {
      ok: true,
      token,
      homeRoute: "/pin",
      property,
    };
  });

  const pinBody = z.object({
    staffKey: z.enum(["karma", "ugyen", "deki", "tenzin"]),
    pin: z.string().regex(/^\d{4,8}$/),
  });

  app.post("/v1/auth/e2e/staff-pin", async (req, reply) => {
    if (!e2eEnabled()) {
      return reply.code(404).send({ ok: false, error: "Not found" });
    }
    const body = pinBody.safeParse(req.body);
    if (!body.success) {
      return reply.code(400).send({ ok: false, error: "Invalid staffKey/pin" });
    }
    const preset = DEMO_STAFF[body.data.staffKey as StaffKey];
    if (preset.pin !== body.data.pin) {
      return reply.code(401).send({ ok: false, error: "Incorrect PIN" });
    }
    const property = demoProperty();
    const token = issueDeskToken({
      sub: preset.staffId,
      role: "staff",
      propertyId: property.id,
      staffId: preset.staffId,
      staffName: preset.fullName,
      deskRole: preset.deskRole,
      employeeCode: preset.employeeCode,
      homeRoute: preset.homeRoute,
    });
    return {
      ok: true,
      token,
      homeRoute: preset.homeRoute,
      staff: {
        id: preset.staffId,
        fullName: preset.fullName,
        deskRole: preset.deskRole,
        employeeCode: preset.employeeCode,
      },
      property,
    };
  });
}
