"use server";

import { ensurePaymentLinkForBooking } from "@/app/actions/erp-holds";
import {
  computeTokenRequiredBtn,
  holdExpiresAtFromNow,
  resolveHoldTtlHours,
} from "@/lib/holds";
import { soldQtyByRoomType } from "@/lib/inventory-availability";
import { notifyNewBooking } from "@/lib/notify";
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

export type BookingActionState = {
  ok: boolean;
  bookingId?: string;
  paymentUrl?: string;
  tokenAmount?: number;
  holdExpiresAt?: string;
  error?: string;
};

export async function createBooking(
  _prev: BookingActionState,
  formData: FormData,
): Promise<BookingActionState> {
  try {
    const contactName = trimRequired(formData.get("contact_name"), "Full name");
    const contactPhone = trimRequired(formData.get("contact_phone"), "Phone");
    assertPhone(contactPhone);

    const contactEmail = optionalTrim(formData.get("contact_email"));
    assertOptionalEmail(contactEmail);

    const checkIn = trimRequired(formData.get("check_in"), "Check-in");
    const checkOut = trimRequired(formData.get("check_out"), "Check-out");
    assertStayDates(checkIn, checkOut);

    const adults = parsePositiveInt(formData.get("adults"), "Adults", 12);
    const rooms = parsePositiveInt(formData.get("rooms"), "Rooms", 6);
    const guideNumber = optionalTrim(formData.get("guide_number"));
    const notes = optionalTrim(formData.get("notes"));

    const admin = createSupabaseAdminClient();

    const { data: property, error: propertyError } = await admin
      .from("properties")
      .select("id")
      .eq("slug", PELBU_PROPERTY_SLUG)
      .single();

    if (propertyError || !property) {
      throw new Error("Hotel property is not configured. Please call the desk.");
    }

    const propertyId = property.id as string;

    const { data: roomTypes } = await admin
      .from("room_types")
      .select("id, code, unit_count")
      .eq("property_id", propertyId)
      .eq("inventory_kind", "sellable_guest")
      .order("code");

    if (!roomTypes?.length) {
      throw new Error("No rooms configured. Please call the desk.");
    }

    const sold = await soldQtyByRoomType(admin, propertyId, checkIn, checkOut);
    let assignedTypeId: string | null = null;
    for (const rt of roomTypes) {
      const capacity = Number(rt.unit_count ?? 0);
      const used = sold.get(rt.id as string) ?? 0;
      if (capacity - used >= rooms) {
        assignedTypeId = rt.id as string;
        break;
      }
    }
    if (!assignedTypeId) {
      throw new Error(
        "Not enough rooms free for those dates. Try fewer rooms or different dates, or call the desk.",
      );
    }

    const { hours } = await resolveHoldTtlHours(
      admin,
      propertyId,
      "client",
      checkIn,
    );
    const holdExpiresAt = holdExpiresAtFromNow(hours);
    const tokenRequired = await computeTokenRequiredBtn(admin, {
      propertyId,
      checkIn,
      roomLines: [{ roomTypeId: assignedTypeId, qty: rooms }],
    });

    const { data: booking, error: bookingError } = await admin
      .from("bookings")
      .insert({
        property_id: propertyId,
        source: "client",
        status: "held",
        check_in: checkIn,
        check_out: checkOut,
        contact_name: contactName,
        contact_phone: contactPhone,
        contact_email: contactEmail,
        adults,
        rooms,
        guide_number: guideNumber,
        notes,
        hold_expires_at: holdExpiresAt,
        token_required_btn: tokenRequired,
        payment_mode: "partial",
      })
      .select("id")
      .single();

    if (bookingError || !booking) {
      console.error("createBooking insert failed", bookingError);
      throw new Error("Could not save your booking. Please try again.");
    }

    const { error: linesError } = await admin.from("booking_rooms").insert({
      booking_id: booking.id,
      room_type_id: assignedTypeId,
      qty: rooms,
      inventory_kind: "sellable_guest",
    });

    if (linesError) {
      console.error("createBooking rooms failed", linesError);
      await admin.from("bookings").delete().eq("id", booking.id);
      throw new Error("Could not hold rooms. Please try again.");
    }

    const { error: guestError } = await admin.from("booking_guests").insert({
      booking_id: booking.id,
      full_name: contactName,
    });

    if (guestError) {
      console.error("createBooking guest insert failed", guestError);
    }

    const link = await ensurePaymentLinkForBooking(
      booking.id as string,
      propertyId,
    );

    await notifyNewBooking({
      bookingId: booking.id,
      contactName,
      contactPhone,
      contactEmail,
      checkIn,
      checkOut,
      adults,
      rooms,
      guideNumber,
      notes: notes
        ? `[HOLD token Nu ${tokenRequired}] ${notes}`
        : `[HOLD token Nu ${tokenRequired}]`,
    });

    const paymentUrl = link ? `/pay/${link.token}` : undefined;

    return {
      ok: true,
      bookingId: booking.id,
      paymentUrl,
      tokenAmount: tokenRequired,
      holdExpiresAt,
    };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Something went wrong. Please try again.";
    return { ok: false, error: message };
  }
}
