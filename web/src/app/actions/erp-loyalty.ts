"use server";

import type { PropertyWizardState } from "@/app/actions/erp-properties";
import { requireMoneyDesk } from "@/lib/desk-auth";
import { assertDeskProperty } from "@/lib/desk/property-guard";
import {
  ensureLoyaltyAccount,
  postLoyaltyPoints,
} from "@/lib/loyalty/points";
import { resolveActivePropertyId } from "@/lib/property-context";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { optionalTrim, trimRequired } from "@/lib/validation";
import { revalidatePath } from "next/cache";

export async function adjustLoyaltyPoints(
  _prev: PropertyWizardState,
  formData: FormData,
): Promise<PropertyWizardState> {
  try {
    await requireMoneyDesk();
    const admin = createSupabaseAdminClient();
    const propertyId = await resolveActivePropertyId(admin);
    const formProperty = trimRequired(formData.get("property_id"), "Property");
    assertDeskProperty(propertyId, formProperty, "Property");

    const phone = trimRequired(formData.get("contact_phone"), "Phone");
    const delta = Number(trimRequired(formData.get("delta_points"), "Points"));
    if (!Number.isInteger(delta) || delta === 0) {
      throw new Error("Points must be a non-zero integer.");
    }
    const reason =
      optionalTrim(formData.get("reason")) ??
      (delta > 0 ? "desk_adjust_credit" : "desk_adjust_debit");
    const displayName = optionalTrim(formData.get("display_name"));

    const account = await ensureLoyaltyAccount(admin, {
      propertyId,
      contactPhone: phone,
      displayName,
    });
    const result = await postLoyaltyPoints(admin, {
      propertyId,
      accountId: account.id,
      deltaPoints: delta,
      reason,
      createdBy: "desk",
    });

    revalidatePath("/erp/loyalty");
    revalidatePath("/guest/loyalty");
    return {
      ok: true,
      propertyId,
      message: `Balance now ${result.points_balance} (${result.tier}).`,
    };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Could not adjust points.",
    };
  }
}
