"use server";

import { isDeskAuthenticated, requireMoneyDesk } from "@/lib/desk-auth";
import { assertDeskProperty } from "@/lib/desk/property-guard";
import { writeAuditEvent } from "@/lib/audit";
import { resolveActivePropertyId } from "@/lib/property-context";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { trimRequired } from "@/lib/validation";
import { revalidatePath } from "next/cache";

export type SeasonEditorState = {
  ok: boolean;
  error?: string;
  message?: string;
};

const KINDS = new Set(["peak", "lean", "off"]);

/** Update a season window date range (rates matrix uses these for quote season). */
export async function updateSeasonWindow(
  _prev: SeasonEditorState,
  formData: FormData,
): Promise<SeasonEditorState> {
  try {
    if (!(await isDeskAuthenticated())) {
      throw new Error("Desk session expired. Sign in again.");
    }
    await requireMoneyDesk();
    const admin = createSupabaseAdminClient();
    const propertyId = await resolveActivePropertyId(admin);
    const seasonId = trimRequired(formData.get("season_id"), "Season");
    const kind = trimRequired(formData.get("kind"), "Kind").toLowerCase();
    const startsOn = trimRequired(formData.get("starts_on"), "Start date");
    const endsOn = trimRequired(formData.get("ends_on"), "End date");

    if (!KINDS.has(kind)) throw new Error("Season kind must be peak, lean, or off.");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(startsOn) || !/^\d{4}-\d{2}-\d{2}$/.test(endsOn)) {
      throw new Error("Dates must be YYYY-MM-DD.");
    }
    if (endsOn < startsOn) {
      throw new Error("End date must be on or after start date.");
    }

    const { data: row } = await admin
      .from("seasons")
      .select("id, property_id, kind")
      .eq("id", seasonId)
      .maybeSingle();
    if (!row) throw new Error("Season not found.");
    assertDeskProperty(propertyId, row.property_id as string, "Season");
    if ((row.kind as string) !== kind) {
      throw new Error("Season kind mismatch.");
    }

    const { error } = await admin
      .from("seasons")
      .update({ starts_on: startsOn, ends_on: endsOn })
      .eq("id", seasonId)
      .eq("property_id", propertyId);
    if (error) throw new Error(error.message);

    await writeAuditEvent(admin, {
      propertyId,
      action: "seasons.update",
      entityType: "seasons",
      entityId: seasonId,
      summary: `Season ${kind}: ${startsOn} → ${endsOn}`,
      meta: { kind, starts_on: startsOn, ends_on: endsOn },
    });

    revalidatePath("/erp/rates");
    revalidatePath("/erp/settings");
    revalidatePath("/book");
    return { ok: true, message: "Season dates saved." };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Could not save season.",
    };
  }
}
