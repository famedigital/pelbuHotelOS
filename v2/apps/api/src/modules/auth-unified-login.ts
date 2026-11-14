/**
 * Single sign-in: GoTrue → resolve hotel | agent | guide | driver → desk JWT.
 */
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { queryRaw, requireDb } from "@hos-v2/db";
import {
  defaultPortalHomeRoute,
  resolveUnifiedLoginKind,
} from "@hos-v2/domain";
import { resolveAgencyOrgIdForAuthUser } from "../platform/agency-membership.js";
import { issueDeskToken } from "../platform/desk-token.js";
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
  password: z.string().min(4).max(128),
  propertyId: z.string().uuid().optional(),
});

type MemberRow = {
  organization_id: string;
  auth_user_id: string;
  email: string;
  role: string;
  last_property_id: string | null;
};

type PropertyRow = { id: string; slug: string; name: string; organization_id: string };

type PortalRow = {
  id: string;
  property_id: string;
  subject_id: string;
  login_code: string;
  display_name: string;
  home_route: string;
  slug: string;
  name: string;
  role: string;
};

type AgentRow = {
  id: string;
  company_name: string;
  login_code: string | null;
  contact_email: string | null;
  auth_user_id: string | null;
};

function preferPortalProperty(
  portals: PortalRow[],
  propertyId?: string,
): PortalRow {
  if (propertyId) {
    const hit = portals.find((p) => p.property_id === propertyId);
    if (hit) return hit;
  }
  const live = portals.filter((p) => {
    const slug = p.slug.toLowerCase();
    const name = p.name.toLowerCase();
    if (slug === "demo-hotel" || name === "demo" || name === "demo hotel") return false;
    if (slug.includes("seed") || name.includes("seed archive")) return false;
    return true;
  });
  const pool = live.length > 0 ? live : portals;
  return (
    pool.find((p) => p.slug === "pelbu-olakha") ||
    pool.find((p) => /pelbu/i.test(p.slug) || /pelbu/i.test(p.name)) ||
    pool[0]!
  );
}

function livePortalList(portals: PortalRow[]): PortalRow[] {
  const live = portals.filter((p) => {
    const slug = p.slug.toLowerCase();
    const name = p.name.toLowerCase();
    if (slug === "demo-hotel" || name === "demo" || name === "demo hotel") return false;
    if (slug.includes("seed") || name.includes("seed archive")) return false;
    return true;
  });
  return live.length > 0 ? live : portals;
}

async function loadAgentPortals(
  authUserId: string,
  email: string,
): Promise<{ agent: AgentRow | null; portals: PortalRow[] }> {
  const agents = (await queryRaw(
    `SELECT id::text, company_name, login_code, contact_email, auth_user_id::text
     FROM public.agents
     WHERE can_login = true
       AND (
         auth_user_id = ${sqlLiteral(authUserId)}::uuid
         OR lower(contact_email) = ${sqlLiteral(email)}
       )
     LIMIT 5`,
  )) as AgentRow[];
  const agent = agents?.[0] ?? null;
  if (!agent) return { agent: null, portals: [] };

  let portals = (await queryRaw(
    `SELECT pa.id::text, pa.property_id::text, pa.subject_id::text,
            pa.login_code, pa.display_name, pa.home_route, pa.role::text,
            p.slug, p.name
     FROM v2.portal_accounts pa
     JOIN v2.properties p ON p.id = pa.property_id
     WHERE pa.role = 'agent'
       AND pa.active = true
       AND (
         pa.subject_id = ${sqlLiteral(agent.id)}::uuid
         OR upper(pa.login_code) = upper(${sqlLiteral(agent.login_code || "")})
       )
     ORDER BY p.name`,
  )) as PortalRow[];

  if (!portals?.length && agent.login_code) {
    portals = (await queryRaw(
      `SELECT a.id::text AS id,
              a.property_id::text,
              ${sqlLiteral(agent.id)} AS subject_id,
              a.code AS login_code,
              a.name AS display_name,
              '/partner'::text AS home_route,
              'agent'::text AS role,
              p.slug, p.name
       FROM v2.agents a
       JOIN v2.properties p ON p.id = a.property_id
       WHERE upper(a.code) = upper(${sqlLiteral(agent.login_code)})
       ORDER BY p.name`,
    )) as PortalRow[];
  }

  return { agent, portals: portals ?? [] };
}

async function loadFieldPortals(
  role: "guide" | "driver",
  email: string,
): Promise<PortalRow[]> {
  const local = email.split("@")[0] || email;
  return ((await queryRaw(
    `SELECT pa.id::text, pa.property_id::text, pa.subject_id::text,
            pa.login_code, pa.display_name, pa.home_route, pa.role::text,
            p.slug, p.name
     FROM v2.portal_accounts pa
     JOIN v2.properties p ON p.id = pa.property_id
     WHERE pa.role = ${sqlLiteral(role)}
       AND pa.active = true
       AND (
         lower(pa.login_code) = ${sqlLiteral(email)}
         OR lower(pa.login_code) = ${sqlLiteral(local)}
         OR lower(pa.display_name) = ${sqlLiteral(email)}
       )
     ORDER BY p.name`,
  )) as PortalRow[]) ?? [];
}

export async function registerAuthUnifiedLoginRoutes(app: FastifyInstance) {
  app.post("/v1/auth/login", async (req, reply) => {
    try {
      assertDb();
      const body = loginBody.parse(req.body);
      const email = body.email.trim().toLowerCase();

      const auth = await gotrueSignInWithPassword(email, body.password);
      if (!auth.ok) {
        req.log.warn({ status: auth.status, err: auth.error }, "[auth/login] gotrue");
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
      const member = members?.[0] ?? null;

      const { agent, portals: agentPortals } = await loadAgentPortals(userId, email);
      const guidePortals = await loadFieldPortals("guide", email);
      const driverPortals = await loadFieldPortals("driver", email);

      const kind = resolveUnifiedLoginKind({
        isOrgMember: Boolean(member),
        isAgent: Boolean(agent) && agentPortals.length > 0,
        isGuide: guidePortals.length > 0,
        isDriver: driverPortals.length > 0,
      });

      // Agent row without hotel links still counts as agent attempt → clearer error below
      const kindWithAgentHint =
        kind === "none" && agent
          ? resolveUnifiedLoginKind({
              isOrgMember: false,
              isAgent: true,
              isGuide: false,
              isDriver: false,
            })
          : kind;

      if (kindWithAgentHint === "hotel" && member) {
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
        if (!properties?.length) {
          return reply.code(404).send({ ok: false, error: "No live properties for this organization" });
        }

        const last =
          member.last_property_id
            ? properties.find((p) => p.id === member.last_property_id)
            : undefined;
        const property =
          (body.propertyId
            ? properties.find((p) => p.id === body.propertyId)
            : undefined) ||
          last ||
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
          kind: "hotel" as const,
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
      }

      if (kindWithAgentHint === "agent") {
        if (!agentPortals.length) {
          return reply.code(404).send({
            ok: false,
            error: "No hotel links for this portal account",
          });
        }
        const chosen = preferPortalProperty(agentPortals, body.propertyId);
        const homeRoute = chosen.home_route || defaultPortalHomeRoute("agent");
        const agencyOrgId = await resolveAgencyOrgIdForAuthUser(userId);
        const token = issueDeskToken({
          sub: userId,
          role: "agent",
          propertyId: chosen.property_id,
          portalAccountId: chosen.id,
          subjectId: chosen.subject_id,
          staffName: chosen.display_name,
          homeRoute,
          ...(agencyOrgId ? { agencyOrgId } : {}),
        });
        const propertyList = livePortalList(agentPortals);
        return {
          ok: true,
          kind: "portal" as const,
          role: "agent" as const,
          token,
          homeRoute,
          account: {
            id: chosen.id,
            role: "agent" as const,
            loginCode: chosen.login_code,
            displayName: chosen.display_name,
            subjectId: chosen.subject_id,
            email,
            homeRoute,
          },
          property: {
            id: chosen.property_id,
            slug: chosen.slug,
            name: chosen.name,
          },
          properties: propertyList.map((p) => ({
            id: p.property_id,
            slug: p.slug,
            name: p.name,
          })),
        };
      }

      if (kindWithAgentHint === "guide" || kindWithAgentHint === "driver") {
        const role = kindWithAgentHint;
        const portals = role === "guide" ? guidePortals : driverPortals;
        const chosen = preferPortalProperty(portals, body.propertyId);
        const homeRoute = chosen.home_route || defaultPortalHomeRoute(role);
        const token = issueDeskToken({
          sub: userId,
          role,
          propertyId: chosen.property_id,
          portalAccountId: chosen.id,
          subjectId: chosen.subject_id,
          staffName: chosen.display_name,
          homeRoute,
        });
        const propertyList = livePortalList(portals);
        return {
          ok: true,
          kind: "portal" as const,
          role,
          token,
          homeRoute,
          account: {
            id: chosen.id,
            role,
            loginCode: chosen.login_code,
            displayName: chosen.display_name,
            subjectId: chosen.subject_id,
            email,
            homeRoute,
          },
          property: {
            id: chosen.property_id,
            slug: chosen.slug,
            name: chosen.name,
          },
          properties: propertyList.map((p) => ({
            id: p.property_id,
            slug: p.slug,
            name: p.name,
          })),
        };
      }

      return reply.code(403).send({
        ok: false,
        error: "No Hotel OS access for this account",
      });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return reply.code(400).send({ ok: false, error: err.issues[0]?.message ?? "Invalid body" });
      }
      const status = (err as { statusCode?: number }).statusCode ?? 500;
      const message = err instanceof Error ? err.message : "Login failed";
      req.log.error({ err }, "[auth/login]");
      return reply.code(status).send({ ok: false, error: message });
    }
  });
}
