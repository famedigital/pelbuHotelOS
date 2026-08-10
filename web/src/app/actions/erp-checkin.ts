"use server";

import { chargeAgentCredit } from "@/app/actions/erp-agents";
import { writeAuditEvent } from "@/lib/audit";
import { postExtraBedFolioLine } from "@/lib/folio/extra-bed";
import { postMealPlanFolioLine } from "@/lib/folio/meal-plan";
import { postRoomNightsForBooking } from "@/lib/folio/room-night";
import { voidFolioLineWithReversal } from "@/lib/folio/void-line";
import {
  assertUndoCheckInLinesSafe,
  UNDO_CI_SAFE_SOURCE_TYPES,
} from "@/lib/checkin-undo";
import { nationalityRequired } from "@/lib/countries";
import {
  normalizeGuestOrigin,
  validateCheckInDocs,
} from "@/lib/checkin-rules";
import { isDeskAuthenticated, requireMoneyDesk } from "@/lib/desk-auth";
import { assertDeskProperty } from "@/lib/desk/property-guard";
import { calculateRoomNightTax, roundBtn } from "@/lib/pricing";
import { resolveActivePropertyId } from "@/lib/property-context";
import {
  agentRateTier,
  lookupRoomRateBtn,
  nightsBetween,
  resolveSeasonKind,
} from "@/lib/rates";
import { loadRoomRateTaxSettings } from "@/lib/room-rate-tax";
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
  idPhotoUrl: string;
  roomUnitId: string | null;
}> {
  const names = formData.getAll("guest_name").map((v) => String(v ?? ""));
  const nationalities = formData
    .getAll("guest_nationality")
    .map((v) => String(v ?? ""));
  const ids = formData.getAll("guest_passport_or_cid").map((v) => String(v ?? ""));
  const sdfRefs = formData.getAll("guest_sdf_ref").map((v) => String(v ?? ""));
  const sdfUrls = formData.getAll("guest_sdf_doc_url").map((v) => String(v ?? ""));
  const idPhotos = formData
    .getAll("guest_id_photo_url")
    .map((v) => String(v ?? ""));
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
        idPhotoUrl: String(formData.get("id_photo_url") ?? ""),
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
    idPhotoUrl: idPhotos[i] ?? "",
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
        "id, status, contact_name, check_in, check_out, agent_id, payment_mode, guest_origin, booked_by_role, meal_plan_code, meal_plan_amount_btn, extra_beds, extra_bed_amount_btn, quoted_total_btn, property_id, rooms, booking_rooms(qty, inventory_kind, room_type_id)",
      )
      .eq("id", bookingId)
      .single();

    if (bookingError || !booking) {
      throw new Error("Booking not found.");
    }
    assertDeskProperty(property_id, booking.property_id as string, "Booking");

    const { assertBusinessDateOpenForCheckIn } = await import(
      "@/lib/business-date"
    );
    const { getDeskRole } = await import("@/lib/desk-auth");
    const { isManagerDeskRole } = await import("@/lib/manager-pin-core");
    const { verifyManagerPinForProperty } = await import("@/lib/manager-pin");
    const businessGate = await assertBusinessDateOpenForCheckIn(
      admin,
      property_id,
      booking.check_in as string,
    );
    if (!businessGate.ok) {
      // Floor staff need manager PIN. GM/owner session may opt-in without PIN.
      const sessionRole = await getDeskRole();
      const sessionIsGmOwner =
        sessionRole != null && isManagerDeskRole(sessionRole);
      const overridePin = optionalTrim(formData.get("manager_pin"));
      const sessionOverride =
        formData.get("business_date_override") === "on" ||
        formData.get("past_check_in_ack") === "on";

      let overrideSource: "session_gm" | "manager_pin" | null = null;
      let pinSource: string | null = null;

      if (overridePin) {
        const pinResult = await verifyManagerPinForProperty(
          admin,
          property_id,
          overridePin,
        );
        if (!pinResult.ok) {
          throw new Error(pinResult.error);
        }
        overrideSource = "manager_pin";
        pinSource =
          pinResult.source === "staff"
            ? `staff:${pinResult.staffId}:${pinResult.fullName}`
            : pinResult.source;
      } else if (sessionIsGmOwner && sessionOverride) {
        overrideSource = "session_gm";
      } else if (sessionIsGmOwner) {
        throw new Error(
          `${businessGate.message} Tick “Allow past check-in / business date override” (GM/owner), enter a manager PIN, or adjust stay dates on Details.`,
        );
      } else {
        throw new Error(
          `${businessGate.message} Enter a manager PIN below, ask a GM/owner to override, or adjust stay dates on Details.`,
        );
      }

      await writeAuditEvent(admin, {
        propertyId: property_id,
        action: "booking.check_in_business_date_override",
        entityType: "bookings",
        entityId: bookingId,
        summary:
          overrideSource === "session_gm"
            ? `GM/owner session override · check-in ${booking.check_in} (gate: ${businessGate.priorDate})`
            : `Manager PIN override · check-in ${booking.check_in} (gate: ${businessGate.priorDate})`,
        meta: {
          priorBusinessDate: businessGate.priorDate,
          checkIn: booking.check_in,
          gateMessage: businessGate.message,
          overrideSource,
          pinSource,
          deskRole: sessionRole,
        },
      });
    }

    const status = booking.status as string;
    if (!["pending", "confirmed"].includes(status)) {
      throw new Error(`Cannot check in a booking with status ${status}.`);
    }

    // Agent open-room capacity (primary credit control vs Nu-only limits).
    const agentIdCi = (booking.agent_id as string | null) ?? null;
    if (agentIdCi) {
      const { data: agentRow } = await admin
        .from("agents")
        .select("id, company_name, open_room_cap")
        .eq("id", agentIdCi)
        .maybeSingle();
      if (agentRow) {
        const {
          countAgentOpenRooms,
          agentRoomCapBlockedMessage,
        } = await import("@/lib/agents/open-rooms");
        const cap = Math.max(0, Number(agentRow.open_room_cap ?? 15));
        const openRooms = await countAgentOpenRooms(admin, {
          propertyId: property_id,
          agentId: agentIdCi,
          excludeBookingId: bookingId,
        });
        const incoming = Math.max(1, Number((booking as { rooms?: number }).rooms ?? 1));
        // Prefer assigned units count when FO picked rooms
        const unitCount = roomUnitIds.length;
        const incomingRooms = unitCount > 0 ? unitCount : incoming;
        const overrideCap =
          formData.get("override_agent_room_cap") === "on" ||
          formData.get("override_agent_room_cap") === "true";
        const overrideNote = optionalTrim(formData.get("agent_room_cap_note"));
        if (openRooms + incomingRooms > cap && !overrideCap) {
          throw new Error(
            agentRoomCapBlockedMessage({
              companyName: agentRow.company_name as string | null,
              openRooms,
              incomingRooms,
              cap,
            }),
          );
        }
        if (openRooms + incomingRooms > cap && overrideCap) {
          if (!overrideNote || overrideNote.length < 4) {
            throw new Error(
              "Room-cap override requires a short note (why stack this agent).",
            );
          }
          await writeAuditEvent(admin, {
            propertyId: property_id,
            action: "booking.check_in_room_cap_override",
            entityType: "bookings",
            entityId: bookingId,
            summary: `Agent room-cap override · ${openRooms}+${incomingRooms} > ${cap}`,
            meta: {
              openRooms,
              incomingRooms,
              cap,
              note: overrideNote,
              agentId: agentIdCi,
            },
          });
        }
      }
    }

    if (!requireClean) {
      await writeAuditEvent(admin, {
        propertyId: property_id,
        action: "booking.check_in_dirty_room_override",
        entityType: "bookings",
        entityId: bookingId,
        summary: "Check-in with dirty/inspect room override",
      });
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
        const nights = nightsBetween(
          booking.check_in as string,
          booking.check_out as string,
        );
        const quoted =
          booking.quoted_total_btn != null
            ? Number(booking.quoted_total_btn)
            : null;
        let amount = 0;
        if (quoted != null && Number.isFinite(quoted) && quoted > 0) {
          amount = roundBtn(quoted);
        } else {
          const { data: agent } = await admin
            .from("agents")
            .select("rate_tier")
            .eq("id", agentId)
            .single();
          const tier = agentRateTier(agent?.rate_tier as string | undefined);
          const season = await resolveSeasonKind(
            admin,
            property_id,
            booking.check_in as string,
          );
          const taxSettings = await loadRoomRateTaxSettings(admin, property_id);
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
            const nightAllIn = calculateRoomNightTax(rate, taxSettings).totalBtn;
            estimate += nightAllIn * Number(line.qty) * nights;
          }
          amount = roundBtn(estimate);
        }
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
        id_photo_url: g.idPhotoUrl.trim() || null,
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

    const extraBedAmount = Number(booking.extra_bed_amount_btn ?? 0);
    if (extraBedAmount > 0) {
      try {
        const bedResult = await postExtraBedFolioLine(admin, property_id, {
          folioId,
          bookingId,
          extraBeds: Number(booking.extra_beds ?? 1),
          extraBedAmountBtn: extraBedAmount,
          businessDate: booking.check_in as string,
        });
        if (bedResult.posted) chargeNotes.push("extra bed");
      } catch (bedErr) {
        console.error("extra bed post failed", bedErr);
        chargeNotes.push(
          `extra bed failed: ${bedErr instanceof Error ? bedErr.message : "error"}`,
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
      summary: `Checked in ${primaryGuest.fullName.trim()} · ref ${bookingId.slice(0, 8).toUpperCase()} · ${roomUnitIds.length} room(s)`,
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

/** Day-1 check-in auto posts only these source types (safe to reverse). */
export type UndoCheckInState = {
  ok: boolean;
  bookingId?: string;
  error?: string;
  message?: string;
};

/**
 * Reverse accidental check-in when the folio is still simple.
 * Blocks if payments exist or non day-1 auto charges (SPA, laundry, etc.) are posted.
 */
export async function undoCheckIn(
  bookingId: string,
): Promise<UndoCheckInState> {
  try {
    await requireDesk();
    if (!bookingId?.trim()) throw new Error("Booking is required.");

    const admin = createSupabaseAdminClient();
    const property_id = await propertyId(admin);

    const { data: booking, error: bookingError } = await admin
      .from("bookings")
      .select("id, status, contact_name, property_id, check_in, checked_out_at")
      .eq("id", bookingId)
      .maybeSingle();

    if (bookingError || !booking) throw new Error("Booking not found.");
    assertDeskProperty(property_id, booking.property_id as string, "Booking");

    if ((booking.status as string) !== "checked_in") {
      throw new Error("Only checked-in bookings can undo check-in.");
    }
    if (booking.checked_out_at) {
      throw new Error("Checkout already recorded — undo check-in is blocked.");
    }

    const { data: openFolios } = await admin
      .from("folios")
      .select("id, status")
      .eq("booking_id", bookingId)
      .eq("property_id", property_id)
      .eq("status", "open");

    const folioIds = (openFolios ?? []).map((f) => f.id as string);

    if (folioIds.length > 0) {
      const { data: payments } = await admin
        .from("payments")
        .select("id")
        .or(
          `booking_id.eq.${bookingId},folio_id.in.(${folioIds.join(",")})`,
        )
        .limit(1);

      const { data: lines } = await admin
        .from("folio_lines")
        .select("id, source_type, status, business_date")
        .in("folio_id", folioIds)
        .eq("status", "posted");

      const posted = lines ?? [];
      const guard = assertUndoCheckInLinesSafe(posted, {
        hasPayments: Boolean(payments?.length),
      });
      if (guard) throw new Error(guard);

      for (const line of posted) {
        if (!UNDO_CI_SAFE_SOURCE_TYPES.has(String(line.source_type ?? ""))) {
          continue;
        }
        await voidFolioLineWithReversal(admin, property_id, {
          lineId: line.id as string,
          reason: "Undo check-in",
          voidedBy: "desk",
        });
      }
    }

    const { error: statusError } = await admin
      .from("bookings")
      .update({
        status: "confirmed",
        checked_in_at: null,
      })
      .eq("id", bookingId)
      .eq("property_id", property_id)
      .eq("status", "checked_in");

    if (statusError) {
      throw new Error("Could not reverse check-in status.");
    }

    await writeAuditEvent(admin, {
      propertyId: property_id,
      action: "checkin.undo",
      entityType: "bookings",
      entityId: bookingId,
      summary: `Undo check-in · ${booking.contact_name ?? "Guest"}`,
      meta: {
        check_in: booking.check_in,
        voided_safe_lines: true,
      },
    });

    revalidateCheckIn();
    return {
      ok: true,
      bookingId,
      message: "Check-in reversed — booking is confirmed again.",
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Could not undo check-in.",
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
    const lateFeeRaw = optionalTrim(formData.get("late_checkout_fee_btn"));
    const earlyFee = earlyFeeRaw ? Number(earlyFeeRaw) : 0;
    const lateFee = lateFeeRaw ? Number(lateFeeRaw) : 0;
    if (earlyFeeRaw && (!Number.isFinite(earlyFee) || earlyFee < 0)) {
      throw new Error("Early checkout fee must be a non-negative amount.");
    }
    if (lateFeeRaw && (!Number.isFinite(lateFee) || lateFee < 0)) {
      throw new Error("Late checkout fee must be a non-negative amount.");
    }
    // Early and late are mutually exclusive — prevent double-post of both policy amounts.
    if (earlyFee > 0.009 && lateFee > 0.009) {
      throw new Error(
        "Post either early or late checkout fee, not both. Clear one field and try again.",
      );
    }

    const admin = createSupabaseAdminClient();
    const property_id = await propertyId(admin);

    const { data: booking, error: bookingError } = await admin
      .from("bookings")
      .select("id, status, contact_name, property_id, agent_id, payment_mode, guide_sign_status")
      .eq("id", bookingId)
      .single();

    if (bookingError || !booking) {
      throw new Error("Booking not found.");
    }
    assertDeskProperty(property_id, booking.property_id as string, "Booking");
    if ((booking.status as string) !== "checked_in") {
      throw new Error("Only checked-in bookings can be checked out.");
    }

    // Agent stays: guide-signed paper (or waive) before guests leave.
    // Email/seal is FO work after leave — not a gate here.
    if (booking.agent_id) {
      const signStatus = String(
        (booking as { guide_sign_status?: string | null }).guide_sign_status ??
          "",
      ).toLowerCase();
      if (signStatus !== "photo" && signStatus !== "waived") {
        throw new Error(
          "Agent stay: attach guide-signed settlement paper (phone camera, scanner, or file) or waive with reason before check-out.",
        );
      }
    }

    const { data: folio } = await admin
      .from("folios")
      .select("id, folio_lines(total_btn, status, bill_to, source_type)")
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

    if (lateFee > 0.009) {
      if (!folio) {
        throw new Error("Open a folio before posting a late checkout fee.");
      }
      const { postFolioCharge } = await import("@/lib/folio/post-charge");
      const { DEFAULT_GST_RATE } = await import("@/lib/property-settings");
      const { data: prop } = await admin
        .from("properties")
        .select("gst_rate")
        .eq("id", property_id)
        .maybeSingle();
      const gstRate = Number(prop?.gst_rate ?? DEFAULT_GST_RATE);
      const amountBtn = roundBtn(lateFee);
      const gstBtn = gstRate > 0 ? roundBtn(amountBtn * gstRate) : 0;
      await postFolioCharge(admin, property_id, {
        folio_id: folio.id as string,
        booking_id: bookingId,
        source_type: "service",
        description: "Late checkout fee",
        qty: 1,
        unit_price_btn: amountBtn,
        amount_btn: amountBtn,
        gst_applicable: gstBtn > 0,
        gst_btn: gstBtn,
        total_btn: roundBtn(amountBtn + gstBtn),
      });
    }

    let balance = 0;
    let guestVisibleBalance = 0;
    if (folio) {
      const { data: refreshed } = await admin
        .from("folios")
        .select("id, folio_lines(total_btn, status, bill_to, source_type)")
        .eq("id", folio.id)
        .maybeSingle();
      const lines =
        ((refreshed ?? folio).folio_lines as
          | {
              total_btn: number;
              status: string;
              bill_to?: string | null;
              source_type?: string | null;
            }[]
          | null) ?? [];
      const posted = lines.filter((l) => l.status === "posted");
      balance = posted.reduce((sum, l) => sum + Number(l.total_btn), 0);
      // Guest-visible: non-agent bill_to charges + all payments (guest settle)
      guestVisibleBalance = posted.reduce((sum, l) => {
        const st = (l.source_type ?? "").toLowerCase();
        if (st === "payment" || st === "deposit") {
          return sum + Number(l.total_btn);
        }
        if ((l.bill_to ?? "guest") === "agent") return sum;
        return sum + Number(l.total_btn);
      }, 0);

      const paymentMode = String(booking.payment_mode ?? "").toLowerCase();
      const agentResidualOk =
        Boolean(booking.agent_id) &&
        (paymentMode === "on_credit" || paymentMode === "partial") &&
        Math.abs(guestVisibleBalance) <= 0.5 &&
        Math.abs(balance) > 0.009;

      if (Math.abs(balance) > 0.009 && !allowBalance && !agentResidualOk) {
        throw new Error(
          `Folio balance is Nu ${balance.toFixed(2)}. Settle guest payment, use agent credit, or tick allow balance to checkout.`,
        );
      }

      await admin
        .from("folios")
        .update({
          status:
            Math.abs(balance) <= 0.009
              ? "settled"
              : agentResidualOk
                ? "closed"
                : "closed",
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
        lateCheckoutFee: lateFee > 0 ? lateFee : undefined,
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
