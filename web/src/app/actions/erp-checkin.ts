"use server";

import { chargeAgentCredit } from "@/app/actions/erp-agents";
import { writeAuditEvent } from "@/lib/audit";
import { postMealPlanFolioLine } from "@/lib/folio/meal-plan";
import { postRoomNightsForBooking } from "@/lib/folio/room-night";
import { nationalityRequired } from "@/lib/countries";
import {
  normalizeGuestOrigin,
  validateCheckInDocs,
} from "@/lib/checkin-rules";
import { isDeskAuthenticated, requireMoneyDesk } from "@/lib/desk-auth";
import { assertDeskProperty } from "@/lib/desk/property-guard";
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

function revalidateCheckIn(folioId?: string) {
  revalidatePath("/erp");
  revalidatePath("/erp/check-in");
  revalidatePath("/erp/arrivals");
  revalidatePath("/erp/in-house");
  revalidatePath("/erp/departures");
  revalidatePath("/erp/calendar");
  revalidatePath("/erp/rooms");
  revalidatePath("/erp/agents");
  if (folioId) revalidatePath(`/erp/folios/${folioId}`);
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

function parseGuestRows(formData: FormData): Array<{
  fullName: string;
  nationality: string;
  passportOrCid: string;
  sdfRef: string;
  sdfDocUrl: string;
  roomUnitId: string | null;
}> {
  const names = formData.getAll("guest_name").map((v) => String(v ?? ""));
  const nationalities = formData
    .getAll("guest_nationality")
    .map((v) => String(v ?? ""));
  const ids = formData.getAll("guest_passport_or_cid").map((v) => String(v ?? ""));
  const sdfRefs = formData.getAll("guest_sdf_ref").map((v) => String(v ?? ""));
  const sdfUrls = formData.getAll("guest_sdf_doc_url").map((v) => String(v ?? ""));
  const roomUnits = formData
    .getAll("guest_room_unit_id")
    .map((v) => String(v ?? "").trim() || null);

  // Backward-compatible single-guest field names from older form.
  if (names.length === 0 && formData.get("guest_name")) {
    return [
      {
        fullName: String(formData.get("guest_name") ?? ""),
        nationality: String(formData.get("nationality") ?? ""),
        passportOrCid: String(formData.get("passport_or_cid") ?? ""),
        sdfRef: String(formData.get("sdf_ref") ?? ""),
        sdfDocUrl: String(formData.get("sdf_doc_url") ?? ""),
        roomUnitId: optionalTrim(formData.get("guest_room_unit_id")),
      },
    ];
  }

  return names.map((fullName, i) => ({
    fullName,
    nationality: nationalities[i] ?? "",
    passportOrCid: ids[i] ?? "",
    sdfRef: sdfRefs[i] ?? "",
    sdfDocUrl: sdfUrls[i] ?? "",
    roomUnitId: roomUnits[i] ?? null,
  }));
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
    const paymentMode = trimRequired(formData.get("payment_mode"), "Payment mode");
    if (!PAYMENT_MODES.has(paymentMode)) {
      throw new Error("Choose prepaid, partial, on credit, or cash.");
    }

    const driverName = optionalTrim(formData.get("driver_name"));
    const driverPhone = optionalTrim(formData.get("driver_phone"));
    const vehicleNo = optionalTrim(formData.get("vehicle_no"));
    const licenseNo = optionalTrim(formData.get("license_no"));
    const guideIdRaw = optionalTrim(formData.get("guide_id"));
    const driverIdRaw = optionalTrim(formData.get("driver_id"));
    const requireClean = formData.get("allow_dirty_rooms") !== "on";

    const roomUnitIds = formData
      .getAll("room_unit_id")
      .map((v) => String(v ?? "").trim())
      .filter(Boolean);

    if (driverPhone) assertPhone(driverPhone);

    const guests = parseGuestRows(formData);

    const admin = createSupabaseAdminClient();
    const property_id = await propertyId(admin);

    const { data: booking, error: bookingError } = await admin
      .from("bookings")
      .select(
        "id, status, contact_name, check_in, check_out, agent_id, payment_mode, guest_origin, booked_by_role, meal_plan_code, meal_plan_amount_btn, property_id, booking_rooms(qty, inventory_kind, room_type_id)",
      )
      .eq("id", bookingId)
      .single();

    if (bookingError || !booking) {
      throw new Error("Booking not found.");
    }
    assertDeskProperty(property_id, booking.property_id as string, "Booking");

    const status = booking.status as string;
    if (!["pending", "confirmed"].includes(status)) {
      throw new Error(`Cannot check in a booking with status ${status}.`);
    }

    const guestOrigin = normalizeGuestOrigin(
      (booking.guest_origin as string | null) ?? "international",
    );
    const rooms =
      (booking.booking_rooms as
        | { qty: number; inventory_kind: string; room_type_id: string }[]
        | null) ?? [];
    const hasDriverBeds = rooms.some(
      (r) => r.inventory_kind === "driver_comp" && Number(r.qty) > 0,
    );

    const docsError = validateCheckInDocs({
      origin: guestOrigin,
      guideNumber,
      guests: guests.map((g) => ({
        fullName: g.fullName,
        passportOrCid: g.passportOrCid,
        sdfRef: g.sdfRef,
      })),
      hasDriverBeds,
      driverName,
    });
    if (docsError) throw new Error(docsError);

    if (nationalityRequired(guestOrigin)) {
      for (const [i, g] of guests.entries()) {
        if (!g.nationality.trim()) {
          throw new Error(`Guest ${i + 1}: nationality is required for ${guestOrigin} guests.`);
        }
      }
    }

    if (roomUnitIds.length === 0) {
      throw new Error("Assign physical rooms before confirming check-in.");
    }
    if (new Set(roomUnitIds).size !== roomUnitIds.length) {
      throw new Error("Each physical room can only be assigned once.");
    }

    if (paymentMode === "on_credit") {
      const agentId = booking.agent_id as string | null;
      if (!agentId) {
        throw new Error("On-credit check-in requires an agent on the booking.");
      }
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

    const { error: roomsError } = await admin.rpc("desk_apply_check_in_rooms", {
      p_property_id: property_id,
      p_booking_id: bookingId,
      p_unit_ids: roomUnitIds,
      p_require_clean: requireClean,
    });
    if (roomsError) {
      throw new Error(roomsError.message || "Could not assign rooms.");
    }

    const { data: assignments } = await admin
      .from("room_assignments")
      .select(
        "id, room_unit_id, room_units(room_types(inventory_kind))",
      )
      .eq("booking_id", bookingId);

    const assignmentByUnit = new Map<string, string>();
    const guestAssignments: string[] = [];
    let guideAssignmentId: string | null = null;
    let driverAssignmentId: string | null = null;
    for (const row of assignments ?? []) {
      assignmentByUnit.set(row.room_unit_id as string, row.id as string);
      const unitRaw = row.room_units as
        | {
            room_types?:
              | { inventory_kind?: string }
              | { inventory_kind?: string }[]
              | null;
          }
        | {
            room_types?:
              | { inventory_kind?: string }
              | { inventory_kind?: string }[]
              | null;
          }[]
        | null;
      const unit = Array.isArray(unitRaw) ? unitRaw[0] : unitRaw;
      const rt = unit?.room_types;
      const kind = (
        Array.isArray(rt) ? rt[0]?.inventory_kind : rt?.inventory_kind
      ) as string | undefined;
      if (kind === "sellable_guest") guestAssignments.push(row.id as string);
      if (kind === "guide_comp" && !guideAssignmentId) {
        guideAssignmentId = row.id as string;
      }
      if (kind === "driver_comp" && !driverAssignmentId) {
        driverAssignmentId = row.id as string;
      }
    }

    const todayIso = new Date().toISOString().slice(0, 10);
    let resolvedGuideId: string | null = guideIdRaw || null;
    let resolvedDriverId: string | null = driverIdRaw || null;

    if (!resolvedGuideId && guideNumber) {
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
      const { data: newDriver, error: dErr } = await admin
        .from("drivers")
        .insert({
          property_id,
          full_name: driverName || null,
          phone: driverPhone || null,
          vehicle_no: vehicleNo || null,
          license_no: licenseNo || null,
          visit_count: 1,
          last_seen_at: todayIso,
        })
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

    if (resolvedGuideId) {
      const { data: guideRow } = await admin
        .from("guides")
        .select("visit_count")
        .eq("id", resolvedGuideId)
        .maybeSingle();
      await admin
        .from("guides")
        .update({
          last_seen_at: todayIso,
          visit_count: Number(guideRow?.visit_count ?? 0) + 1,
        })
        .eq("id", resolvedGuideId);
    }
    if (resolvedDriverId) {
      const { data: driverRow } = await admin
        .from("drivers")
        .select("visit_count")
        .eq("id", resolvedDriverId)
        .maybeSingle();
      await admin
        .from("drivers")
        .update({
          last_seen_at: todayIso,
          visit_count: Number(driverRow?.visit_count ?? 0) + 1,
        })
        .eq("id", resolvedDriverId);
    }

    const primaryGuest = guests[0];
    const { error: bookingPatchError } = await admin
      .from("bookings")
      .update({
        guide_number: guideNumber,
        guide_id: resolvedGuideId,
        driver_id: resolvedDriverId,
        payment_mode: paymentMode,
        status: "checked_in",
        checked_in_at: new Date().toISOString(),
        contact_name: primaryGuest.fullName.trim(),
      })
      .eq("id", bookingId);
    if (bookingPatchError) {
      throw new Error("Could not update booking status.");
    }

    await admin.from("booking_guests").delete().eq("booking_id", bookingId);
    await admin.from("room_assignment_occupants").delete().eq("booking_id", bookingId);

    const guestRows = guests.map((g, i) => {
      const unitId = g.roomUnitId;
      const assignmentId =
        (unitId ? assignmentByUnit.get(unitId) : null) ??
        guestAssignments[Math.min(i, guestAssignments.length - 1)] ??
        null;
      return {
        booking_id: bookingId,
        full_name: g.fullName.trim(),
        nationality: g.nationality.trim() || null,
        passport_or_cid: g.passportOrCid.trim(),
        sdf_ref: g.sdfRef.trim() || null,
        sdf_doc_url: g.sdfDocUrl.trim() || null,
        room_assignment_id: assignmentId,
        sort_order: i,
      };
    });

    const { data: insertedGuests, error: guestError } = await admin
      .from("booking_guests")
      .insert(guestRows)
      .select("id, full_name, room_assignment_id");
    if (guestError || !insertedGuests) {
      console.error("booking_guests insert failed", guestError);
      throw new Error("Could not save guest documents.");
    }

    const occupantRows: Array<Record<string, unknown>> = [];
    for (const g of insertedGuests) {
      if (!g.room_assignment_id) continue;
      occupantRows.push({
        property_id,
        assignment_id: g.room_assignment_id,
        booking_id: bookingId,
        occupant_kind: "guest",
        booking_guest_id: g.id,
        display_name: g.full_name,
      });
    }
    if (guideAssignmentId && (guideNumber || primaryGuest.fullName)) {
      occupantRows.push({
        property_id,
        assignment_id: guideAssignmentId,
        booking_id: bookingId,
        occupant_kind: "guide",
        display_name: guideNumber
          ? `Guide #${guideNumber}`
          : "Guide",
      });
    }
    if (driverAssignmentId && driverName) {
      occupantRows.push({
        property_id,
        assignment_id: driverAssignmentId,
        booking_id: bookingId,
        occupant_kind: "driver",
        display_name: driverName,
      });
    }
    if (occupantRows.length) {
      await admin.from("room_assignment_occupants").insert(occupantRows);
    }

    if (driverName) {
      await admin.from("booking_drivers").delete().eq("booking_id", bookingId);
      await admin.from("booking_drivers").insert({
        booking_id: bookingId,
        full_name: driverName,
        phone: driverPhone,
        vehicle_no: vehicleNo,
        license_no: licenseNo,
      });
    }

    const folioId = await ensureOpenFolio(
      admin,
      property_id,
      bookingId,
      `${primaryGuest.fullName.trim()} · ${booking.check_in as string}`,
    );

    const chargeNotes: string[] = [];
    const mealAmount = Number(booking.meal_plan_amount_btn ?? 0);
    if (mealAmount > 0) {
      const { data: mealPlan } = await admin
        .from("meal_plans")
        .select("name")
        .eq("property_id", property_id)
        .eq("code", booking.meal_plan_code as string)
        .maybeSingle();
      try {
        const mealResult = await postMealPlanFolioLine(admin, property_id, {
          folioId,
          bookingId,
          mealPlanCode: (booking.meal_plan_code as string) ?? "EP",
          mealPlanName: (mealPlan?.name as string) ?? "Meals",
          mealPlanAmountBtn: mealAmount,
          businessDate: booking.check_in as string,
        });
        if (mealResult.posted) chargeNotes.push("meal plan");
      } catch (mealErr) {
        console.error("meal plan post failed", mealErr);
        chargeNotes.push(
          `meal plan failed: ${mealErr instanceof Error ? mealErr.message : "error"}`,
        );
      }
    }

    // Day-1 room rent posts at check-in (default). Later nights: night audit (idempotent).
    const { data: propFlags } = await admin
      .from("properties")
      .select("post_day1_room_at_checkin")
      .eq("id", property_id)
      .maybeSingle();
    const postDay1 = propFlags?.post_day1_room_at_checkin !== false;
    if (postDay1) {
      try {
        const roomResult = await postRoomNightsForBooking(
          admin,
          property_id,
          bookingId,
          booking.check_in as string,
        );
        if (roomResult.posted > 0) {
          chargeNotes.push(`${roomResult.posted} room night(s)`);
        } else if (roomResult.errors.length > 0) {
          chargeNotes.push(
            `room night: ${roomResult.errors.slice(0, 2).join("; ")}`,
          );
        } else if (roomResult.skipped > 0) {
          chargeNotes.push("room night already posted");
        }
      } catch (roomErr) {
        console.error("day-1 room night post failed", roomErr);
        chargeNotes.push(
          `room night failed: ${roomErr instanceof Error ? roomErr.message : "error"}`,
        );
      }
    }

    await writeAuditEvent(admin, {
      propertyId: property_id,
      action: "booking.check_in",
      entityType: "bookings",
      entityId: bookingId,
      summary: `Checked in ${primaryGuest.fullName.trim()} · ${roomUnitIds.length} room(s)`,
      meta: {
        paymentMode,
        guestCount: guests.length,
        roomUnitIds,
        folioId,
        charges: chargeNotes,
      },
    });

    revalidateCheckIn(folioId);
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
    await requireMoneyDesk();

    const bookingId = trimRequired(formData.get("booking_id"), "Booking");
    const allowBalance = formData.get("allow_balance") === "on";
    const earlyFeeRaw = optionalTrim(formData.get("early_checkout_fee_btn"));
    const earlyFee = earlyFeeRaw ? Number(earlyFeeRaw) : 0;
    if (earlyFeeRaw && (!Number.isFinite(earlyFee) || earlyFee < 0)) {
      throw new Error("Early checkout fee must be a non-negative amount.");
    }

    const admin = createSupabaseAdminClient();
    const property_id = await propertyId(admin);

    const { data: booking, error: bookingError } = await admin
      .from("bookings")
      .select("id, status, contact_name, property_id")
      .eq("id", bookingId)
      .single();

    if (bookingError || !booking) {
      throw new Error("Booking not found.");
    }
    assertDeskProperty(property_id, booking.property_id as string, "Booking");
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

    if (earlyFee > 0.009) {
      if (!folio) {
        throw new Error("Open a folio before posting an early checkout fee.");
      }
      const { postFolioCharge } = await import("@/lib/folio/post-charge");
      const { DEFAULT_GST_RATE } = await import("@/lib/property-settings");
      const { data: prop } = await admin
        .from("properties")
        .select("gst_rate")
        .eq("id", property_id)
        .maybeSingle();
      const gstRate = Number(prop?.gst_rate ?? DEFAULT_GST_RATE);
      const amountBtn = roundBtn(earlyFee);
      const gstBtn = gstRate > 0 ? roundBtn(amountBtn * gstRate) : 0;
      await postFolioCharge(admin, property_id, {
        folio_id: folio.id as string,
        booking_id: bookingId,
        source_type: "service",
        description: "Early checkout fee",
        qty: 1,
        unit_price_btn: amountBtn,
        amount_btn: amountBtn,
        gst_applicable: gstBtn > 0,
        gst_btn: gstBtn,
        total_btn: roundBtn(amountBtn + gstBtn),
      });
    }

    let balance = 0;
    if (folio) {
      const { data: refreshed } = await admin
        .from("folios")
        .select("id, folio_lines(total_btn, status)")
        .eq("id", folio.id)
        .maybeSingle();
      const lines =
        ((refreshed ?? folio).folio_lines as
          | { total_btn: number; status: string }[]
          | null) ?? [];
      balance = lines
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

    const { error: releaseError } = await admin.rpc(
      "desk_release_check_out_rooms",
      {
        p_property_id: property_id,
        p_booking_id: bookingId,
      },
    );
    if (releaseError) {
      console.error("desk_release_check_out_rooms failed", releaseError);
      throw new Error("Could not release rooms for housekeeping.");
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

    await writeAuditEvent(admin, {
      propertyId: property_id,
      action: "booking.check_out",
      entityType: "bookings",
      entityId: bookingId,
      summary: `Checked out ${(booking.contact_name as string) ?? "guest"}`,
      meta: {
        folioBalance: balance,
        allowBalance,
        earlyCheckoutFee: earlyFee > 0 ? earlyFee : undefined,
      },
    });

    revalidateCheckIn(folio?.id as string | undefined);
    return { ok: true, bookingId };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Something went wrong.",
    };
  }
}
