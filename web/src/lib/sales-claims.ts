import "server-only";
import type { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { optionalTrim } from "@/lib/validation";

type Admin = ReturnType<typeof createSupabaseAdminClient>;

export type SalesClaimStatus = "claimed" | "approved" | "rejected";

export type BookableStaff = {
  id: string;
  full_name: string;
  employee_code?: string | null;
  role_label?: string | null;
};

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type SalesClaimExisting = {
  sold_by_staff_id: string | null;
  sales_claim_status: string | null;
};

/** FormData / free text → staff UUID for this property (active/on_leave + can login or desk). */
export async function resolveSoldByStaffId(
  admin: Admin,
  propertyId: string,
  raw: FormDataEntryValue | string | null | undefined,
): Promise<string | null> {
  const id =
    typeof raw === "string"
      ? raw.trim() || null
      : optionalTrim(raw ?? null);
  if (!id) return null;
  if (!UUID_RE.test(id)) throw new Error("Invalid sold-by staff.");

  const { data } = await admin
    .from("staff_members")
    .select("id, status, can_access_desk, can_login")
    .eq("id", id)
    .eq("property_id", propertyId)
    .maybeSingle();

  if (!data) throw new Error("Staff member not found at this property.");
  if (!["active", "on_leave"].includes(data.status as string)) {
    throw new Error("Staff member is not active.");
  }
  return data.id as string;
}

/**
 * Patch fields when setting or clearing sold_by_staff.
 * Clearing an approved claim is blocked (GM must reject first).
 * Changing staff after approval re-opens as claimed.
 */
export function buildSalesClaimWrite(
  soldByStaffId: string | null,
  existing?: SalesClaimExisting | null,
): {
  sold_by_staff_id: string | null;
  sales_claim_status: SalesClaimStatus | null;
  sales_verified_by_staff_id: null;
  sales_verified_at: null;
  sales_claim_note: null;
} | {
  sold_by_staff_id: string | null;
  sales_claim_status?: undefined;
} {
  if (!soldByStaffId) {
    if (existing?.sales_claim_status === "approved") {
      throw new Error(
        "Clearing an approved sales claim is not allowed. Owner/GM must reject first.",
      );
    }
    return {
      sold_by_staff_id: null,
      sales_claim_status: null,
      sales_verified_by_staff_id: null,
      sales_verified_at: null,
      sales_claim_note: null,
    };
  }

  if (
    existing?.sold_by_staff_id === soldByStaffId &&
    existing?.sales_claim_status === "approved"
  ) {
    return { sold_by_staff_id: soldByStaffId };
  }

  return {
    sold_by_staff_id: soldByStaffId,
    sales_claim_status: "claimed",
    sales_verified_by_staff_id: null,
    sales_verified_at: null,
    sales_claim_note: null,
  };
}

/** Insert-time fields (new booking). */
export function buildSalesClaimInsert(soldByStaffId: string | null): {
  sold_by_staff_id: string | null;
  sales_claim_status: SalesClaimStatus | null;
} {
  if (!soldByStaffId) {
    return { sold_by_staff_id: null, sales_claim_status: null };
  }
  return { sold_by_staff_id: soldByStaffId, sales_claim_status: "claimed" };
}

export function commissionBtnFromQuote(
  quotedTotalBtn: number | null | undefined,
  commissionPct: number | null | undefined,
): number {
  const total = Number(quotedTotalBtn ?? 0);
  const pct = commissionPct == null ? null : Number(commissionPct);
  if (!Number.isFinite(total) || total <= 0) return 0;
  if (pct == null || !Number.isFinite(pct) || pct <= 0) return 0;
  return Math.round(((total * pct) / 100) * 100) / 100;
}

export async function loadBookableStaff(
  admin: Admin,
  propertyId: string,
): Promise<BookableStaff[]> {
  const { data } = await admin
    .from("staff_members")
    .select("id, full_name, employee_code, role_label, status")
    .eq("property_id", propertyId)
    .in("status", ["active", "on_leave"])
    .order("full_name")
    .limit(300);
  return (data ?? []).map((r) => ({
    id: r.id as string,
    full_name: (r.full_name as string) || "Staff",
    employee_code: (r.employee_code as string | null) ?? null,
    role_label: (r.role_label as string | null) ?? null,
  }));
}

export async function loadStaffSalesCommissionPct(
  admin: Admin,
  propertyId: string,
): Promise<number | null> {
  const { data } = await admin
    .from("property_policies")
    .select("staff_sales_commission_pct")
    .eq("property_id", propertyId)
    .maybeSingle();
  if (data?.staff_sales_commission_pct == null) return null;
  const n = Number(data.staff_sales_commission_pct);
  return Number.isFinite(n) ? n : null;
}
