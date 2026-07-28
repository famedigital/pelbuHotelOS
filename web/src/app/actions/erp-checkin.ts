"use server";

import { chargeAgentCredit } from "@/app/actions/erp-agents";
import { isDeskAuthenticated } from "@/lib/desk-auth";
import { roundBtn } from "@/lib/pricing";
import { resolveActivePropertyId } from "@/lib/property-context";
import {
  agentRateTier,
  lookupRoomRateBtn,
  nightsBetween,
  resolveSeasonKind,
} from "@/lib/rates";
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
  return resolveActivePropertyId(admin);
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
    const guideNumber = optionalTrim(formData.get("guide_number"));
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

    // Master-partner ids (from autocomplete pick). If absent but free-text is
    // provided, the action will upsert a new master row below.
    const guideIdRaw = optionalTrim(formData.get("guide_id"));
    const driverIdRaw = optionalTrim(formData.get("driver_id"));

    if (driverPhone) assertPhone(driverPhone);

    const admin = createSupabaseAdminClient();
    const property_id = await propertyId(admin);

    const { data: booking, error: bookingError } = await admin
      .from("bookings")
      .select(
        "id, status, contact_name, check_in, check_out, agent_id, payment_mode, guest_origin, booking_rooms(qty, inventory_kind, room_type_id)",
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

    const guestOrigin = (booking.guest_origin as string | null) ?? "international";
    // Guide is only mandatory for international tourists. Regional / official /
    // local guests (locals, govt officials, domestic) may legitimately have none.
    if (guestOrigin === "international" && !guideNumber) {
      throw new Error(
        "Guide number is required for international tourists. Change the booking's guest origin if this guest has no guide.",
      );
    }

    const rooms = (booking.booking_rooms as { qty: number; inventory_kind: string; room_type_id: string }[] | null) ?? [];
    const hasDriverBeds = rooms.some(
      (r) => r.inventory_kind === "driver_comp" && Number(r.qty) > 0,
    );
    if (hasDriverBeds && !driverName) {
      throw new Error("Driver name is required when driver beds are assigned.");
    }

    if (paymentMode === "on_credit") {
      const agentId = booking.agent_id as string | null;
      if (!agentId) {
        throw new Error("On-credit check-in requires an agent on the booking.");
      }
      // Charge only if this booking has not already been charged (fast-book may have)
      const { data: priorCharge } = await admin
        .from("agent_credit_ledger")
        .select("id")
        .eq("booking_id", bookingId)
        .eq("entry_type", "charge")
        .limit(1)
        .maybeSingle();

      if (!priorCharge) {
        const { data: agent } = await admin
          .from("agents")
          .select("rate_tier")
          .eq("id", agentId)
          .single();
        const tier = agentRateTier(agent?.rate_tier as string | undefined);
        const nights = nightsBetween(
          booking.check_in as string,
          booking.check_out as string,
        );
        const season = await resolveSeasonKind(
          admin,
          property_id,
          booking.check_in as string,
        );
        let estimate = 0;
        for (const line of rooms) {
          if (line.inventory_kind !== "sellable_guest") continue;
          const rate = await lookupRoomRateBtn(admin, {
            propertyId: property_id,
            roomTypeId: line.room_type_id,
            seasonKind: season,
            rateTier: tier,
          });
          if (rate == null) {
            throw new Error("Missing room rate for on-credit check-in.");
          }
          estimate += rate * Number(line.qty) * nights;
        }
        const amount = roundBtn(estimate);
        if (amount > 0) {
          await chargeAgentCredit(admin, {
            agentId,
            amountBtn: amount,
            bookingId,
            note: `Check-in on credit · ${nights} night(s)`,
          });
        }
      }
    }

    // Resolve master-partner rows, upserting when staff typed a new one.
    const todayIso = new Date().toISOString().slice(0, 10);
    let resolvedGuideId: string | null = guideIdRaw || null;
    let resolvedDriverId: string | null = driverIdRaw || null;

    if (!resolvedGuideId && guideNumber) {
      // New guide typed free-text → insert. (Unique constraint protects dups;
      // if a concurrent insert wins, fall through to lookup by number.)
      const { data: newGuide, error: gErr } = await admin
        .from("guides")
        .insert({
          property_id,
          guide_number: guideNumber,
          visit_count: 1,
          last_seen_at: todayIso,
        })
        .select("id")
        .maybeSingle();
      if (gErr?.code === "23505") {
        const { data: existing } = await admin
          .from("guides")
          .select("id")
          .eq("property_id", property_id)
          .eq("guide_number", guideNumber)
          .maybeSingle();
        resolvedGuideId = (existing?.id as string | null) ?? null;
      } else {
        resolvedGuideId = (newGuide?.id as string | null) ?? null;
      }
    }

    if (!resolvedDriverId && (driverPhone || driverName)) {
      const driverPayload = {
        property_id,
        full_name: driverName || null,
        phone: driverPhone || null,
        vehicle_no: vehicleNo || null,
        license_no: licenseNo || null,
        visit_count: 1,
        last_seen_at: todayIso,
      };
      const { data: newDriver, error: dErr } = await admin
        .from("drivers")
        .insert(driverPayload)
        .select("id")
        .maybeSingle();
      if (dErr?.code === "23505" && driverPhone) {
        const { data: existing } = await admin
          .from("drivers")
          .select("id")
          .eq("property_id", property_id)
          .eq("phone", driverPhone)
          .maybeSingle();
        resolvedDriverId = (existing?.id as string | null) ?? null;
      } else {
        resolvedDriverId = (newDriver?.id as string | null) ?? null;
      }
    }

    // Bump last_seen_at on the chosen partner. visit_count is derived from
    // bookings at report time, so no increment needed here.
    if (resolvedGuideId) {
      await admin.from("guides").update({ last_seen_at: todayIso }).eq("id", resolvedGuideId);
    }
    if (resolvedDriverId) {
      await admin.from("drivers").update({ last_seen_at: todayIso }).eq("id", resolvedDriverId);
    }

    const { error: bookingPatchError } = await admin
      .from("bookings")
      .update({
        guide_number: guideNumber,
        guide_id: resolvedGuideId,
        driver_id: resolvedDriverId,
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
    revalidatePath("/erp/agents");
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
