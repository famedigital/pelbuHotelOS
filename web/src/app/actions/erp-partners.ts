"use server";

import { writeAuditEvent } from "@/lib/audit";
import { requireMoneyDesk } from "@/lib/desk-auth";
import { resolveActivePropertyId } from "@/lib/property-context";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { optionalTrim, trimRequired } from "@/lib/validation";
import { revalidatePath } from "next/cache";

export type PartnerDiscountState = {
  ok: boolean;
  error?: string;
  message?: string;
};

export async function setPartnerDiscount(
  _prev: PartnerDiscountState,
  formData: FormData,
): Promise<PartnerDiscountState> {
  try {
    await requireMoneyDesk();
    const admin = createSupabaseAdminClient();
    const pid = await resolveActivePropertyId(admin);
    const kind = trimRequired(formData.get("kind"), "Kind");
    if (kind !== "guide" && kind !== "driver") {
      throw new Error("Kind must be guide or driver.");
    }
    const partnerId = trimRequired(formData.get("partner_id"), "Partner");
    const pctRaw = optionalTrim(formData.get("discount_pct")) ?? "0";
    const discountPct = Number(pctRaw);
    if (!Number.isFinite(discountPct) || discountPct < 0 || discountPct > 100) {
      throw new Error("Discount must be 0–100%.");
    }

    const table = kind === "guide" ? "guides" : "drivers";
    const { data: row } = await admin
      .from(table)
      .select("id, property_id, full_name")
      .eq("id", partnerId)
      .eq("property_id", pid)
      .maybeSingle();
    if (!row) throw new Error("Partner not found.");

    const { error } = await admin
      .from(table)
      .update({ discount_pct: discountPct })
      .eq("id", partnerId)
      .eq("property_id", pid);
    if (error) throw new Error("Could not save discount.");

    await writeAuditEvent(admin, {
      propertyId: pid,
      action: `${kind}.discount_set`,
      entityType: table,
      entityId: partnerId,
      summary: `${row.full_name as string} · discount ${discountPct}%`,
    });

    revalidatePath("/erp/partners");
    return { ok: true, message: `Discount set to ${discountPct}%.` };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed." };
  }
}
