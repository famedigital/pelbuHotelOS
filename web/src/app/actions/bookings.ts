"use server";

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

    const { data: booking, error: bookingError } = await admin
      .from("bookings")
      .insert({
        property_id: property.id,
        source: "client",
        status: "pending",
        check_in: checkIn,
        check_out: checkOut,
        contact_name: contactName,
        contact_phone: contactPhone,
        contact_email: contactEmail,
        adults,
        rooms,
        guide_number: guideNumber,
        notes,
      })
      .select("id")
      .single();

    if (bookingError || !booking) {
      console.error("createBooking insert failed", bookingError);
      throw new Error("Could not save your booking. Please try again.");
    }

    const { error: guestError } = await admin.from("booking_guests").insert({
      booking_id: booking.id,
      full_name: contactName,
    });

    if (guestError) {
      console.error("createBooking guest insert failed", guestError);
      // Booking exists; still treat as success for the guest.
    }

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
      notes,
    });

    return { ok: true, bookingId: booking.id };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Something went wrong. Please try again.";
    return { ok: false, error: message };
  }
}
