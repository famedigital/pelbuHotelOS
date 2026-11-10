import type { createSupabaseAdminClient } from "@/lib/supabase/admin";

type Admin = ReturnType<typeof createSupabaseAdminClient>;

export type TenantBillingStatus =
  | "trial"
  | "invoice"
  | "active"
  | "past_due"
  | "cancelled";

export type TenantPlan = "starter" | "hotel" | "chain" | "flagship";

export type TenantRow = {
  id: string;
  name: string;
  slug: string;
  plan: TenantPlan;
  seat_limit: number;
  seats_used: number;
  billing_status: TenantBillingStatus;
  billing_notes: string | null;
  billing_email: string | null;
  domain_verify_token: string | null;
  domain_verified_at: string | null;
};

/** Load the SaaS tenant attached to a property, if any. */
export async function loadTenantForProperty(
  admin: Admin,
  propertyId: string,
): Promise<TenantRow | null> {
  const { data: property } = await admin
    .from("properties")
    .select("tenant_id")
    .eq("id", propertyId)
    .maybeSingle();
  const tenantId = property?.tenant_id as string | null | undefined;
  if (!tenantId) return null;

  const { data } = await admin
    .from("tenants")
    .select(
      "id, name, slug, plan, seat_limit, seats_used, billing_status, billing_notes, billing_email, domain_verify_token, domain_verified_at",
    )
    .eq("id", tenantId)
    .maybeSingle();
  if (!data) return null;

  return {
    id: data.id as string,
    name: data.name as string,
    slug: data.slug as string,
    plan: data.plan as TenantPlan,
    seat_limit: Number(data.seat_limit ?? 10),
    seats_used: Number(data.seats_used ?? 0),
    billing_status: data.billing_status as TenantBillingStatus,
    billing_notes: (data.billing_notes as string | null) ?? null,
    billing_email: (data.billing_email as string | null) ?? null,
    domain_verify_token: (data.domain_verify_token as string | null) ?? null,
    domain_verified_at: (data.domain_verified_at as string | null) ?? null,
  };
}
