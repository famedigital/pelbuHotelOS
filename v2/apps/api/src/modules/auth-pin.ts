/**
 * Desk PIN Gateway — staff list + unlock / first-login PIN set.
 * Staff are property-scoped; owner uses org_members email (separate path).
 */
import type { FastifyInstance } from "fastify";
import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { queryRaw, requireDb } from "@hos-v2/db";
import { homeRouteForDeskRole } from "@hos-v2/domain";
import { bearerToken, issueDeskToken, verifyDeskToken } from "../platform/desk-token.js";

const PIN_PREFIX = "scrypt$";
const uuidSchema = z.string().uuid();

export function hashPin(pin: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(pin, salt, 32).toString("hex");
  return `${PIN_PREFIX}${salt}$${hash}`;
}

export function verifyPin(pin: string, stored: string | null | undefined): boolean {
  if (!stored || !stored.startsWith(PIN_PREFIX)) return false;
  const parts = stored.split("$");
  if (parts.length !== 3) return false;
  const salt = parts[1]!;
  const expected = parts[2]!;
  const actual = scryptSync(pin, salt, 32).toString("hex");
  try {
    return timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(actual, "hex"));
  } catch {
    return false;
  }
}

function homeRouteForRole(deskRole: string | null | undefined, fallback: string): string {
  const routed = homeRouteForDeskRole(deskRole);
  if (routed !== "/desk") return routed;
  /* Unknown roles keep DB home_route when FO-shaped default would hide a custom landing. */
  if (!deskRole) return fallback || "/desk";
  const role = String(deskRole).toLowerCase().replace(/\s+/g, "_");
  if (
    role === "fo" ||
    role === "front_desk" ||
    role === "fo_agent" ||
    role === "fo_manager" ||
    role === "front_office"
  ) {
    return "/desk";
  }
  return fallback || routed;
}

function assertDb() {
  const gate = requireDb();
  if (!gate.ok) {
    throw Object.assign(new Error("DATABASE_REQUIRED"), { statusCode: 503 });
  }
}

function sqlLiteral(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

type PropertyRow = { id: string; slug: string; name: string; organization_id: string };
type StaffRow = {
  id: string;
  property_id: string;
  display_name: string;
  role: string;
  desk_role: string | null;
  employee_code: string | null;
  home_route: string;
  pin_hash: string | null;
  pin_reset_required: boolean;
  can_login: boolean;
  active: boolean;
};

async function resolveProperty(slugOrId: string): Promise<PropertyRow> {
  assertDb();
  const byUuid = uuidSchema.safeParse(slugOrId);
  const rows = (await queryRaw(
    byUuid.success
      ? `SELECT id, slug, name, organization_id FROM v2.properties WHERE id = ${sqlLiteral(slugOrId)} LIMIT 1`
      : `SELECT id, slug, name, organization_id FROM v2.properties WHERE slug = ${sqlLiteral(slugOrId)} LIMIT 1`,
  )) as PropertyRow[];
  const row = Array.isArray(rows) ? rows[0] : undefined;
  if (!row) throw Object.assign(new Error("Property not found"), { statusCode: 404 });
  return row;
}

export async function registerAuthPinRoutes(app: FastifyInstance) {
  /** Staff property list — requires hotel_desk gate token (exclusive per hotel). */
  app.get("/v1/auth/properties", async (req, reply) => {
    try {
      assertDb();
      const claims = verifyDeskToken(bearerToken(req.headers.authorization));
      if (!claims || (claims.role !== "hotel_desk" && claims.role !== "staff" && claims.role !== "owner")) {
        return reply.code(401).send({ ok: false, error: "Hotel desk unlock required" });
      }
      const rows = (await queryRaw(
        claims.role === "owner"
          ? `SELECT id, slug, name, organization_id FROM v2.properties
             WHERE organization_id = ${sqlLiteral(String(claims.organizationId ?? ""))}
               AND slug <> 'demo-hotel'
               AND lower(name) NOT IN ('demo', 'demo hotel')
               AND slug NOT LIKE '%seed%'
               AND name NOT ILIKE '%seed archive%'
             ORDER BY
               CASE
                 WHEN slug = 'pelbu-olakha' THEN 0
                 WHEN slug ILIKE '%pelbu%' OR name ILIKE '%pelbu%' THEN 1
                 ELSE 2
               END,
               name`
          : `SELECT id, slug, name, organization_id FROM v2.properties
             WHERE id = ${sqlLiteral(claims.propertyId)} LIMIT 1`,
      )) as PropertyRow[];
      return { ok: true, properties: rows ?? [] };
    } catch (err) {
      const status = (err as { statusCode?: number }).statusCode ?? 500;
      const message = err instanceof Error ? err.message : "Property list failed";
      req.log.error({ err }, "[auth/properties]");
      return reply.code(status).send({ ok: false, error: message });
    }
  });

  /** Org owner property switcher — after Supabase email login for pelbusuites@gmail.com. */
  app.get<{ Querystring: { email?: string } }>("/v1/auth/owner/properties", async (req, reply) => {
    try {
      assertDb();
      const email = String(req.query.email ?? "").trim().toLowerCase();
      if (!email || !email.includes("@")) {
        return reply.code(400).send({ ok: false, error: "email required" });
      }
      const members = (await queryRaw(
        `SELECT organization_id, role, auth_user_id, email
         FROM v2.org_members WHERE lower(email) = ${sqlLiteral(email)} LIMIT 1`,
      )) as Array<{
        organization_id: string;
        role: string;
        auth_user_id: string;
        email: string;
      }>;
      const member = members?.[0];
      if (!member) {
        return reply.code(404).send({ ok: false, error: "Owner not found" });
      }
      const properties = (await queryRaw(
        `SELECT id, slug, name, organization_id
         FROM v2.properties
         WHERE organization_id = ${sqlLiteral(member.organization_id)}
           AND slug <> 'demo-hotel'
           AND lower(name) NOT IN ('demo', 'demo hotel')
           AND slug NOT LIKE '%seed%'
           AND name NOT ILIKE '%seed archive%'
         ORDER BY
           CASE
             WHEN slug = 'pelbu-olakha' THEN 0
             WHEN slug ILIKE '%pelbu%' OR name ILIKE '%pelbu%' THEN 1
             ELSE 2
           END,
           name`,
      )) as PropertyRow[];
      return {
        ok: true,
        owner: {
          email: member.email,
          role: member.role,
          authUserId: member.auth_user_id,
          organizationId: member.organization_id,
        },
        properties: properties ?? [],
      };
    } catch (err) {
      const status = (err as { statusCode?: number }).statusCode ?? 500;
      const message = err instanceof Error ? err.message : "Owner properties failed";
      req.log.error({ err }, "[auth/owner/properties]");
      return reply.code(status).send({ ok: false, error: message });
    }
  });



  app.get<{ Querystring: { propertySlug?: string; propertyId?: string } }>(
    "/v1/auth/staff",
    async (req, reply) => {
      try {
        const claims = verifyDeskToken(bearerToken(req.headers.authorization));
        if (!claims || (claims.role !== "hotel_desk" && claims.role !== "staff" && claims.role !== "owner")) {
          return reply.code(401).send({ ok: false, error: "Hotel desk unlock required" });
        }
        const key = req.query.propertyId || req.query.propertySlug || claims.propertyId;
        if (!key) {
          return reply.code(400).send({ ok: false, error: "propertySlug or propertyId required" });
        }
        const property = await resolveProperty(key);
        if (claims.role !== "owner" && property.id !== claims.propertyId) {
          return reply.code(403).send({ ok: false, error: "Staff list is exclusive to unlocked hotel" });
        }
        const staff = (await queryRaw(
          `SELECT id, property_id, display_name, role, desk_role, employee_code, home_route,
                  (pin_hash IS NOT NULL) AS pin_set, pin_reset_required, can_login, active
           FROM v2.staff
           WHERE property_id = ${sqlLiteral(property.id)}
             AND active = true
             AND can_login = true
           ORDER BY display_name`,
        )) as Array<Record<string, unknown>>;
        return {
          ok: true,
          property,
          staff: (staff ?? []).map((s) => ({
            id: s.id,
            fullName: s.display_name,
            employeeCode: s.employee_code,
            deskRole: s.desk_role ?? s.role,
            homeRoute: s.home_route ?? "/desk",
            pinSet: Boolean(s.pin_set),
            pinResetRequired: Boolean(s.pin_reset_required),
            canAccessDesk: true,
          })),
        };
      } catch (err) {
        const status = (err as { statusCode?: number }).statusCode ?? 500;
        const message = err instanceof Error ? err.message : "Staff list failed";
        req.log.error({ err }, "[auth/staff]");
        return reply.code(status).send({ ok: false, error: message });
      }
    },
  );

  const pinBody = z.object({
    propertySlug: z.string().min(1).optional(),
    propertyId: z.string().uuid().optional(),
    /** Optional — omit for anonymous PIN pad (match by PIN only). */
    staffId: z.string().uuid().optional(),
    pin: z.string().regex(/^\d{4,8}$/),
    confirmPin: z.string().regex(/^\d{4,8}$/).optional(),
  });

  app.post("/v1/auth/pin", async (req, reply) => {
    try {
      const gate = verifyDeskToken(bearerToken(req.headers.authorization));
      /* Hotel email login issues role "owner"; code/PIN unlock uses "hotel_desk". */
      if (!gate || (gate.role !== "hotel_desk" && gate.role !== "staff" && gate.role !== "owner")) {
        return reply.code(401).send({ ok: false, error: "Hotel desk unlock required before staff PIN" });
      }
      const body = pinBody.parse(req.body);
      const key = body.propertyId || body.propertySlug || gate.propertyId;
      if (!key) {
        return reply.code(400).send({ ok: false, error: "propertySlug or propertyId required" });
      }
      const property = await resolveProperty(key);
      if (property.id !== gate.propertyId) {
        return reply.code(403).send({ ok: false, error: "PIN unlock exclusive to gated hotel" });
      }

      let staff: StaffRow | undefined;
      if (body.staffId) {
        const rows = (await queryRaw(
          `SELECT id, property_id, display_name, role, desk_role, employee_code, home_route,
                  pin_hash, pin_reset_required, can_login, active
           FROM v2.staff
           WHERE id = ${sqlLiteral(body.staffId)} AND property_id = ${sqlLiteral(property.id)}
           LIMIT 1`,
        )) as StaffRow[];
        staff = rows?.[0];
      } else {
        /* Anonymous pad: scan active desk logins — do not reveal which staff exist. */
        const rows = (await queryRaw(
          `SELECT id, property_id, display_name, role, desk_role, employee_code, home_route,
                  pin_hash, pin_reset_required, can_login, active
           FROM v2.staff
           WHERE property_id = ${sqlLiteral(property.id)}
             AND active = true AND can_login = true
             AND pin_hash IS NOT NULL AND pin_reset_required = false`,
        )) as StaffRow[];
        for (const row of rows ?? []) {
          if (verifyPin(body.pin, row.pin_hash)) {
            staff = row;
            break;
          }
        }
        if (!staff) {
          return reply.code(401).send({ ok: false, error: "Incorrect PIN" });
        }
      }

      if (!staff || !staff.active || !staff.can_login) {
        return reply.code(401).send({ ok: false, error: "Incorrect PIN" });
      }

      const needsSet = staff.pin_reset_required || !staff.pin_hash;
      if (needsSet) {
        if (!body.staffId) {
          return reply.code(409).send({
            ok: false,
            error: "PIN_SETUP_REQUIRED",
            message: "Ask Operations Lead to complete first-login PIN setup for this staff.",
          });
        }
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
          `UPDATE v2.staff
           SET pin_hash = ${sqlLiteral(pinHash)},
               pin_reset_required = false,
               pin_set_at = now(),
               version = version + 1
           WHERE id = ${sqlLiteral(staff.id)} AND property_id = ${sqlLiteral(property.id)}`,
        );
      } else if (!verifyPin(body.pin, staff.pin_hash)) {
        return reply.code(401).send({ ok: false, error: "Incorrect PIN" });
      }

      const homeRoute = homeRouteForRole(staff.desk_role ?? staff.role, staff.home_route);
      const token = issueDeskToken({
        sub: staff.id,
        role: "staff",
        propertyId: property.id,
        staffId: staff.id,
        staffName: staff.display_name,
        deskRole: staff.desk_role ?? staff.role,
        employeeCode: staff.employee_code,
        organizationId: property.organization_id,
        homeRoute,
      });

      return {
        ok: true,
        token,
        homeRoute,
        pinWasReset: needsSet,
        staff: {
          id: staff.id,
          fullName: staff.display_name,
          deskRole: staff.desk_role ?? staff.role,
          employeeCode: staff.employee_code,
        },
        property,
      };
    } catch (err) {
      if (err instanceof z.ZodError) {
        return reply.code(400).send({ ok: false, error: err.issues[0]?.message ?? "Invalid PIN body" });
      }
      const status = (err as { statusCode?: number }).statusCode ?? 500;
      const message = err instanceof Error ? err.message : "PIN verification failed";
      req.log.error({ err }, "[auth/pin]");
      return reply.code(status).send({ ok: false, error: message });
    }
  });
}
