/**
 * Hotel org email/password login via Supabase GoTrue → owner JWT for PIN pad.
 */
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { queryRaw, requireDb } from "@hos-v2/db";
import { bearerToken, issueDeskToken, verifyDeskToken } from "../platform/desk-token.js";
import { gotrueSignInWithPassword } from "../platform/gotrue.js";

function assertDb() {
  const gate = requireDb();
  if (!gate.ok) {
    throw Object.assign(new Error("DATABASE_REQUIRED"), { statusCode: 503 });
  }
}

function sqlLiteral(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

const loginBody = z.object({
  email: z.string().email(),
  password: z.string().min(6).max(128),
  propertyId: z.string().uuid().optional(),
});

const switchBody = z.object({
  propertyId: z.string().uuid().optional(),
  propertySlug: z.string().min(1).optional(),
});

type MemberRow = {
  organization_id: string;
  auth_user_id: string;
  email: string;
  role: string;
  last_property_id: string | null;
};

type PropertyRow = { id: string; slug: string; name: string; organization_id: string };

export async function registerAuthHotelEmailRoutes(app: FastifyInstance) {
  app.post("/v1/auth/hotel/login", async (req, reply) => {
    try {
      assertDb();
      const body = loginBody.parse(req.body);
      const email = body.email.trim().toLowerCase();

      const auth = await gotrueSignInWithPassword(email, body.password);
      if (!auth.ok) {
        req.log.warn({ status: auth.status, err: auth.error }, "[auth/hotel/login] gotrue");
        return reply.code(auth.status === 503 ? 503 : 401).send({
          ok: false,
          error: auth.error === "Auth unreachable" ? auth.error : "Incorrect email or password",
        });
      }

      const userId = auth.user.id;
      const members = (await queryRaw(
        `SELECT organization_id, auth_user_id, email, role, last_property_id
         FROM v2.org_members
         WHERE auth_user_id = ${sqlLiteral(userId)}
            OR lower(email) = ${sqlLiteral(email)}
         LIMIT 1`,
      )) as MemberRow[];
      const member = members?.[0];
      if (!member) {
        return reply.code(403).send({
          ok: false,
          error: "No hotel organization membership for this account",
        });
      }

      const properties = (await queryRaw(
        `SELECT id, slug, name, organization_id
         FROM v2.properties
         WHERE organization_id = ${sqlLiteral(member.organization_id)}
         ORDER BY name`,
      )) as PropertyRow[];
      if (!properties?.length) {
        return reply.code(404).send({ ok: false, error: "No properties for this organization" });
      }

      const property =
        (body.propertyId
          ? properties.find((p) => p.id === body.propertyId)
          : undefined) ||
        (member.last_property_id
          ? properties.find((p) => p.id === member.last_property_id)
          : undefined) ||
        properties[0]!;

      const token = issueDeskToken({
        sub: member.auth_user_id,
        role: "owner",
        propertyId: property.id,
        organizationId: member.organization_id,
        staffName: member.email,
        deskRole: member.role,
        homeRoute: "/pin",
      });

      return {
        ok: true,
        token,
        homeRoute: "/pin",
        email: member.email,
        orgRole: member.role,
        property: {
          id: property.id,
          slug: property.slug,
          name: property.name,
          organization_id: property.organization_id,
        },
        properties: properties.map((p) => ({
          id: p.id,
          slug: p.slug,
          name: p.name,
          organization_id: p.organization_id,
        })),
      };
    } catch (err) {
      if (err instanceof z.ZodError) {
        return reply.code(400).send({ ok: false, error: err.issues[0]?.message ?? "Invalid body" });
      }
      const status = (err as { statusCode?: number }).statusCode ?? 500;
      const message = err instanceof Error ? err.message : "Hotel login failed";
      req.log.error({ err }, "[auth/hotel/login]");
      return reply.code(status).send({ ok: false, error: message });
    }
  });

  /** Re-gate owner JWT onto another property in the same organization (PIN hotel picker). */
  app.post("/v1/auth/hotel/switch-property", async (req, reply) => {
    try {
      assertDb();
      const claims = verifyDeskToken(bearerToken(req.headers.authorization));
      if (!claims || claims.role !== "owner" || !claims.organizationId) {
        return reply.code(401).send({ ok: false, error: "Owner hotel session required to switch hotels" });
      }
      const body = switchBody.parse(req.body ?? {});
      const key = body.propertyId || body.propertySlug;
      if (!key) {
        return reply.code(400).send({ ok: false, error: "propertyId or propertySlug required" });
      }
      const properties = (await queryRaw(
        body.propertyId
          ? `SELECT id, slug, name, organization_id FROM v2.properties
             WHERE id = ${sqlLiteral(body.propertyId!)} LIMIT 1`
          : `SELECT id, slug, name, organization_id FROM v2.properties
             WHERE slug = ${sqlLiteral(body.propertySlug!)} LIMIT 1`,
      )) as PropertyRow[];
      const property = properties?.[0];
      if (!property) {
        return reply.code(404).send({ ok: false, error: "Property not found" });
      }
      if (property.organization_id !== claims.organizationId) {
        return reply.code(403).send({ ok: false, error: "Hotel is outside your organization" });
      }
      if (property.id === claims.propertyId) {
        return {
          ok: true,
          token: bearerToken(req.headers.authorization),
          property: {
            id: property.id,
            slug: property.slug,
            name: property.name,
            organization_id: property.organization_id,
          },
        };
      }
      await queryRaw(
        `UPDATE v2.org_members
         SET last_property_id = ${sqlLiteral(property.id)}
         WHERE auth_user_id = ${sqlLiteral(claims.sub)}
            OR (organization_id = ${sqlLiteral(claims.organizationId)} AND lower(email) = ${sqlLiteral(
              String(claims.staffName ?? "").toLowerCase(),
            )})`,
      );
      const token = issueDeskToken({
        sub: claims.sub,
        role: "owner",
        propertyId: property.id,
        organizationId: claims.organizationId,
        staffName: claims.staffName,
        deskRole: claims.deskRole,
        homeRoute: "/pin",
      });
      return {
        ok: true,
        token,
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
      const message = err instanceof Error ? err.message : "Hotel switch failed";
      req.log.error({ err }, "[auth/hotel/switch-property]");
      return reply.code(status).send({ ok: false, error: message });
    }
  });
}
