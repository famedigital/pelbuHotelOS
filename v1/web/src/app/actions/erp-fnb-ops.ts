"use server";

import { isDeskAuthenticated } from "@/lib/desk-auth";
import { resolveActivePropertyId } from "@/lib/property-context";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { optionalTrim, trimRequired } from "@/lib/validation";
import { revalidatePath } from "next/cache";

export type FnbLogState = { ok: boolean; error?: string; message?: string };

async function requireDesk() {
  if (!(await isDeskAuthenticated())) {
    throw new Error("Desk session expired. Sign in again.");
  }
}

export async function logFnbWaste(
  _prev: FnbLogState,
  formData: FormData,
): Promise<FnbLogState> {
  try {
    await requireDesk();
    const admin = createSupabaseAdminClient();
    const propertyId = await resolveActivePropertyId(admin);
    const itemName = trimRequired(formData.get("item_name"), "Item");
    const qty = Number(formData.get("qty"));
    if (!Number.isFinite(qty) || qty <= 0) throw new Error("Qty must be > 0.");
    const unit = optionalTrim(formData.get("unit")) || "kg";
    const reason = optionalTrim(formData.get("reason_code")) || "spoilage";
    const outlet = optionalTrim(formData.get("outlet"));
    const notes = optionalTrim(formData.get("notes"));

    const { error } = await admin.from("fnb_waste_log").insert({
      property_id: propertyId,
      item_name: itemName,
      qty,
      unit,
      reason_code: reason,
      outlet,
      notes,
      logged_by_name: optionalTrim(formData.get("logged_by")) || "desk",
    });
    if (error) throw new Error(error.message);

    revalidatePath("/erp/kitchen/compliance");
    return { ok: true, message: "Waste logged" };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Could not log waste",
    };
  }
}

export async function logFnbTemp(
  _prev: FnbLogState,
  formData: FormData,
): Promise<FnbLogState> {
  try {
    await requireDesk();
    const admin = createSupabaseAdminClient();
    const propertyId = await resolveActivePropertyId(admin);
    const location = trimRequired(formData.get("location_label"), "Location");
    const temp = Number(formData.get("temp_c"));
    if (!Number.isFinite(temp)) throw new Error("Temperature required.");
    const min = Number(formData.get("min_c") ?? -40);
    const max = Number(formData.get("max_c") ?? 8);
    const inRange = temp >= min && temp <= max;
    const notes = optionalTrim(formData.get("notes"));

    const { error } = await admin.from("fnb_temp_log").insert({
      property_id: propertyId,
      location_label: location,
      temp_c: temp,
      in_range: inRange,
      notes,
      logged_by_name: optionalTrim(formData.get("logged_by")) || "desk",
    });
    if (error) throw new Error(error.message);

    revalidatePath("/erp/kitchen/compliance");
    return {
      ok: true,
      message: inRange ? "Temp logged" : "Temp logged · OUT OF RANGE",
    };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Could not log temp",
    };
  }
}

export async function logFnbCleaning(
  _prev: FnbLogState,
  formData: FormData,
): Promise<FnbLogState> {
  try {
    await requireDesk();
    const admin = createSupabaseAdminClient();
    const propertyId = await resolveActivePropertyId(admin);
    const area = trimRequired(formData.get("area"), "Area");
    const task = trimRequired(formData.get("task"), "Task");
    const notes = optionalTrim(formData.get("notes"));

    const { error } = await admin.from("fnb_cleaning_log").upsert(
      {
        property_id: propertyId,
        area,
        task,
        completed: true,
        completed_by_name: optionalTrim(formData.get("logged_by")) || "desk",
        notes,
      },
      { onConflict: "property_id,business_date,area,task" },
    );
    if (error) throw new Error(error.message);

    revalidatePath("/erp/kitchen/compliance");
    return { ok: true, message: "Cleaning signed off" };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Could not sign cleaning",
    };
  }
}

export async function logFnbGas(
  _prev: FnbLogState,
  formData: FormData,
): Promise<FnbLogState> {
  try {
    await requireDesk();
    const admin = createSupabaseAdminClient();
    const propertyId = await resolveActivePropertyId(admin);
    const cylinders = Number(formData.get("cylinders"));
    if (!Number.isFinite(cylinders) || cylinders <= 0) {
      throw new Error("Enter cylinders used.");
    }
    const cost = formData.get("cost_btn");
    const costBtn =
      cost != null && String(cost).trim() !== "" ? Number(cost) : null;
    const notes = optionalTrim(formData.get("notes"));

    const { error } = await admin.from("fnb_gas_log").insert({
      property_id: propertyId,
      cylinders,
      cost_btn: costBtn,
      notes,
      logged_by_name: optionalTrim(formData.get("logged_by")) || "desk",
    });
    if (error) throw new Error(error.message);

    revalidatePath("/erp/kitchen/compliance");
    revalidatePath("/erp/kitchen");
    return { ok: true, message: "Gas usage logged" };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Could not log gas",
    };
  }
}

export async function createDiningReservation(
  _prev: FnbLogState,
  formData: FormData,
): Promise<FnbLogState> {
  try {
    await requireDesk();
    const admin = createSupabaseAdminClient();
    const propertyId = await resolveActivePropertyId(admin);
    const guestName = trimRequired(formData.get("guest_name"), "Guest name");
    const phone = optionalTrim(formData.get("phone"));
    const partySize = Number(formData.get("party_size") ?? 2);
    const reservedFor = trimRequired(
      formData.get("reserved_for"),
      "Date & time",
    );
    const status = optionalTrim(formData.get("status")) || "booked";
    const notes = optionalTrim(formData.get("notes"));
    const outlet = optionalTrim(formData.get("outlet"));
    const tableId = optionalTrim(formData.get("table_id"));

    const { error } = await admin.from("dining_reservations").insert({
      property_id: propertyId,
      guest_name: guestName,
      phone,
      party_size: partySize,
      reserved_for: new Date(reservedFor).toISOString(),
      status,
      notes,
      outlet,
      table_id: tableId || null,
    });
    if (error) throw new Error(error.message);

    revalidatePath("/erp/pos/reservations");
    return { ok: true, message: "Reservation saved" };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Could not save reservation",
    };
  }
}

export async function updateDiningReservationStatus(
  _prev: FnbLogState,
  formData: FormData,
): Promise<FnbLogState> {
  try {
    await requireDesk();
    const admin = createSupabaseAdminClient();
    const propertyId = await resolveActivePropertyId(admin);
    const id = trimRequired(formData.get("id"), "Reservation");
    const status = trimRequired(formData.get("status"), "Status");

    const { error } = await admin
      .from("dining_reservations")
      .update({ status })
      .eq("id", id)
      .eq("property_id", propertyId);
    if (error) throw new Error(error.message);

    revalidatePath("/erp/pos/reservations");
    return { ok: true, message: `Status → ${status}` };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Update failed",
    };
  }
}

export async function stampFnbLoyalty(
  _prev: FnbLogState,
  formData: FormData,
): Promise<FnbLogState> {
  try {
    await requireDesk();
    const admin = createSupabaseAdminClient();
    const propertyId = await resolveActivePropertyId(admin);
    const phone = trimRequired(formData.get("phone"), "Phone");
    const guestName = optionalTrim(formData.get("guest_name"));
    const stampsAdd = Math.max(1, Number(formData.get("stamps") ?? 1));

    const { data: existing } = await admin
      .from("fnb_loyalty_cards")
      .select("id, stamps, free_meals")
      .eq("property_id", propertyId)
      .eq("phone", phone)
      .maybeSingle();

    let stamps = stampsAdd;
    let free = 0;
    if (existing) {
      stamps = Number(existing.stamps) + stampsAdd;
      free = Number(existing.free_meals);
      while (stamps >= 10) {
        stamps -= 10;
        free += 1;
      }
      await admin
        .from("fnb_loyalty_cards")
        .update({
          stamps,
          free_meals: free,
          guest_name: guestName || undefined,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existing.id);
    } else {
      if (stamps >= 10) {
        free = Math.floor(stamps / 10);
        stamps = stamps % 10;
      }
      await admin.from("fnb_loyalty_cards").insert({
        property_id: propertyId,
        phone,
        guest_name: guestName,
        stamps,
        free_meals: free,
      });
    }

    revalidatePath("/erp/pos/loyalty");
    return {
      ok: true,
      message: `Stamps updated · ${stamps} stamp(s) · ${free} free meal(s)`,
    };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Loyalty update failed",
    };
  }
}
