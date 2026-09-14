import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type Admin = ReturnType<typeof createSupabaseAdminClient>;

export type AuditWrite = {
  propertyId: string;
  action: string;
  entityType: string;
  entityId?: string | null;
  summary: string;
  meta?: Record<string, unknown>;
  actor?: string;
};

/** Best-effort audit insert — never throws into the money path. */
export async function writeAuditEvent(
  admin: Admin,
  event: AuditWrite,
): Promise<void> {
  try {
    const { error } = await admin.from("audit_events").insert({
      property_id: event.propertyId,
      actor: event.actor ?? "desk",
      action: event.action,
      entity_type: event.entityType,
      entity_id: event.entityId ?? null,
      summary: event.summary,
      meta: event.meta ?? {},
    });
    if (error) {
      console.error("audit_events insert failed", error);
    }
  } catch (err) {
    console.error("audit_events insert threw", err);
  }
}
