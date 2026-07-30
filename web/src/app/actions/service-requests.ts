"use server";

import { notifyNewServiceRequest } from "@/lib/notify";
import { PELBU_PROPERTY_SLUG } from "@/lib/property";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  assertOnOrAfterToday,
  assertOptionalEmail,
  assertPhone,
  optionalTrim,
  parsePositiveInt,
  trimRequired,
} from "@/lib/validation";

export type ServiceRequestState = {
  ok: boolean;
  requestId?: string;
  error?: string;
};

export type ServiceKind = "spa" | "meeting" | "steam";

const KINDS = new Set<ServiceKind>(["spa", "meeting", "steam"]);

export async function createServiceRequest(
  _prev: ServiceRequestState,
  formData: FormData,
): Promise<ServiceRequestState> {
  try {
    const kindRaw = trimRequired(formData.get("kind"), "Service type").toLowerCase();
    if (!KINDS.has(kindRaw as ServiceKind)) {
      throw new Error("Invalid service type.");
    }
    const kind = kindRaw as ServiceKind;

    const contactName = trimRequired(formData.get("contact_name"), "Full name");
    const contactPhone = trimRequired(formData.get("contact_phone"), "Phone");
    assertPhone(contactPhone);

    const contactEmail = optionalTrim(formData.get("contact_email"));
    assertOptionalEmail(contactEmail);

    const preferredOn = trimRequired(formData.get("preferred_on"), "Preferred date");
    assertOnOrAfterToday(preferredOn, "Preferred date");

    const preferredTime = optionalTrim(formData.get("preferred_time"));
    let packageName = optionalTrim(formData.get("package_name"));
    const offeringId = optionalTrim(formData.get("offering_id"));
    const notes = optionalTrim(formData.get("notes"));
    const roomOrBookingRef = optionalTrim(formData.get("room_or_booking_ref"));
    const chargeToRoom = formData.get("charge_to_room") === "on";

    const partySize = parsePositiveInt(
      formData.get("party_size"),
      kind === "meeting" ? "Attendees" : "Guests",
      40,
    );

    let durationHours: number | null = null;
    if (kind === "meeting") {
      const raw = optionalTrim(formData.get("duration_hours"));
      if (!raw) {
        throw new Error("Meeting duration is required.");
      }
      const hours = Number(raw);
      if (!Number.isFinite(hours) || hours < 1 || hours > 12) {
        throw new Error("Duration must be between 1 and 12 hours.");
      }
      durationHours = hours;
    }

    if (chargeToRoom && !roomOrBookingRef) {
      throw new Error(
        "Add your room number or booking reference to charge the folio.",
      );
    }

    const admin = createSupabaseAdminClient();

    const { data: property, error: propertyError } = await admin
      .from("properties")
      .select("id")
      .eq("slug", PELBU_PROPERTY_SLUG)
      .single();

    if (propertyError || !property) {
      throw new Error("Hotel property is not configured. Please call the desk.");
    }

    // Charge-to-room is a desk-confirmed preference only. Verify the guest is
    // currently in-house and owns the reference; never auto-post to a folio.
    let verifiedBookingRef: string | null = null;
    if (chargeToRoom && roomOrBookingRef) {
      verifiedBookingRef = await resolveInHouseChargeRef(
        admin,
        property.id as string,
        roomOrBookingRef,
        contactPhone,
      );
      if (!verifiedBookingRef) {
        throw new Error(
          "That room or booking is not an active in-house stay for this phone. Ask the desk to charge your folio.",
        );
      }
    }

    if (offeringId) {
      const { data: offering, error: offeringError } = await admin
        .from("service_offerings")
        .select("kind, name, capacity")
        .eq("id", offeringId)
        .eq("property_id", property.id)
        .eq("is_active", true)
        .maybeSingle();

      if (offeringError || !offering || offering.kind !== kind) {
        throw new Error("That service option is no longer available. Refresh and try again.");
      }
      if (offering.capacity != null && partySize > Number(offering.capacity)) {
        throw new Error(
          `This option accommodates up to ${Number(offering.capacity)} people.`,
        );
      }
      packageName = offering.name as string;
    }

    const { data: request, error } = await admin
      .from("service_requests")
      .insert({
        property_id: property.id,
        kind,
        contact_name: contactName,
        contact_phone: contactPhone,
        contact_email: contactEmail,
        preferred_on: preferredOn,
        preferred_time: preferredTime,
        party_size: partySize,
        duration_hours: durationHours,
        package_name: packageName,
        charge_to_room: chargeToRoom,
        room_or_booking_ref: verifiedBookingRef ?? roomOrBookingRef,
        notes,
        status: "pending",
      })
      .select("id")
      .single();

    if (error || !request) {
      console.error("createServiceRequest insert failed", error);
      throw new Error("Could not submit your request. Please try again.");
    }

    await notifyNewServiceRequest({
      requestId: request.id,
      kind,
      contactName,
      contactPhone,
      contactEmail,
      preferredOn,
      preferredTime,
      partySize,
      durationHours,
      packageName,
      chargeToRoom,
      roomOrBookingRef: verifiedBookingRef ?? roomOrBookingRef,
      notes,
    });

    return { ok: true, requestId: request.id };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Something went wrong. Please try again.";
    return { ok: false, error: message };
  }
}

function digitsOnly(value: string): string {
  return value.replace(/\D+/g, "");
}

/**
 * Accepts a booking UUID/prefix or an assigned room label, but only for an
 * in-house stay whose contact phone matches the requester.
 */
async function resolveInHouseChargeRef(
  admin: ReturnType<typeof createSupabaseAdminClient>,
  propertyId: string,
  rawRef: string,
  contactPhone: string,
): Promise<string | null> {
  const ref = rawRef.trim();
  if (!ref) return null;
  const phoneDigits = digitsOnly(contactPhone);
  if (phoneDigits.length < 7) return null;

  const { data: bookings } = await admin
    .from("bookings")
    .select("id, contact_phone")
    .eq("property_id", propertyId)
    .eq("status", "checked_in");

  const owned = (bookings ?? []).filter((booking) => {
    const bookingPhone = digitsOnly(String(booking.contact_phone ?? ""));
    return (
      bookingPhone.length >= 7 &&
      (bookingPhone.endsWith(phoneDigits) || phoneDigits.endsWith(bookingPhone))
    );
  });
  if (owned.length === 0) return null;

  const ownedIds = new Set(owned.map((booking) => booking.id as string));
  const normalized = ref.toLowerCase();

  for (const booking of owned) {
    const id = booking.id as string;
    if (
      id === ref ||
      id.toLowerCase() === normalized ||
      id.slice(0, 8).toLowerCase() === normalized
    ) {
      return id;
    }
  }

  const { data: assignments } = await admin
    .from("room_assignments")
    .select("booking_id, room_units(label)")
    .eq("property_id", propertyId)
    .in("booking_id", [...ownedIds]);

  for (const assignment of assignments ?? []) {
    const bookingId = assignment.booking_id as string | null;
    if (!bookingId || !ownedIds.has(bookingId)) continue;
    const unit = assignment.room_units as
      | { label?: string | null }
      | { label?: string | null }[]
      | null;
    const label = Array.isArray(unit) ? unit[0]?.label : unit?.label;
    if (label && label.trim().toLowerCase() === normalized) {
      return bookingId;
    }
  }

  return null;
}
