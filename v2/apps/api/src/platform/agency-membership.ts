/** Resolve Travel Agent OS org for a GoTrue user (M01). */
import { queryRaw } from "@hos-v2/db";
import { z } from "zod";

export async function resolveAgencyOrgIdForAuthUser(
  authUserId: string,
): Promise<string | undefined> {
  const parsed = z.string().uuid().safeParse(authUserId);
  if (!parsed.success) return undefined;
  const safe = parsed.data.replace(/'/g, "''");
  try {
    const rows = (await queryRaw(
      `SELECT agency_org_id::text AS id
       FROM v2.agency_members
       WHERE auth_user_id = '${safe}'::uuid
         AND status = 'active'
       ORDER BY is_primary DESC, created_at ASC
       LIMIT 1`,
    )) as Array<{ id: string }>;
    return rows[0]?.id;
  } catch {
    /* Table may not be migrated yet on older droplets. */
    return undefined;
  }
}
