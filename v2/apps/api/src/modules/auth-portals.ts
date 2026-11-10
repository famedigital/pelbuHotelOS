/**
 * Exclusive hotel desk gate + agent/guide/driver portal PIN login.
 */
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { queryRaw, requireDb } from "@hos-v2/db";
import { hashPin, verifyPin } from "./auth-pin.js";
import { issueDeskToken } from "../platform/desk-token.js";

const uuidSchema = z.string().uuid();

function assertDb() {
  const gate = requireDb();
  if (!gate.ok) {
    throw Object.assign(new Error("DATABASE_REQUIRED"), { statusCode: 503 });
  }
}

function sqlLiteral(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

type PropertyRow = {
  id: string;
  slug: string;
  name: string;
  organization_id: string;
  desk_access_code_hash: string | null;
  desk_access_code_hint: string | null;
};

type PortalRow = {
  id: string;
  property_id: string;
  role: string;
  subject_id: string;
  login_code: string;
  display_name: string;
  pin_hash: string | null;
  pin_reset_required: boolean;
  home_route: string;
  active: boolean;
};

async function resolveProperty(slugOrId: string): Promise<PropertyRow> {
  assertDb();
  const byUuid = uuidSchema.safeParse(slugOrId);
  const rows = (await queryRaw(
    byUuid.success
      ? `SELECT id, slug, name, organization_id, desk_access_code_hash, desk_access_code_hint
         FROM v2.properties WHERE id = ${sqlLiteral(slugOrId)} LIMIT 1`
      : `SELECT id, slug, name, organization_id, desk_access_code_hash, desk_access_code_hint
         FROM v2.properties WHERE slug = ${sqlLiteral(slugOrId)} LIMIT 1`,
  )) as PropertyRow[];
  const row = rows?.[0];
  if (!row) throw Object.assign(new Error("Property not found"), { statusCode: 404 });
  return row;
}

const hotelUnlockBody = z.object({
  propertySlug: z.string().min(1).optional(),
  propertyId: z.string().uuid().optional(),
  deskCode: z.string().min(4).max(32),
});

const portalLoginBody = z.object({
  role: z.enum(["agent", "guide", "driver"]),
  propertySlug: z.string().min(1).optional(),
  propertyId: z.string().uuid().optional(),
  loginCode: z.string().min(1).max(64),
  pin: z.string().regex(/^\d{4,8}$/),
  confirmPin: z.string().regex(/^\d{4,8}$/).optional(),
});

export async function registerAuthPortalRoutes(app: FastifyInstance) {
  /** Public directory: slug + name only (no secrets). Used by hotel login picker. */
  app.get("/v1/auth/hotels", async (req, reply) => {
    try {
      assertDb();
      const rows = (await queryRaw(
        `SELECT id, slug, name,
                (desk_access_code_hash IS NOT NULL) AS gate_enabled,
                desk_access_code_hint AS hint
         FROM v2.properties
         ORDER BY name`,
      )) as Array<{
        id: string;
        slug: string;
        name: string;
        gate_enabled: boolean;
        hint: string | null;
      }>;
      return {
        ok: true,
        hotels: (rows ?? []).map((r) => ({
          id: r.id,
          slug: r.slug,
          name: r.name,
          gateEnabled: Boolean(r.gate_enabled),
          hint: r.hint,
        })),
      };
    } catch (err) {
      const status = (err as { statusCode?: number }).statusCode ?? 500;
      const message = err instanceof Error ? err.message : "Hotel list failed";
      req.log.error({ err }, "[auth/hotels]");
      return reply.code(status).send({ ok: false, error: message });
    }
  });

  /** Hotel exclusive gate — unlocks staff PIN screen for one property only. */
  app.post("/v1/auth/hotel/unlock", async (req, reply) => {
    try {
      const body = hotelUnlockBody.parse(req.body);
      const key = body.propertyId || body.propertySlug;
      if (!key) {
        return reply.code(400).send({ ok: false, error: "propertySlug or propertyId required" });
      }
      const property = await resolveProperty(key);
      if (!property.desk_access_code_hash) {
        return reply.code(503).send({
          ok: false,
          error: "DESK_GATE_NOT_CONFIGURED",
          message: "Ask owner to set this hotel desk access code.",
        });
      }
      if (!verifyPin(body.deskCode, property.desk_access_code_hash)) {
        return reply.code(401).send({ ok: false, error: "Incorrect hotel desk code" });
      }
      const token = issueDeskToken({
        sub: `hotel:${property.id}`,
        propertyId: property.id,
        organizationId: property.organization_id,
        role: "hotel_desk",
        homeRoute: "/pin",
      });
      return {
        ok: true,
        token,
        homeRoute: "/pin",
        property: {
          id: property.id,
          slug: property.slug,
          name: property.name,
          organization_id: property.organization_id,
        },
      };
    } catch (err) {
      if (err instanceof z.ZodError) {
        return reply.code(400).send({ ok: false, error: err.issues[0]?.message ?? "Invalid body" });
      }
      const status = (err as { statusCode?: number }).statusCode ?? 500;
      const message = err instanceof Error ? err.message : "Hotel unlock failed";
      req.log.error({ err }, "[auth/hotel/unlock]");
      return reply.code(status).send({ ok: false, error: message });
    }
  });

  /** Agent / guide / driver exclusive portal login. */
  app.post("/v1/auth/portal/login", async (req, reply) => {
    try {
      assertDb();
      const body = portalLoginBody.parse(req.body);
      const key = body.propertyId || body.propertySlug;
      if (!key) {
        return reply.code(400).send({ ok: false, error: "propertySlug or propertyId required" });
      }
      const property = await resolveProperty(key);
      const code = body.loginCode.trim().toUpperCase();
      const rows = (await queryRaw(
        `SELECT id, property_id, role, subject_id, login_code, display_name,
                pin_hash, pin_reset_required, home_route, active
         FROM v2.portal_accounts
         WHERE property_id = ${sqlLiteral(property.id)}
           AND role = ${sqlLiteral(body.role)}
           AND upper(login_code) = ${sqlLiteral(code)}
         LIMIT 1`,
      )) as PortalRow[];
      const account = rows?.[0];
      if (!account || !account.active) {
        return reply.code(401).send({ ok: false, error: "Unknown login for this hotel" });
      }

      const needsSet = account.pin_reset_required || !account.pin_hash;
      if (needsSet) {
        if (!body.confirmPin) {
          return reply.code(409).send({
            ok: false,
            error: "PIN_RESET_REQUIRED",
            message: "Set a new 4–8 digit PIN, then confirm it.",
          });
        }
        if (body.confirmPin !== body.pin) {
          return reply.code(400).send({ ok: false, error: "PIN confirmation does not match" });
        }
        const pinHash = hashPin(body.pin);
        await queryRaw(
          `UPDATE v2.portal_accounts
           SET pin_hash = ${sqlLiteral(pinHash)},
               pin_reset_required = false,
               version = version + 1,
               updated_at = now()
           WHERE id = ${sqlLiteral(account.id)}`,
        );
      } else if (!verifyPin(body.pin, account.pin_hash)) {
        return reply.code(401).send({ ok: false, error: "Incorrect PIN" });
      }

      const homeRoute =
        account.home_route ||
        (body.role === "agent" ? "/partner" : body.role === "guide" ? "/guide" : "/driver");

      const token = issueDeskToken({
        sub: account.id,
        propertyId: property.id,
        organizationId: property.organization_id,
        role: body.role,
        portalAccountId: account.id,
        subjectId: account.subject_id,
        staffName: account.display_name,
        homeRoute,
      });

      return {
        ok: true,
        token,
        homeRoute,
        pinWasReset: needsSet,
        account: {
          id: account.id,
          role: body.role,
          loginCode: account.login_code,
          displayName: account.display_name,
          subjectId: account.subject_id,
        },
        property: {
          id: property.id,
          slug: property.slug,
          name: property.name,
        },
      };
    } catch (err) {
      if (err instanceof z.ZodError) {
        return reply.code(400).send({ ok: false, error: err.issues[0]?.message ?? "Invalid body" });
      }
      const status = (err as { statusCode?: number }).statusCode ?? 500;
      const message = err instanceof Error ? err.message : "Portal login failed";
      req.log.error({ err }, "[auth/portal/login]");
      return reply.code(status).send({ ok: false, error: message });
    }
  });
}
