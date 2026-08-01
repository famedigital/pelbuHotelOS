"use server";

import { writeAuditEvent } from "@/lib/audit";
import { isDeskAuthenticated } from "@/lib/desk-auth";
import { resolveActivePropertyId } from "@/lib/property-context";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { optionalTrim, trimRequired } from "@/lib/validation";
import { revalidatePath } from "next/cache";

type State = { ok: boolean; message?: string; error?: string };

async function requireDesk() {
  if (!(await isDeskAuthenticated())) {
    throw new Error("Desk session expired. Sign in again.");
  }
}

export async function createKitchenEvent(
  _prev: State,
  formData: FormData,
): Promise<State> {
  try {
    await requireDesk();
    const admin = createSupabaseAdminClient();
    const propertyId = await resolveActivePropertyId(admin);
    const eventDate = trimRequired(formData.get("event_date"), "Date");
    const title = trimRequired(formData.get("title"), "Title");
    const covers = Math.max(0, Number(formData.get("covers") ?? 0));
    const mealPeriod =
      optionalTrim(formData.get("meal_period")) ?? "all";

    const { error } = await admin.from("kitchen_events").insert({
      property_id: propertyId,
      event_date: eventDate,
      title,
      covers,
      meal_period: mealPeriod,
      notes: optionalTrim(formData.get("notes")),
    });
    if (error) throw new Error(error.message);

    await writeAuditEvent(admin, {
      propertyId,
      entityType: "kitchen_events",
      entityId: propertyId,
      action: "kitchen.event.create",
      summary: `Kitchen event: ${title} (${covers} covers)`,
    });

    revalidatePath("/erp/kitchen");
    return { ok: true, message: "Event added." };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed." };
  }
}

export async function deleteKitchenEvent(
  _prev: State,
  formData: FormData,
): Promise<State> {
  try {
    await requireDesk();
    const admin = createSupabaseAdminClient();
    const propertyId = await resolveActivePropertyId(admin);
    const eventId = trimRequired(formData.get("event_id"), "Event");

    const { error } = await admin
      .from("kitchen_events")
      .delete()
      .eq("id", eventId)
      .eq("property_id", propertyId);
    if (error) throw new Error(error.message);

    revalidatePath("/erp/kitchen");
    return { ok: true, message: "Event removed." };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed." };
  }
}

export async function upsertPerformanceTarget(
  _prev: State,
  formData: FormData,
): Promise<State> {
  try {
    await requireDesk();
    const admin = createSupabaseAdminClient();
    const propertyId = await resolveActivePropertyId(admin);
    const periodKind = trimRequired(formData.get("period_kind"), "Period kind");
    const periodKey = trimRequired(formData.get("period_key"), "Period key");
    const metric = trimRequired(formData.get("metric"), "Metric");
    const targetValue = Number(formData.get("target_value"));
    if (!Number.isFinite(targetValue) || targetValue < 0) {
      throw new Error("Target must be a non-negative number.");
    }

    const { error } = await admin.from("property_performance_targets").upsert(
      {
        property_id: propertyId,
        period_kind: periodKind,
        period_key: periodKey,
        metric,
        target_value: targetValue,
        notes: optionalTrim(formData.get("notes")),
      },
      { onConflict: "property_id,period_kind,period_key,metric" },
    );
    if (error) throw new Error(error.message);

    revalidatePath("/erp/reports/performance");
    return { ok: true, message: "Target saved." };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed." };
  }
}
