/**
 * Agent / guide / driver email+password → multi-hotel portal JWT.
 * Agents resolve via public.agents (auth_user_id / contact_email) + v2.portal_accounts.
 */
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { queryRaw, requireDb } from "@hos-v2/db";
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
  role: z.enum(["agent", "guide", "driver"]),
  email: z.string().email(),
  password: z.string().min(4).max(128),
  propertyId: z.string().uuid().optional(),
});

type PortalRow = {
  id: string;
  property_id: string;
  subject_id: string;
  login_code: string;
  display_name: string;
  home_route: string;
  slug: string;
  name: string;
};

type AgentRow = {
  id: string;
  company_name: string;
  login_code: string | null;
  contact_email: string | null;
  auth_user_id: string | null;
};

export async function registerAuthPortalEmailRoutes(app: FastifyInstance) {
  app.post("/v1/auth/portal/email-login", async (req, reply) => {
    try {
      assertDb();
      const body = loginBody.parse(req.body);
      const email = body.email.trim().toLowerCase();

      const auth = await gotrueSignInWithPassword(email, body.password);
      if (!auth.ok) {
        return reply.code(auth.status).send({ ok: false, error: auth.error });
      }

      let portals: PortalRow[] = [];

      if (body.role === "agent") {
        const agents = (await queryRaw(
          `SELECT id::text, company_name, login_code, contact_email, auth_user_id::text
           FROM public.agents
           WHERE can_login = true
             AND (
               auth_user_id = ${sqlLiteral(auth.user.id)}::uuid
               OR lower(contact_email) = ${sqlLiteral(email)}
             )
           LIMIT 5`,
        )) as AgentRow[];
        const agent = agents?.[0];
        if (!agent) {
          const hotelMembers = (await queryRaw(
            `SELECT 1
             FROM v2.org_members
             WHERE auth_user_id = ${sqlLiteral(auth.user.id)}::uuid
                OR lower(email) = ${sqlLiteral(email)}
             LIMIT 1`,
          )) as unknown[];
          if (hotelMembers?.length) {
            return reply.code(403).send({
              ok: false,
              error: "This email is a hotel desk account. Open Hotel desk sign-in (not Partner).",
            });
          }
          return reply.code(403).send({
            ok: false,
            error: "No tour-operator portal for this email",
          });
        }

        portals = (await queryRaw(
          `SELECT pa.id::text, pa.property_id::text, pa.subject_id::text,
                  pa.login_code, pa.display_name, pa.home_route,
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

        // Fallback: MoU / property links → invent portal rows from v2.agents by code
        if (!portals?.length && agent.login_code) {
          portals = (await queryRaw(
            `SELECT a.id::text AS id,
                    a.property_id::text,
                    ${sqlLiteral(agent.id)} AS subject_id,
                    a.code AS login_code,
                    a.name AS display_name,
                    '/partner'::text AS home_route,
                    p.slug, p.name
             FROM v2.agents a
             JOIN v2.properties p ON p.id = a.property_id
             WHERE upper(a.code) = upper(${sqlLiteral(agent.login_code)})
             ORDER BY p.name`,
          )) as PortalRow[];
        }
      } else {
        // Guide / driver: match portal_accounts by email in display or linked auth later.
        // Prefer portal rows whose login_code equals local-part or full email prefix.
        const local = email.split("@")[0] || email;
        portals = (await queryRaw(
          `SELECT pa.id::text, pa.property_id::text, pa.subject_id::text,
                  pa.login_code, pa.display_name, pa.home_route,
                  p.slug, p.name
           FROM v2.portal_accounts pa
           JOIN v2.properties p ON p.id = pa.property_id
           WHERE pa.role = ${sqlLiteral(body.role)}
             AND pa.active = true
             AND (
               lower(pa.login_code) = ${sqlLiteral(email)}
               OR lower(pa.login_code) = ${sqlLiteral(local)}
               OR lower(pa.display_name) = ${sqlLiteral(email)}
             )
           ORDER BY p.name`,
        )) as PortalRow[];
      }

      if (!portals?.length) {
        return reply.code(404).send({
          ok: false,
          error: "No hotel links for this portal account",
        });
      }

      const chosen =
        (body.propertyId
          ? portals.find((p) => p.property_id === body.propertyId)
          : undefined) || portals[0]!;

      const token = issueDeskToken({
        sub: auth.user.id,
        role: body.role,
        propertyId: chosen.property_id,
        portalAccountId: chosen.id,
        subjectId: chosen.subject_id,
        staffName: chosen.display_name,
        homeRoute: chosen.home_route || "/partner",
      });

      return {
        ok: true,
        token,
        homeRoute: chosen.home_route || "/partner",
        account: {
          id: chosen.id,
          role: body.role,
          loginCode: chosen.login_code,
          displayName: chosen.display_name,
          subjectId: chosen.subject_id,
          email,
        },
        property: {
          id: chosen.property_id,
          slug: chosen.slug,
          name: chosen.name,
        },
        properties: portals.map((p) => ({
          id: p.property_id,
          slug: p.slug,
          name: p.name,
        })),
      };
    } catch (err) {
      if (err instanceof z.ZodError) {
        return reply.code(400).send({ ok: false, error: err.issues[0]?.message ?? "Invalid body" });
      }
      const status = (err as { statusCode?: number }).statusCode ?? 500;
      const message = err instanceof Error ? err.message : "Portal login failed";
      req.log.error({ err }, "[auth/portal/email-login]");
      return reply.code(status).send({ ok: false, error: message });
    }
  });
}
