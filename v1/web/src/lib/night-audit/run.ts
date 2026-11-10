import "server-only";
import "@/lib/core-runtime";

import {
  executeNightAudit as executeCoreNightAudit,
  type ExecuteNightAuditOptions,
  type ExecuteNightAuditResult,
} from "@hotel-os/core/night-audit/run";
import { deliverHotelBackupPack } from "@/lib/night-audit/deliver-hotel-backup";
import type { createSupabaseAdminClient } from "@/lib/supabase/admin";

/**
 * Night audit moved to `@hotel-os/core/night-audit/run` (shared with Hotel OS
 * v2). Innora injects its hotel backup pack (XLSX + storage + Resend).
 */
export * from "@hotel-os/core/night-audit/run";

type Admin = ReturnType<typeof createSupabaseAdminClient>;

export async function executeNightAudit(
  admin: Admin,
  propertyId: string,
  businessDate: string,
  opts: ExecuteNightAuditOptions,
): Promise<ExecuteNightAuditResult> {
  return executeCoreNightAudit(admin, propertyId, businessDate, {
    ...opts,
    deliverBackup: opts.deliverBackup ?? deliverHotelBackupPack,
  });
}
