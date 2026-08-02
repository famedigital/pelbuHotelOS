"use server";

import { writeAuditEvent } from "@/lib/audit";
import { isDeskAuthenticated } from "@/lib/desk-auth";
import { requireDeskPropertyId } from "@/lib/desk-property";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { optionalTrim, trimRequired } from "@/lib/validation";
import { revalidatePath } from "next/cache";

export type RatePlanState = {
  ok: boolean;
  error?: string;
  planId?: string;
};

async function requireDesk() {
  if (!(await isDeskAuthenticated())) {
    throw new Error("Desk session expired. Sign in again.");
  }
}

export async function upsertRatePlan(
  _prev: RatePlanState,
  formData: FormData,
): Promise<RatePlanState> {
  try {
    await requireDesk();
    const admin = createSupabaseAdminClient();
    const propertyId = await requireDeskPropertyId();

    const planId = optionalTrim(formData.get("plan_id"));
    const code = trimRequired(formData.get("code"), "Code").toUpperCase();
    const name = trimRequired(formData.get("name"), "Name");
    const roomTypeId = optionalTrim(formData.get("room_type_id"));
    const seasonKind = optionalTrim(formData.get("season_kind"));
    const rateTier = optionalTrim(formData.get("rate_tier"));
    const amountRaw = optionalTrim(formData.get("base_amount_btn"));
    const notes = optionalTrim(formData.get("notes"));
    const active = formData.get("active") !== "off";

    const baseAmount =
      amountRaw == null || amountRaw === ""
        ? null
        : Number(amountRaw);
    if (baseAmount != null && (Number.isNaN(baseAmount) || baseAmount < 0)) {
      throw new Error("Base amount must be a non-negative number.");
    }

    const payload = {
      property_id: propertyId,
      code,
      name,
      room_type_id: roomTypeId,
      season_kind: seasonKind,
      rate_tier: rateTier,
      base_amount_btn: baseAmount,
      notes,
      active,
      updated_at: new Date().toISOString(),
    };

    let id = planId;
    if (planId) {
      const { error } = await admin
        .from("rate_plans")
        .update(payload)
        .eq("id", planId)
        .eq("property_id", propertyId);
      if (error) throw new Error(error.message);
    } else {
      const { data, error } = await admin
        .from("rate_plans")
        .insert(payload)
        .select("id")
        .single();
      if (error || !data) throw new Error(error?.message ?? "Insert failed.");
      id = data.id as string;
    }

    await writeAuditEvent(admin, {
      propertyId,
      action: planId ? "rate_plan.update" : "rate_plan.create",
      entityType: "rate_plans",
      entityId: id!,
      summary: `${planId ? "Updated" : "Created"} rate plan ${code}`,
    });

    revalidatePath("/erp/rate-plans");
    revalidatePath("/erp/rates");
    return { ok: true, planId: id! };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Something went wrong.",
    };
  }
}

export async function deactivateRatePlan(
  _prev: RatePlanState,
  formData: FormData,
): Promise<RatePlanState> {
  try {
    await requireDesk();
    const admin = createSupabaseAdminClient();
    const propertyId = await requireDeskPropertyId();
    const planId = trimRequired(formData.get("plan_id"), "Plan");

    const { error } = await admin
      .from("rate_plans")
      .update({ active: false, updated_at: new Date().toISOString() })
      .eq("id", planId)
      .eq("property_id", propertyId);
    if (error) throw new Error(error.message);

    revalidatePath("/erp/rate-plans");
    revalidatePath("/erp/rates");
    return { ok: true, planId };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Something went wrong.",
    };
  }
}
