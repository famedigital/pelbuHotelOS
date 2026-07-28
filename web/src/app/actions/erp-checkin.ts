"use server";

import { isDeskAuthenticated } from "@/lib/desk-auth";
import { PELBU_PROPERTY_SLUG } from "@/lib/property";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  assertPhone,
  optionalTrim,
  trimRequired,
} from "@/lib/validation";
import { revalidatePath } from "next/cache";

const PAYMENT_MODES = new Set(["prepaid", "partial", "on_credit", "cash"]);

type Admin = ReturnType<typeof createSupabaseAdminClient>;

async function requireDesk() {
  if (!(await isDeskAuthenticated())) {
    throw new Error("Desk session expired. Sign in again.");
  }
}

async function propertyId(admin: Admin) {
  const { data: property, error } = await admin
    .from("properties")
    .select("id")
    .eq("slug", PELBU_PROPERTY_SLUG)
    .single();
  if (error || !property) {
    throw new Error("Hotel property is not configured.");
  }
  return property.id as string;
}

async function ensureOpenFolio(
  admin: Admin,
  property_id: string,
  bookingId: string,
  label: string,
): Promise<string> {
  const { data: existingFolio } = await admin
    .from("folios")
    .select("id")
    .eq("booking_id", bookingId)
    .eq("status", "open")
    .order("created_at")
    .limit(1)
    .maybeSingle();

  if (existingFolio?.id) return existingFolio.id as string;

  const { data: folio, error } = await admin
    .from("folios")
    .insert({
      property_id,
      booking_id: bookingId,
      folio_type: "guest",
      label,
      status: "open",
    })
    .select("id")
    .single();

  if (error || !folio) {
    throw new Error("Could not open guest folio.");
  }
  return folio.id as string;
}

export type CheckInState = {
  ok: boolean;
  bookingId?: string;
  folioId?: string;
  error?: string;
};

export async function confirmCheckIn(
  _prev: CheckInState,
  formData: FormData,
): Promise<CheckInState> {
  try {
    await requireDesk();

    const bookingId = trimRequired(formData.get("booking_id"), "Booking");
    const guideNumber = trimRequired(formData.get("guide_number"), "Guide number");
    const guestName = trimRequired(formData.get("guest_name"), "Guest name");
    const nationality = optionalTrim(formData.get("nationality"));
    const passportOrCid = trimRequired(
      formData.get("passport_or_cid"),
      "Passport / CID",
    );
    const sdfRef = trimRequired(formData.get("sdf_ref"), "SDF reference");
    const sdfDocUrl = optionalTrim(formData.get("sdf_doc_url"));

    const paymentMode = trimRequired(formData.get("payment_mode"), "Payment mode");
    if (!PAYMENT_MODES.has(paymentMode)) {
      throw new Error("Choose prepaid, partial, on credit, or cash.");
    }

    const driverName = optionalTrim(formData.get("driver_name"));
    const driverPhone = optionalTrim(formData.get("driver_phone"));
    const vehicleNo = optionalTrim(formData.get("vehicle_no"));
    const licenseNo = optionalTrim(formData.get("license_no"));

    if (driverPhone) assertPhone(driverPhone);

    const admin = createSupabaseAdminClient();
    const property_id = await propertyId(admin);

    const { data: booking, error: bookingError } = await admin
      .from("bookings")
      .select(
        "id, status, contact_name, check_in, check_out, booking_rooms(qty, inventory_kind)",
      )
      .eq("id", bookingId)
      .eq("property_id", property_id)
      .single();

    if (bookingError || !booking) {
      throw new Error("Booking not found.");
    }

    const status = booking.status as string;
    if (!["pending", "confirmed"].includes(status)) {
      throw new Error(`Cannot check in a booking with status ${status}.`);
    }

    const rooms = (booking.booking_rooms as { qty: number; inventory_kind: string }[] | null) ?? [];
    const hasDriverBeds = rooms.some(
      (r) => r.inventory_kind === "driver_comp" && Number(r.qty) > 0,
    );
    if (hasDriverBeds && !driverName) {
      throw new Error("Driver name is required when driver beds are assigned.");
    }

    const { error: bookingPatchError } = await admin
      .from("bookings")
      .update({
        guide_number: guideNumber,
        payment_mode: paymentMode,
        status: "checked_in",
        checked_in_at: new Date().toISOString(),
        contact_name: guestName,
      })
      .eq("id", bookingId);

    if (bookingPatchError) {
      throw new Error("Could not update booking status.");
    }

    const { data: existingGuests } = await admin
      .from("booking_guests")
      .select("id")
      .eq("booking_id", bookingId)
      .limit(1);

    if (existingGuests && existingGuests.length > 0) {
      await admin
        .from("booking_guests")
        .update({
          full_name: guestName,
          nationality,
          passport_or_cid: passportOrCid,
          sdf_ref: sdfRef,
          sdf_doc_url: sdfDocUrl,
        })
        .eq("id", existingGuests[0].id);
    } else {
      await admin.from("booking_guests").insert({
        booking_id: bookingId,
        full_name: guestName,
        nationality,
        passport_or_cid: passportOrCid,
        sdf_ref: sdfRef,
        sdf_doc_url: sdfDocUrl,
      });
    }

    if (driverName) {
      const { data: existingDrivers } = await admin
        .from("booking_drivers")
        .select("id")
        .eq("booking_id", bookingId)
        .limit(1);

      if (existingDrivers && existingDrivers.length > 0) {
        await admin
          .from("booking_drivers")
          .update({
            full_name: driverName,
            phone: driverPhone,
            vehicle_no: vehicleNo,
            license_no: licenseNo,
          })
          .eq("id", existingDrivers[0].id);
      } else {
        await admin.from("booking_drivers").insert({
          booking_id: bookingId,
          full_name: driverName,
          phone: driverPhone,
          vehicle_no: vehicleNo,
          license_no: licenseNo,
        });
      }
    }

    const folioId = await ensureOpenFolio(
      admin,
      property_id,
      bookingId,
      `${guestName} · ${booking.check_in as string}`,
    );

    revalidatePath("/erp");
    revalidatePath("/erp/check-in");
    revalidatePath(`/erp/folios/${folioId}`);

    return { ok: true, bookingId, folioId };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Something went wrong.",
    };
  }
}

export type CheckOutState = {
  ok: boolean;
  bookingId?: string;
  error?: string;
};

export async function confirmCheckOut(
  _prev: CheckOutState,
  formData: FormData,
): Promise<CheckOutState> {
  try {
    await requireDesk();

    const bookingId = trimRequired(formData.get("booking_id"), "Booking");
    const allowBalance = formData.get("allow_balance") === "on";

    const admin = createSupabaseAdminClient();
    const property_id = await propertyId(admin);

    const { data: booking, error: bookingError } = await admin
      .from("bookings")
      .select("id, status")
      .eq("id", bookingId)
      .eq("property_id", property_id)
      .single();

    if (bookingError || !booking) {
      throw new Error("Booking not found.");
    }
    if ((booking.status as string) !== "checked_in") {
      throw new Error("Only checked-in bookings can be checked out.");
    }

    const { data: folio } = await admin
      .from("folios")
      .select("id, folio_lines(total_btn, status)")
      .eq("booking_id", bookingId)
      .eq("status", "open")
      .order("created_at")
      .limit(1)
      .maybeSingle();

    if (folio) {
      const balance = ((folio.folio_lines as { total_btn: number; status: string }[] | null) ?? [])
        .filter((l) => l.status === "posted")
        .reduce((sum, l) => sum + Number(l.total_btn), 0);

      if (Math.abs(balance) > 0.009 && !allowBalance) {
        throw new Error(
          `Folio balance is Nu ${balance.toFixed(2)}. Settle payment or tick allow balance to checkout.`,
        );
      }

      await admin
        .from("folios")
        .update({
          status: Math.abs(balance) <= 0.009 ? "settled" : "closed",
          closed_at: new Date().toISOString(),
        })
        .eq("id", folio.id);
    }

    const { error: patchError } = await admin
      .from("bookings")
      .update({
        status: "checked_out",
        checked_out_at: new Date().toISOString(),
      })
      .eq("id", bookingId);

    if (patchError) {
      throw new Error("Could not check out booking.");
    }

    revalidatePath("/erp");
    revalidatePath("/erp/check-in");
    if (folio?.id) revalidatePath(`/erp/folios/${folio.id}`);

    return { ok: true, bookingId };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Something went wrong.",
    };
  }
}
