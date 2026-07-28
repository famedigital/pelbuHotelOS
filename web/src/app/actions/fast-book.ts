"use server";

import { notifyNewBooking } from "@/lib/notify";
import { isDeskAuthenticated } from "@/lib/desk-auth";
import { PELBU_PROPERTY_SLUG } from "@/lib/property";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  assertOptionalEmail,
  assertPhone,
  assertStayDates,
  optionalTrim,
  parsePositiveInt,
  trimRequired,
} from "@/lib/validation";

export type FastBookState = {
  ok: boolean;
  bookingId?: string;
  error?: string;
};

const SOURCES = new Set(["owner", "reservation", "agent", "mou_agent"]);
const PAYMENT_MODES = new Set(["prepaid", "partial", "on_credit", "cash"]);

function parseNonNegInt(
  value: FormDataEntryValue | null,
  label: string,
  max: number,
): number {
  const raw = typeof value === "string" ? value.trim() : "";
  if (!raw) return 0;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 0 || n > max) {
    throw new Error(`${label} must be between 0 and ${max}.`);
  }
  return n;
}

type RoomTypeRow = {
  id: string;
  code: string;
  name: string;
  inventory_kind: string;
  unit_count: number;
};

/** Desk ultra-fast book: dates → rooms → pax → agent → guide → beds → save. */
export async function createFastBooking(
  _prev: FastBookState,
  formData: FormData,
): Promise<FastBookState> {
  try {
    if (!(await isDeskAuthenticated())) {
      throw new Error("Desk session expired. Sign in again.");
    }

    const source = trimRequired(formData.get("source"), "Booked by");
    if (!SOURCES.has(source)) {
      throw new Error("Invalid booked-by role.");
    }

    const contactName = trimRequired(formData.get("contact_name"), "Guest name");
    const contactPhone = trimRequired(formData.get("contact_phone"), "Phone");
    assertPhone(contactPhone);

    const contactEmail = optionalTrim(formData.get("contact_email"));
    assertOptionalEmail(contactEmail);

    const checkIn = trimRequired(formData.get("check_in"), "Check-in");
    const checkOut = trimRequired(formData.get("check_out"), "Check-out");
    assertStayDates(checkIn, checkOut);

    const adults = parsePositiveInt(formData.get("adults"), "Adults", 24);
    const guideNumber = optionalTrim(formData.get("guide_number"));
    const notes = optionalTrim(formData.get("notes"));
    const agentId = optionalTrim(formData.get("agent_id"));

    const paymentModeRaw = optionalTrim(formData.get("payment_mode"));
    const paymentMode =
      paymentModeRaw && PAYMENT_MODES.has(paymentModeRaw)
        ? paymentModeRaw
        : "cash";

    if ((source === "agent" || source === "mou_agent") && !agentId) {
      throw new Error("Select an approved agent for agent bookings.");
    }

    if ((source === "agent" || source === "mou_agent") && !guideNumber) {
      throw new Error("Guide number is required for agent bookings.");
    }

    const admin = createSupabaseAdminClient();

    const { data: property, error: propertyError } = await admin
      .from("properties")
      .select("id")
      .eq("slug", PELBU_PROPERTY_SLUG)
      .single();

    if (propertyError || !property) {
      throw new Error("Hotel property is not configured.");
    }

    const { data: roomTypes, error: typesError } = await admin
      .from("room_types")
      .select("id, code, name, inventory_kind, unit_count")
      .eq("property_id", property.id);

    if (typesError || !roomTypes?.length) {
      throw new Error("Room types are not configured.");
    }

    const types = roomTypes as RoomTypeRow[];

    const { data: overlappingBookings } = await admin
      .from("bookings")
      .select("id, check_in, check_out, booking_rooms(qty, room_type_id)")
      .eq("property_id", property.id)
      .in("status", ["pending", "confirmed", "checked_in"])
      .lt("check_in", checkOut)
      .gt("check_out", checkIn);

    const usedByType = new Map<string, number>();
    for (const booking of overlappingBookings ?? []) {
      const roomLines = (booking.booking_rooms ?? []) as {
        qty: number;
        room_type_id: string;
      }[];
      for (const line of roomLines) {
        usedByType.set(
          line.room_type_id,
          (usedByType.get(line.room_type_id) ?? 0) + Number(line.qty),
        );
      }
    }

    const lines: { room_type_id: string; qty: number; inventory_kind: string }[] =
      [];
    let guestRooms = 0;

    for (const rt of types) {
      const qty = parseNonNegInt(
        formData.get(`qty_${rt.code}`),
        `${rt.name} qty`,
        Math.max(rt.unit_count, 20),
      );
      if (qty === 0) continue;

      if (qty > rt.unit_count) {
        throw new Error(
          `${rt.name}: only ${rt.unit_count} units in inventory (requested ${qty}).`,
        );
      }

      const used = usedByType.get(rt.id) ?? 0;
      if (used + qty > rt.unit_count) {
        throw new Error(
          `${rt.name}: ${Math.max(rt.unit_count - used, 0)} left for these dates (requested ${qty}).`,
        );
      }

      lines.push({
        room_type_id: rt.id,
        qty,
        inventory_kind: rt.inventory_kind,
      });

      if (rt.inventory_kind === "sellable_guest") {
        guestRooms += qty;
      }
    }

    if (lines.length === 0) {
      throw new Error("Select at least one guest, guide, or driver bed.");
    }

    if (guestRooms < 1) {
      throw new Error("Add at least one sellable guest room.");
    }

    if (agentId) {
      const { data: agent } = await admin
        .from("agents")
        .select("id, status")
        .eq("id", agentId)
        .maybeSingle();
      if (!agent || !["approved", "demo"].includes(agent.status as string)) {
        throw new Error("Agent must be approved (or demo) to book.");
      }
    }

    const { data: booking, error: bookingError } = await admin
      .from("bookings")
      .insert({
        property_id: property.id,
        agent_id: agentId,
        source: source === "mou_agent" ? "agent" : source,
        booked_by_role: source,
        status: "confirmed",
        check_in: checkIn,
        check_out: checkOut,
        contact_name: contactName,
        contact_phone: contactPhone,
        contact_email: contactEmail,
        adults,
        rooms: guestRooms,
        guide_number: guideNumber,
        payment_mode: paymentMode,
        notes,
      })
      .select("id")
      .single();

    if (bookingError || !booking) {
      console.error("createFastBooking insert failed", bookingError);
      throw new Error("Could not save booking. Check schema migration is applied.");
    }

    const { error: linesError } = await admin.from("booking_rooms").insert(
      lines.map((line) => ({
        booking_id: booking.id,
        room_type_id: line.room_type_id,
        qty: line.qty,
        inventory_kind: line.inventory_kind,
      })),
    );

    if (linesError) {
      console.error("createFastBooking lines failed", linesError);
      await admin.from("bookings").delete().eq("id", booking.id);
      throw new Error("Could not save room lines. Apply fast-book migration.");
    }

    await admin.from("booking_guests").insert({
      booking_id: booking.id,
      full_name: contactName,
    });

    await notifyNewBooking({
      bookingId: booking.id,
      contactName,
      contactPhone,
      contactEmail,
      checkIn,
      checkOut,
      adults,
      rooms: guestRooms,
      guideNumber,
      notes: notes ? `[FAST-BOOK ${source}] ${notes}` : `[FAST-BOOK ${source}]`,
    });

    return { ok: true, bookingId: booking.id };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Something went wrong. Please try again.";
    return { ok: false, error: message };
  }
}
