"use server";

import { writeAuditEvent } from "@/lib/audit";
import { isDeskAuthenticated, requireMoneyDesk } from "@/lib/desk-auth";
import { assertDeskProperty } from "@/lib/desk/property-guard";
import { postFolioCharge } from "@/lib/folio/post-charge";
import {
  publishMealService,
  type MealPeriod,
} from "@/lib/kitchen/meal-service";
import { roundBtn } from "@/lib/pricing";
import { resolveActivePropertyId } from "@/lib/property-context";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { optionalTrim, trimRequired } from "@/lib/validation";
import { revalidatePath } from "next/cache";

type State = { ok: boolean; message?: string; error?: string };

const PERIODS = new Set<MealPeriod>(["breakfast", "lunch", "dinner"]);
const MEAL_PERIODS = new Set(["breakfast", "lunch", "dinner", "all"]);
const EVENT_STATUSES = new Set([
  "planned",
  "confirmed",
  "served",
  "cancelled",
]);
const BILLING_STATUSES = new Set([
  "none",
  "quoted",
  "confirmed",
  "posted",
  "paid",
  "comp",
]);

async function requireDesk() {
  if (!(await isDeskAuthenticated())) {
    throw new Error("Desk session expired. Sign in again.");
  }
}

/** HTML time HH:MM → Postgres time HH:MM:SS. */
function parseTime(raw: string | null | undefined): string | null {
  if (!raw) return null;
  return raw.length === 5 ? `${raw}:00` : raw;
}

function parseMoney(raw: FormDataEntryValue | null): number | null {
  const t = optionalTrim(raw);
  if (!t) return null;
  const n = Number(t);
  if (!Number.isFinite(n) || n < 0) {
    throw new Error("Money fields must be zero or positive Nu.");
  }
  return roundBtn(n);
}

function parseEventFields(formData: FormData) {
  const eventDate = trimRequired(formData.get("event_date"), "Date");
  const title = trimRequired(formData.get("title"), "Title");
  const covers = Math.max(0, Math.floor(Number(formData.get("covers") ?? 0)));
  if (!Number.isFinite(covers)) throw new Error("Pax / covers must be a number.");

  let mealPeriod = optionalTrim(formData.get("meal_period")) ?? "all";
  if (!MEAL_PERIODS.has(mealPeriod)) mealPeriod = "all";

  let status = optionalTrim(formData.get("status")) ?? "planned";
  if (!EVENT_STATUSES.has(status)) status = "planned";

  let billingStatus = optionalTrim(formData.get("billing_status")) ?? "none";
  if (!BILLING_STATUSES.has(billingStatus)) billingStatus = "none";

  const ratePerPax = parseMoney(formData.get("rate_per_pax_btn"));
  let packageTotal = parseMoney(formData.get("package_total_btn"));
  if (packageTotal == null && ratePerPax != null && covers > 0) {
    packageTotal = roundBtn(ratePerPax * covers);
  }
  const deposit = parseMoney(formData.get("deposit_btn")) ?? 0;

  const folioId = optionalTrim(formData.get("folio_id"));
  const bookingId = optionalTrim(formData.get("booking_id"));

  return {
    event_date: eventDate,
    title,
    covers,
    meal_period: mealPeriod,
    status,
    billing_status: billingStatus,
    notes: optionalTrim(formData.get("notes")),
    service_time: parseTime(optionalTrim(formData.get("service_time"))),
    service_end: parseTime(optionalTrim(formData.get("service_end"))),
    menu_note: optionalTrim(formData.get("menu_note")),
    venue: optionalTrim(formData.get("venue")),
    contact_name: optionalTrim(formData.get("contact_name")),
    contact_phone: optionalTrim(formData.get("contact_phone")),
    rate_per_pax_btn: ratePerPax,
    package_total_btn: packageTotal,
    deposit_btn: deposit,
    bill_note: optionalTrim(formData.get("bill_note")),
    folio_id: folioId || null,
    booking_id: bookingId || null,
  };
}

async function resolveBookingFromFolio(
  admin: ReturnType<typeof createSupabaseAdminClient>,
  propertyId: string,
  folioId: string | null,
  bookingId: string | null,
): Promise<string | null> {
  if (bookingId) return bookingId;
  if (!folioId) return null;
  const { data } = await admin
    .from("folios")
    .select("id, booking_id, property_id")
    .eq("id", folioId)
    .eq("property_id", propertyId)
    .maybeSingle();
  return (data?.booking_id as string | null) ?? null;
}

function revalidateKitchen() {
  revalidatePath("/erp/kitchen");
  revalidatePath("/erp/pos");
  revalidatePath("/erp");
}

export async function createKitchenEvent(
  _prev: State,
  formData: FormData,
): Promise<State> {
  try {
    await requireDesk();
    const admin = createSupabaseAdminClient();
    const propertyId = await resolveActivePropertyId(admin);
    const fields = parseEventFields(formData);
    const booking_id = await resolveBookingFromFolio(
      admin,
      propertyId,
      fields.folio_id,
      fields.booking_id,
    );

    const { data, error } = await admin
      .from("kitchen_events")
      .insert({
        property_id: propertyId,
        ...fields,
        booking_id,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);

    await writeAuditEvent(admin, {
      propertyId,
      entityType: "kitchen_events",
      entityId: (data?.id as string) ?? propertyId,
      action: "kitchen.event.create",
      summary: `Kitchen event: ${fields.title} (${fields.covers} pax)`,
    });

    revalidateKitchen();
    return { ok: true, message: "Event added." };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed." };
  }
}

export async function updateKitchenEvent(
  _prev: State,
  formData: FormData,
): Promise<State> {
  try {
    await requireDesk();
    const admin = createSupabaseAdminClient();
    const propertyId = await resolveActivePropertyId(admin);
    const eventId = trimRequired(formData.get("event_id"), "Event");
    const fields = parseEventFields(formData);
    const booking_id = await resolveBookingFromFolio(
      admin,
      propertyId,
      fields.folio_id,
      fields.booking_id,
    );

    const { data: existing } = await admin
      .from("kitchen_events")
      .select("id, billing_status, posted_folio_line_id")
      .eq("id", eventId)
      .eq("property_id", propertyId)
      .maybeSingle();
    if (!existing) throw new Error("Event not found.");

    // Once posted to folio, keep billing_status at least posted unless explicitly paid/comp.
    let billingStatus = fields.billing_status;
    if (
      existing.posted_folio_line_id &&
      !["posted", "paid", "comp"].includes(billingStatus)
    ) {
      billingStatus = "posted";
    }

    const { error } = await admin
      .from("kitchen_events")
      .update({
        ...fields,
        booking_id,
        billing_status: billingStatus,
        updated_at: new Date().toISOString(),
      })
      .eq("id", eventId)
      .eq("property_id", propertyId);
    if (error) throw new Error(error.message);

    await writeAuditEvent(admin, {
      propertyId,
      entityType: "kitchen_events",
      entityId: eventId,
      action: "kitchen.event.update",
      summary: `Updated kitchen event: ${fields.title}`,
    });

    revalidateKitchen();
    return { ok: true, message: "Event updated." };
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

    revalidateKitchen();
    return { ok: true, message: "Event removed." };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed." };
  }
}

/**
 * Post agreed banquet package onto a linked open folio (F&B/order journal path).
 * Idempotent while posted_folio_line_id is set.
 */
export async function chargeKitchenEventToFolio(
  _prev: State,
  formData: FormData,
): Promise<State> {
  try {
    await requireMoneyDesk();
    const admin = createSupabaseAdminClient();
    const propertyId = await resolveActivePropertyId(admin);
    const eventId = trimRequired(formData.get("event_id"), "Event");

    const { data: ev } = await admin
      .from("kitchen_events")
      .select(
        "id, title, covers, package_total_btn, rate_per_pax_btn, folio_id, booking_id, posted_folio_line_id, billing_status, event_date, menu_note",
      )
      .eq("id", eventId)
      .eq("property_id", propertyId)
      .maybeSingle();
    if (!ev) throw new Error("Event not found.");
    if (ev.posted_folio_line_id) {
      return { ok: true, message: "Already posted to folio." };
    }
    if ((ev.billing_status as string) === "comp") {
      throw new Error("Event is marked complimentary — nothing to charge.");
    }

    const folioId =
      optionalTrim(formData.get("folio_id")) ??
      (ev.folio_id as string | null);
    if (!folioId) throw new Error("Link an open folio first.");

    const covers = Number(ev.covers ?? 0);
    let amountBtn = Number(ev.package_total_btn ?? 0);
    if (!(amountBtn > 0) && Number(ev.rate_per_pax_btn ?? 0) > 0 && covers > 0) {
      amountBtn = roundBtn(Number(ev.rate_per_pax_btn) * covers);
    }
    if (!(amountBtn > 0)) {
      throw new Error("Set package total or rate × pax before posting.");
    }
    amountBtn = roundBtn(amountBtn);

    const { data: folio } = await admin
      .from("folios")
      .select("id, booking_id, status, property_id, label")
      .eq("id", folioId)
      .maybeSingle();
    if (!folio) throw new Error("Folio not found.");
    assertDeskProperty(propertyId, folio.property_id as string, "Folio");
    if ((folio.status as string) !== "open") {
      throw new Error("Folio is not open.");
    }

    const { data: property } = await admin
      .from("properties")
      .select("gst_rate, service_charge_rate, service_charge_default_on")
      .eq("id", propertyId)
      .maybeSingle();

    const gstRate = Number(property?.gst_rate ?? 0.07);
    const serviceChargeApplied = Boolean(property?.service_charge_default_on);
    const serviceChargeRate = serviceChargeApplied
      ? Number(property?.service_charge_rate ?? 0)
      : 0;
    const serviceChargeBtn = roundBtn(amountBtn * serviceChargeRate);
    const gstBase = amountBtn + serviceChargeBtn;
    const gstBtn = roundBtn(gstBase * gstRate);
    const totalBtn = roundBtn(amountBtn + serviceChargeBtn + gstBtn);

    const menuBit = optionalTrim(ev.menu_note as string | null);
    const desc = [
      `Banquet · ${ev.title as string}`,
      covers > 0 ? `${covers} pax` : null,
      menuBit ? menuBit.slice(0, 80) : null,
    ]
      .filter(Boolean)
      .join(" · ");

    const result = await postFolioCharge(admin, propertyId, {
      folio_id: folioId,
      booking_id:
        (ev.booking_id as string | null) ??
        (folio.booking_id as string | null),
      source_type: "order",
      source_id: eventId,
      description: desc,
      qty: Math.max(1, covers),
      unit_price_btn:
        covers > 0 ? roundBtn(amountBtn / covers) : amountBtn,
      amount_btn: amountBtn,
      service_charge_rate: serviceChargeRate,
      service_charge_btn: serviceChargeBtn,
      service_charge_applied: serviceChargeApplied,
      gst_applicable: gstBtn > 0,
      gst_btn: gstBtn,
      total_btn: totalBtn,
      business_date: (ev.event_date as string) ?? undefined,
    });

    const { error: updErr } = await admin
      .from("kitchen_events")
      .update({
        folio_id: folioId,
        posted_folio_line_id: result.lineId,
        package_total_btn: amountBtn,
        billing_status: "posted",
        updated_at: new Date().toISOString(),
      })
      .eq("id", eventId)
      .eq("property_id", propertyId);
    if (updErr) throw new Error(updErr.message);

    await writeAuditEvent(admin, {
      propertyId,
      entityType: "kitchen_events",
      entityId: eventId,
      action: "kitchen.event.charge",
      summary: `Posted banquet ${ev.title}: ${totalBtn} BTN to folio`,
      meta: { folioId, lineId: result.lineId, totalBtn },
    });

    revalidateKitchen();
    revalidatePath(`/erp/folios/${folioId}`);
    return {
      ok: true,
      message: `Posted ${totalBtn.toFixed(2)} BTN to ${folio.label as string}.`,
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed." };
  }
}

/**
 * Kitchen → FO/F&B: publish today's breakfast / lunch / dinner feed + menu note.
 */
export async function publishKitchenMealService(
  _prev: State,
  formData: FormData,
): Promise<State> {
  try {
    await requireDesk();
    const admin = createSupabaseAdminClient();
    const propertyId = await resolveActivePropertyId(admin);
    const serviceDate = trimRequired(formData.get("service_date"), "Service date");
    const periodRaw = trimRequired(formData.get("meal_period"), "Meal period");
    if (!PERIODS.has(periodRaw as MealPeriod)) {
      throw new Error("Choose breakfast, lunch, or dinner.");
    }
    const mealPeriod = periodRaw as MealPeriod;

    const service = await publishMealService(admin, propertyId, {
      serviceDate,
      mealPeriod,
      menuNote: optionalTrim(formData.get("menu_note")),
      menuHighlights: optionalTrim(formData.get("menu_highlights")),
      publishedBy: optionalTrim(formData.get("published_by")) ?? "kitchen",
    });

    await writeAuditEvent(admin, {
      propertyId,
      entityType: "kitchen_meal_services",
      entityId: service.id,
      action: "kitchen.meal_service.publish",
      summary: `Published ${mealPeriod} · ${service.heads} heads · ${serviceDate}`,
      meta: {
        mealPeriod,
        heads: service.heads,
        guestCount: service.guestFeed.length,
      },
    });

    revalidatePath("/erp/kitchen");
    revalidatePath("/erp/pos");
    revalidatePath("/erp");
    return {
      ok: true,
      message: `Published ${mealPeriod}: ${service.heads} heads for FO/F&B.`,
    };
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
