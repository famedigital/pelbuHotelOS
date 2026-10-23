"use server";

import { writeAuditEvent } from "@/lib/audit";
import { isDeskAuthenticated } from "@/lib/desk-auth";
import { requireDeskPropertyId } from "@/lib/desk-property";
import { ensureFolioEditSession } from "@/lib/folio/edit-session";
import { postFolioCharge } from "@/lib/folio/post-charge";
import { stayNightDates } from "@/lib/folio/room-bill";
import { voidFolioLineWithReversal } from "@/lib/folio/void-line";
import { calculateRoomNightTax, roundBtn } from "@/lib/pricing";
import { loadRoomRateTaxSettings } from "@/lib/room-rate-tax";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { optionalTrim, trimRequired } from "@/lib/validation";
import { revalidatePath } from "next/cache";

export type NightRoom = {
  roomUnitId: string;
  label: string;
  /** Guest total for this room on this night. */
  rateBtn: number | null;
};

export type NightMeal = {
  date: string;
  mealPlanCode: string;
  rooms: NightRoom[];
};

const CODES = new Set(["EP", "BB", "CP", "MAP", "AP"]);

function missingTable(error: { code?: string; message?: string } | null): boolean {
  const message = error?.message ?? "";
  return (
    error?.code === "42P01" ||
    error?.code === "PGRST205" ||
    /booking_night_meals/i.test(message) ||
    /nightly_rate_btn|room_rates/i.test(message)
  );
}

function doorLabel(label: string): string {
  const door = label.match(/\d{2,4}/)?.[0];
  return door || label.trim() || "Room";
}

function parseRate(raw: unknown): number | null {
  if (raw == null || raw === "") return null;
  const n = Number(String(raw).replace(/[^0-9.]/g, ""));
  if (!Number.isFinite(n) || n < 0) return null;
  return roundBtn(n);
}

function asRateMap(raw: unknown): Record<string, number> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out: Record<string, number> = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    const rate = parseRate(value);
    if (rate != null) out[key] = rate;
  }
  return out;
}

export async function loadStayNightMeals(
  bookingId: string,
): Promise<{ ok: true; nights: NightMeal[] } | { ok: false; error: string }> {
  try {
    if (!(await isDeskAuthenticated())) {
      return { ok: false, error: "Desk session expired." };
    }
    const admin = createSupabaseAdminClient();
    const propertyId = await requireDeskPropertyId();
    const { data: booking, error: bookingErr } = await admin
      .from("bookings")
      .select("id, check_in, check_out, meal_plan_code, agreed_nightly_rate_btn")
      .eq("id", bookingId)
      .eq("property_id", propertyId)
      .maybeSingle();
    if (bookingErr || !booking) {
      return { ok: false, error: bookingErr?.message ?? "Booking not found." };
    }

    const dates = stayNightDates(
      String(booking.check_in ?? ""),
      String(booking.check_out ?? ""),
    );
    const fallbackMeal = String(booking.meal_plan_code ?? "EP").toUpperCase();
    const agreed =
      booking.agreed_nightly_rate_btn == null
        ? null
        : Number(booking.agreed_nightly_rate_btn);

    const [{ data: assigns }, { data: lines }, saved] = await Promise.all([
      admin
        .from("room_assignments")
        .select("room_unit_id, from_date, to_date, room_units(label)")
        .eq("booking_id", bookingId),
      admin
        .from("folio_lines")
        .select("business_date, room_unit_id, total_btn, description")
        .eq("booking_id", bookingId)
        .eq("source_type", "room")
        .eq("status", "posted"),
      admin
        .from("booking_night_meals")
        .select("night_date, meal_plan_code, nightly_rate_btn, room_rates")
        .eq("property_id", propertyId)
        .eq("booking_id", bookingId),
    ]);

    const savedRows = saved.error && missingTable(saved.error) ? [] : (saved.data ?? []);
    if (saved.error && !missingTable(saved.error)) {
      return { ok: false, error: saved.error.message };
    }

    const savedByDate = new Map(
      savedRows.map((row) => [
        String(row.night_date).slice(0, 10),
        {
          meal: String(row.meal_plan_code ?? "").toUpperCase(),
          rate: parseRate(row.nightly_rate_btn),
          rooms: asRateMap(row.room_rates),
        },
      ]),
    );

    const posted = new Map<string, number>();
    const labelByUnit = new Map<string, string>();
    for (const row of assigns ?? []) {
      const unit = Array.isArray(row.room_units)
        ? row.room_units[0]
        : row.room_units;
      const roomUnitId = String(row.room_unit_id ?? "");
      if (!roomUnitId) continue;
      labelByUnit.set(roomUnitId, doorLabel(String(unit?.label ?? "")));
    }
    for (const line of lines ?? []) {
      const date = String(line.business_date ?? "").slice(0, 10);
      const unit = String(line.room_unit_id ?? "");
      if (!date || !unit) continue;
      posted.set(`${date}:${unit}`, Number(line.total_btn));
      if (!labelByUnit.has(unit)) {
        labelByUnit.set(unit, doorLabel(String(line.description ?? "")));
      }
    }

    const nights: NightMeal[] = dates.map((date) => {
      const savedNight = savedByDate.get(date);
      const unitIds = new Set<string>();
      for (const row of assigns ?? []) {
        const from = String(row.from_date ?? "").slice(0, 10);
        const to = String(row.to_date ?? "").slice(0, 10);
        const roomUnitId = String(row.room_unit_id ?? "");
        if (roomUnitId && from && to && from <= date && date < to) {
          unitIds.add(roomUnitId);
        }
      }
      for (const key of posted.keys()) {
        const [postedDate, unit] = key.split(":");
        if (postedDate === date && unit) unitIds.add(unit);
      }
      const rooms = [...unitIds]
        .map((roomUnitId) => {
          const rate =
            savedNight?.rooms[roomUnitId] ??
            posted.get(`${date}:${roomUnitId}`) ??
            savedNight?.rate ??
            agreed;
          return {
            roomUnitId,
            label: labelByUnit.get(roomUnitId) || "Room",
            rateBtn: rate,
          };
        })
        .sort((a, b) => a.label.localeCompare(b.label));
      return {
        date,
        mealPlanCode: savedNight?.meal || fallbackMeal,
        rooms,
      };
    });

    return { ok: true, nights };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Could not load night meals.",
    };
  }
}

export async function saveStayNightMeals(
  _prev: { ok: boolean; error?: string; message?: string },
  formData: FormData,
): Promise<{ ok: boolean; error?: string; message?: string }> {
  try {
    if (!(await isDeskAuthenticated())) {
      return { ok: false, error: "Desk session expired." };
    }
    const admin = createSupabaseAdminClient();
    const propertyId = await requireDeskPropertyId();
    const bookingId = trimRequired(formData.get("booking_id"), "Booking");
    const session = await ensureFolioEditSession({
      admin,
      propertyId,
      pin: optionalTrim(formData.get("manager_pin")),
    });
    if (!session.ok) return { ok: false, error: session.error };

    const { data: booking, error: bookingErr } = await admin
      .from("bookings")
      .select("id, check_in, check_out, meal_plan_code, status")
      .eq("id", bookingId)
      .eq("property_id", propertyId)
      .maybeSingle();
    if (bookingErr || !booking) {
      return { ok: false, error: bookingErr?.message ?? "Booking not found." };
    }

    const allowed = new Set(
      stayNightDates(
        String(booking.check_in ?? ""),
        String(booking.check_out ?? ""),
      ),
    );
    const raw = String(formData.get("nights_json") ?? "[]");
    const parsed = JSON.parse(raw) as Array<{
      date?: string;
      mealPlanCode?: string;
      rooms?: Array<{ roomUnitId?: string; rateBtn?: unknown }>;
    }>;
    const nights = parsed
      .map((row) => ({
        date: String(row.date ?? "").slice(0, 10),
        mealPlanCode: String(row.mealPlanCode ?? "").trim().toUpperCase(),
        rooms: (row.rooms ?? [])
          .map((room) => ({
            roomUnitId: String(room.roomUnitId ?? "").trim(),
            rateBtn: parseRate(room.rateBtn),
          }))
          .filter((room) => room.roomUnitId && room.rateBtn != null),
      }))
      .filter(
        (row) =>
          allowed.has(row.date) &&
          (CODES.has(row.mealPlanCode) || /^[A-Z]{2,4}$/.test(row.mealPlanCode)),
      );
    if (nights.length === 0) {
      return { ok: false, error: "Choose a meal plan for each night." };
    }

    const { error: deleteErr } = await admin
      .from("booking_night_meals")
      .delete()
      .eq("property_id", propertyId)
      .eq("booking_id", bookingId);
    if (deleteErr) {
      if (missingTable(deleteErr)) {
        return {
          ok: false,
          error: "Night meals are not on this database yet.",
        };
      }
      return { ok: false, error: deleteErr.message };
    }

    const { error: insertErr } = await admin.from("booking_night_meals").insert(
      nights.map((night) => {
        const roomRates: Record<string, number> = {};
        for (const room of night.rooms) {
          if (room.rateBtn != null) roomRates[room.roomUnitId] = room.rateBtn;
        }
        const only = night.rooms.length === 1 ? night.rooms[0]?.rateBtn : null;
        return {
          property_id: propertyId,
          booking_id: bookingId,
          night_date: night.date,
          meal_plan_code: night.mealPlanCode,
          nightly_rate_btn: only,
          room_rates: roomRates,
        };
      }),
    );
    if (insertErr) return { ok: false, error: insertErr.message };

    const distinct = [...new Set(nights.map((night) => night.mealPlanCode))];
    if (distinct.length === 1 && distinct[0]) {
      await admin
        .from("bookings")
        .update({ meal_plan_code: distinct[0] })
        .eq("id", bookingId)
        .eq("property_id", propertyId);
    }

    let changed = 0;
    const problems: string[] = [];
    if (booking.status === "checked_in" || booking.status === "checked_out") {
      const tax = await loadRoomRateTaxSettings(admin, propertyId);
      const { data: lines } = await admin
        .from("folio_lines")
        .select(
          "id, folio_id, business_date, room_unit_id, total_btn, description, bill_to, source_id",
        )
        .eq("booking_id", bookingId)
        .eq("source_type", "room")
        .eq("status", "posted");
      for (const night of nights) {
        for (const room of night.rooms) {
          if (room.rateBtn == null) continue;
          const matches = (lines ?? []).filter(
            (line) =>
              String(line.business_date ?? "").slice(0, 10) === night.date &&
              String(line.room_unit_id ?? "") === room.roomUnitId,
          );
          if (matches.length === 0) continue;
          if (matches.length > 1) {
            problems.push(`${night.date} has more than one room charge.`);
            continue;
          }
          const line = matches[0];
          if (Math.abs(Number(line.total_btn) - room.rateBtn) < 0.5) continue;
          try {
            await voidFolioLineWithReversal(admin, propertyId, {
              lineId: line.id as string,
              reason: `Night rate ${night.date} Nu ${room.rateBtn}`,
              voidedBy: session.actor,
            });
            const priced = calculateRoomNightTax(room.rateBtn, {
              ...tax,
              inclusiveOfGstSc: true,
            });
            await postFolioCharge(admin, propertyId, {
              folio_id: line.folio_id as string,
              booking_id: bookingId,
              source_type: "room",
              source_id: (line.source_id as string | null) ?? null,
              description: String(line.description ?? `Room · ${night.date}`),
              qty: 1,
              unit_price_btn: priced.amountBtn,
              amount_btn: priced.amountBtn,
              service_charge_rate: priced.serviceChargeRate,
              service_charge_btn: priced.serviceChargeBtn,
              service_charge_applied: priced.serviceChargeApplied,
              gst_applicable: priced.gstBtn > 0,
              gst_btn: priced.gstBtn,
              total_btn: priced.totalBtn,
              bill_to:
                line.bill_to === "agent" || line.bill_to === "guest"
                  ? line.bill_to
                  : undefined,
              business_date: night.date,
              room_unit_id: room.roomUnitId,
              journal_date: night.date,
              tax_treatment: "inclusive",
            });
            changed += 1;
          } catch (err) {
            problems.push(
              err instanceof Error ? err.message : `Could not update ${night.date}.`,
            );
          }
        }
      }
    }

    await writeAuditEvent(admin, {
      propertyId,
      action: "booking.night_meals",
      entityType: "bookings",
      entityId: bookingId,
      summary: nights
        .map((night) => {
          const rates = night.rooms
            .map((room) => (room.rateBtn == null ? "" : String(room.rateBtn)))
            .filter(Boolean)
            .join("/");
          return `${night.date.slice(5)} ${night.mealPlanCode}${rates ? ` ${rates}` : ""}`;
        })
        .join(", "),
      actor: session.actor,
    });
    revalidatePath("/erp/in-house");
    revalidatePath("/erp/arrivals");

    if (problems.length > 0) {
      return {
        ok: false,
        error: `Meals saved. ${problems[0]}`,
      };
    }
    return {
      ok: true,
      message:
        changed > 0
          ? `Saved. Updated ${changed} night rate${changed === 1 ? "" : "s"} on the bill.`
          : "Saved.",
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Could not save night meals.",
    };
  }
}
