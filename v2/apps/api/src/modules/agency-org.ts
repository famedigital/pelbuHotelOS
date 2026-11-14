/**
 * M01 — agency.org.* commands (Travel Agent OS tenant).
 */
import {
  agencyOrgIdFromActor,
  permission,
} from "@hos-v2/domain";
import { queryRaw, requireDb } from "@hos-v2/db";
import { z } from "zod";
import {
  assertPermission,
  type CommandResult,
} from "../platform/command.js";
import { registerCommand } from "./registry.js";

function sqlUuid(id: string): string | null {
  const parsed = z.string().uuid().safeParse(id);
  if (!parsed.success) return null;
  return parsed.data.replace(/'/g, "''");
}

type OrgRow = {
  id: string;
  slug: string;
  name: string;
  status: string;
};

registerCommand("agency.org.get", async (_raw, ctx) => {
  const denied = assertPermission(ctx.actor, permission("agency", "org.read"));
  if (denied) return denied;

  let orgId: string;
  try {
    orgId = agencyOrgIdFromActor(ctx.actor);
  } catch {
    return {
      ok: false,
      error: "No agency organisation on session",
      code: "NO_AGENCY_ORG",
    } satisfies CommandResult<never>;
  }

  const safeId = sqlUuid(orgId);
  if (!safeId) {
    return { ok: false, error: "Invalid agency org id", code: "VALIDATION" };
  }

  const dbGate = requireDb();
  if (!dbGate.ok) {
    return { ok: false, error: "DATABASE_REQUIRED", code: "DATABASE_REQUIRED" };
  }

  const rows = (await queryRaw(
    `SELECT id::text AS id, slug, name, status
     FROM v2.agency_orgs
     WHERE id = '${safeId}'::uuid
     LIMIT 1`,
  )) as OrgRow[];
  const org = rows[0];
  if (!org) {
    return { ok: false, error: "Agency org not found", code: "NOT_FOUND" };
  }
  if (org.status !== "active") {
    return { ok: false, error: "Agency org suspended", code: "ORG_SUSPENDED" };
  }

  ctx.audit({
    action: "agency.org.get",
    entityType: "agency_org",
    entityId: org.id,
  });

  return {
    ok: true,
    data: {
      id: org.id,
      slug: org.slug,
      name: org.name,
      status: org.status as "active" | "suspended",
    },
  };
});

registerCommand("agency.org.members.list", async (_raw, ctx) => {
  const denied = assertPermission(
    ctx.actor,
    permission("agency", "members.read"),
  );
  if (denied) return denied;

  let orgId: string;
  try {
    orgId = agencyOrgIdFromActor(ctx.actor);
  } catch {
    return {
      ok: false,
      error: "No agency organisation on session",
      code: "NO_AGENCY_ORG",
    };
  }

  const safeId = sqlUuid(orgId);
  if (!safeId) {
    return { ok: false, error: "Invalid agency org id", code: "VALIDATION" };
  }

  const dbGate = requireDb();
  if (!dbGate.ok) {
    return { ok: false, error: "DATABASE_REQUIRED", code: "DATABASE_REQUIRED" };
  }

  type MemberRow = {
    id: string;
    display_name: string;
    role: string;
    status: string;
    is_primary: boolean;
  };
  const members = (await queryRaw(
    `SELECT id::text AS id, display_name, role, status, is_primary
     FROM v2.agency_members
     WHERE agency_org_id = '${safeId}'::uuid
     ORDER BY is_primary DESC, display_name ASC`,
  )) as MemberRow[];

  return {
    ok: true,
    data: {
      members: members.map((m) => ({
        id: m.id,
        displayName: m.display_name,
        role: m.role,
        status: m.status,
        isPrimary: m.is_primary,
      })),
    },
  };
});

registerCommand("agency.org.hotelLinks.list", async (_raw, ctx) => {
  const denied = assertPermission(
    ctx.actor,
    permission("agency", "hotelLinks.read"),
  );
  if (denied) return denied;

  let orgId: string;
  try {
    orgId = agencyOrgIdFromActor(ctx.actor);
  } catch {
    return {
      ok: false,
      error: "No agency organisation on session",
      code: "NO_AGENCY_ORG",
    };
  }

  const safeId = sqlUuid(orgId);
  if (!safeId) {
    return { ok: false, error: "Invalid agency org id", code: "VALIDATION" };
  }

  const dbGate = requireDb();
  if (!dbGate.ok) {
    return { ok: false, error: "DATABASE_REQUIRED", code: "DATABASE_REQUIRED" };
  }

  type LinkRow = {
    property_id: string;
    property_name: string;
    agent_id: string;
    status: string;
  };
  const links = (await queryRaw(
    `SELECT
       l.property_id::text AS property_id,
       p.name AS property_name,
       l.agent_id::text AS agent_id,
       l.status
     FROM v2.agency_org_hotel_links l
     JOIN v2.properties p ON p.id = l.property_id
     WHERE l.agency_org_id = '${safeId}'::uuid AND l.status = 'active'
     ORDER BY p.name ASC`,
  )) as LinkRow[];

  return {
    ok: true,
    data: {
      links: links.map((l) => ({
        propertyId: l.property_id,
        propertyName: l.property_name,
        agentId: l.agent_id,
        status: "active" as const,
      })),
    },
  };
});
