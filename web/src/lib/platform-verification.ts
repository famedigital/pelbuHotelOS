import "server-only";

import type { createSupabaseAdminClient } from "@/lib/supabase/admin";

type Admin = ReturnType<typeof createSupabaseAdminClient>;

export type VerificationEntityType = "agent" | "guide";

export async function enqueuePlatformVerification(
  admin: Admin,
  args: {
    entityType: VerificationEntityType;
    entityId: string;
    propertyId?: string | null;
    submittedBy?: string | null;
    payload?: Record<string, unknown>;
  },
): Promise<void> {
  const { error } = await admin.from("platform_verification_queue").insert({
    entity_type: args.entityType,
    entity_id: args.entityId,
    property_id: args.propertyId ?? null,
    submitted_by: args.submittedBy ?? null,
    status: "open",
    payload: args.payload ?? {},
  });
  if (error) {
    console.error("platform_verification_queue insert failed", error);
    throw new Error("Could not notify platform for verification.");
  }
}

export async function resolveOpenVerificationItems(
  admin: Admin,
  args: {
    entityType: VerificationEntityType;
    entityId: string;
    status: "verified" | "rejected" | "dismissed";
    resolvedByEmail: string;
    notes?: string | null;
  },
): Promise<void> {
  const { error } = await admin
    .from("platform_verification_queue")
    .update({
      status: args.status,
      resolved_at: new Date().toISOString(),
      resolved_by_email: args.resolvedByEmail,
      notes: args.notes ?? null,
    })
    .eq("entity_type", args.entityType)
    .eq("entity_id", args.entityId)
    .eq("status", "open");
  if (error) {
    console.error("platform_verification_queue resolve failed", error);
    throw new Error("Could not update verification queue.");
  }
}

export async function countOpenVerifications(admin: Admin): Promise<number> {
  const { count, error } = await admin
    .from("platform_verification_queue")
    .select("id", { count: "exact", head: true })
    .eq("status", "open");
  if (error) return 0;
  return count ?? 0;
}
