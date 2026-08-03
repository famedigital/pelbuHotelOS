import "server-only";
import type { createSupabaseAdminClient } from "@/lib/supabase/admin";

type Admin = ReturnType<typeof createSupabaseAdminClient>;

export type NcDomain =
  | "pos"
  | "room"
  | "spa"
  | "laundry"
  | "guest_service"
  | "meal_plan"
  | "other";

export type NcReasonCode = {
  id: string;
  code: string;
  label: string;
  domains: string[];
  requires_role: "supervisor" | "manager" | "owner";
  active: boolean;
  sort_order: number;
};

export async function listNcReasonCodes(
  admin: Admin,
  propertyId: string,
  domain?: NcDomain,
): Promise<NcReasonCode[]> {
  const { data } = await admin
    .from("nc_reason_codes")
    .select("id, code, label, domains, requires_role, active, sort_order")
    .eq("property_id", propertyId)
    .eq("active", true)
    .order("sort_order")
    .order("code");

  const rows = (data ?? []) as NcReasonCode[];
  if (!domain) return rows;
  return rows.filter(
    (r) =>
      Array.isArray(r.domains) &&
      (r.domains.includes(domain) || r.domains.includes("all")),
  );
}

export async function assertNcReason(
  admin: Admin,
  propertyId: string,
  reasonCode: string,
  domain: NcDomain,
): Promise<NcReasonCode> {
  const code = reasonCode.trim().toLowerCase();
  const { data } = await admin
    .from("nc_reason_codes")
    .select("id, code, label, domains, requires_role, active, sort_order")
    .eq("property_id", propertyId)
    .eq("code", code)
    .eq("active", true)
    .maybeSingle();
  if (!data) throw new Error("NC reason code is invalid or inactive.");
  const row = data as NcReasonCode;
  const domains = Array.isArray(row.domains) ? row.domains : [];
  if (!domains.includes(domain) && !domains.includes("all")) {
    throw new Error(`NC reason is not allowed for ${domain}.`);
  }
  return row;
}

export async function recordNcEvent(
  admin: Admin,
  args: {
    propertyId: string;
    domain: NcDomain;
    reasonCode: string;
    listValueBtn: number;
    orderId?: string | null;
    orderItemId?: string | null;
    bookingId?: string | null;
    roomAssignmentId?: string | null;
    folioId?: string | null;
    businessDate?: string | null;
    description?: string | null;
    approvedBy?: string | null;
    createdBy?: string;
  },
): Promise<void> {
  const { error } = await admin.from("nc_events").insert({
    property_id: args.propertyId,
    domain: args.domain,
    reason_code: args.reasonCode,
    list_value_btn: Math.max(0, Number(args.listValueBtn) || 0),
    order_id: args.orderId ?? null,
    order_item_id: args.orderItemId ?? null,
    booking_id: args.bookingId ?? null,
    room_assignment_id: args.roomAssignmentId ?? null,
    folio_id: args.folioId ?? null,
    business_date: args.businessDate ?? null,
    description: args.description ?? null,
    approved_by: args.approvedBy ?? null,
    created_by: args.createdBy ?? "desk",
  });
  if (error) {
    console.error("recordNcEvent failed", error);
    throw new Error("Could not record NC event.");
  }
}
