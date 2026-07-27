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
    const packageName = optionalTrim(formData.get("package_name"));
    const notes = optionalTrim(formData.get("notes"));
    const roomOrBookingRef = optionalTrim(formData.get("room_or_booking_ref"));
    const chargeToRoom = formData.get("charge_to_room") === "on";

    const maxParty = kind === "meeting" ? 25 : 6;
    const partySize = parsePositiveInt(
      formData.get("party_size"),
      kind === "meeting" ? "Attendees" : "Guests",
      maxParty,
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
      throw new Error("Add your room number or booking reference to charge the folio.");
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
        room_or_booking_ref: roomOrBookingRef,
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
      roomOrBookingRef,
      notes,
    });

    return { ok: true, requestId: request.id };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Something went wrong. Please try again.";
    return { ok: false, error: message };
  }
}
