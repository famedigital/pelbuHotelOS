"use server";

import { chargeAgentCredit } from "@/app/actions/erp-agents";
import { writeAuditEvent } from "@/lib/audit";
import { enqueueAfterBookingChange } from "@/lib/channel/ari-queue";
import { isDeskAuthenticated } from "@/lib/desk-auth";
import { notifyNewBooking } from "@/lib/notify";
import {
  applyDiscountPct,
  resolvePartnerDiscountByIds,
} from "@/lib/partners/discount";
import {
  MAX_CHILDREN,
  MAX_EXTRA_BEDS,
  resolveStayAddonsForBook,
} from "@/lib/meal-plans";
import { roundBtn } from "@/lib/pricing";
import { resolveActivePropertyId } from "@/lib/property-context";
import {
  agentRateTier,
  lookupRoomRateBtn,
  nightsBetween,
  resolveSeasonKind,
  type RateTier,
} from "@/lib/rates";
import { assignRoomsForBooking } from "@/lib/room-assignments";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  assertOptionalEmail,
  assertPhone,
  assertStayDates,
  optionalTrim,
  parseNonNegInt,
  parsePositiveInt,
  trimRequired,
} from "@/lib/validation";
import { revalidatePath } from "next/cache";

export type CalendarBookState = {
  ok: boolean;
  bookingId?: string;
  groupId?: string;
  moveId?: string;
  error?: string;
  message?: string;
};

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const SOURCES = new Set(["owner", "reservation", "agent", "mou_agent"]);
const PAYMENT_MODES = new Set(["prepaid", "partial", "on_credit", "cash"]);
const GUEST_ORIGINS = new Set([
  "international",
  "regional",
  "official",
  "local",
]);

async function requireDesk() {
  if (!(await isDeskAuthenticated())) {
    throw new Error("Desk session expired. Sign in again.");
  }
}

function revalidateCalendar() {
  revalidatePath("/erp");
  revalidatePath("/erp/calendar");
  revalidatePath("/erp/group");
  revalidatePath("/erp/arrivals");
  revalidatePath("/erp/reservations");
  revalidatePath("/erp/fast-book");
  revalidatePath("/erp/channel");
}

function rateTierFromSource(source: string): RateTier {
  if (source === "mou_agent") return "mou_agents";
  if (source === "agent") return "agents";
  return "public";
}

async function estimateAndChargeCredit(
  admin: ReturnType<typeof createSupabaseAdminClient>,
  args: {
    propertyId: string;
    bookingId: string;
    agentId: string | null;
    paymentMode: string;
    source: string;
    checkIn: string;
    checkOut: string;
    roomTypeIds: string[];
    guideId?: string | null;
    driverId?: string | null;
  },
): Promise<number> {
  if (args.paymentMode !== "on_credit" || !args.agentId) return 0;
  const { data: agent } = await admin
    .from("agents")
    .select("id, status, rate_tier")
    .eq("id", args.agentId)
    .maybeSingle();
  if (!agent || !["approved", "demo"].includes(agent.status as string)) {
    throw new Error("Agent must be approved (or demo) to book on credit.");
  }
  const tier = agentRateTier(agent.rate_tier as string) ?? rateTierFromSource(args.source);
  const season = await resolveSeasonKind(admin, args.propertyId, args.checkIn);
  const nights = nightsBetween(args.checkIn, args.checkOut);
  let estimate = 0;
  for (const roomTypeId of args.roomTypeIds) {
    const rate = await lookupRoomRateBtn(admin, {
      propertyId: args.propertyId,
      roomTypeId,
      seasonKind: season,
      rateTier: tier,
    });
    if (rate == null) {
      throw new Error(
        "No room rate for this season/tier. Set rates before on-credit booking.",
      );
    }
    estimate += rate * nights;
  }
  const partnerPct = await resolvePartnerDiscountByIds(admin, {
    guideId: args.guideId,
    driverId: args.driverId,
  });
  const creditChargeBtn = roundBtn(applyDiscountPct(estimate, partnerPct));
  if (creditChargeBtn <= 0) {
    throw new Error("Could not estimate on-credit amount from rates.");
  }
  await chargeAgentCredit(admin, {
    agentId: args.agentId,
    amountBtn: creditChargeBtn,
    bookingId: args.bookingId,
    note:
      partnerPct > 0
        ? `Calendar reservation on credit (−${partnerPct}% partner)`
        : "Calendar reservation on credit",
  });
  return creditChargeBtn;
}

function parseUnitIds(raw: string): string[] {
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

async function loadFreeUnits(
  admin: ReturnType<typeof createSupabaseAdminClient>,
  propertyId: string,
  unitIds: string[],
  checkIn: string,
  checkOut: string,
) {
  const { data: units, error } = await admin
    .from("room_units")
    .select(
      "id, label, room_type_id, room_types!inner(id, code, name, inventory_kind)",
    )
    .eq("property_id", propertyId)
    .in("id", unitIds);
  if (error) throw new Error(error.message);
  if (!units?.length || units.length !== unitIds.length) {
    throw new Error("One or more selected rooms are missing.");
  }

  const { data: busy } = await admin
    .from("room_assignments")
    .select("room_unit_id, from_date, to_date")
    .eq("property_id", propertyId)
    .in("room_unit_id", unitIds)
    .lt("from_date", checkOut)
    .gt("to_date", checkIn);

  if (busy?.length) {
    const labels = units
      .filter((u) => busy.some((b) => b.room_unit_id === u.id))
      .map((u) => u.label as string);
    throw new Error(
      `Room(s) no longer free for these dates: ${labels.join(", ") || "selected"}.`,
    );
  }

  return units.map((u) => {
    const rt = u.room_types as
      | { id: string; code: string; name: string; inventory_kind: string }
      | { id: string; code: string; name: string; inventory_kind: string }[]
      | null;
    const type = Array.isArray(rt) ? rt[0] : rt;
    if (!type || type.inventory_kind !== "sellable_guest") {
      throw new Error(`${u.label as string} is not a sellable guest room.`);
    }
    return {
      id: u.id as string,
      label: u.label as string,
      room_type_id: u.room_type_id as string,
      room_type_code: type.code,
      room_type_name: type.name,
    };
  });
}

type CommonFields = {
  checkIn: string;
  checkOut: string;
  contactName: string;
  contactPhone: string;
  contactEmail: string | null;
  adults: number;
  children: number;
  extraBeds: number;
  guideNumber: string | null;
  notes: string | null;
  agentId: string | null;
  source: string;
  guestOrigin: string;
  paymentMode: string;
};

function parseCommon(formData: FormData): CommonFields {
  const source = trimRequired(formData.get("source"), "Booked by");
  if (!SOURCES.has(source)) throw new Error("Invalid booked-by role.");

  const contactName = trimRequired(formData.get("contact_name"), "Guest name");
  const contactPhone = trimRequired(formData.get("contact_phone"), "Phone");
  assertPhone(contactPhone);
  const contactEmail = optionalTrim(formData.get("contact_email"));
  assertOptionalEmail(contactEmail);

  const checkIn = trimRequired(formData.get("check_in"), "Check-in");
  const checkOut = trimRequired(formData.get("check_out"), "Check-out");
  assertStayDates(checkIn, checkOut);

  const adults = parsePositiveInt(formData.get("adults"), "Adults", 24);
  const children = parseNonNegInt(
    formData.get("children"),
    "Children",
    MAX_CHILDREN,
  );
  const extraBeds = parseNonNegInt(
    formData.get("extra_beds"),
    "Extra beds",
    MAX_EXTRA_BEDS,
  );
  const guideNumber = optionalTrim(formData.get("guide_number"));
  const notes = optionalTrim(formData.get("notes"));
  const agentId = optionalTrim(formData.get("agent_id"));

  const guestOriginRaw = optionalTrim(formData.get("guest_origin"));
  const guestOrigin =
    guestOriginRaw && GUEST_ORIGINS.has(guestOriginRaw)
      ? guestOriginRaw
      : "international";

  const paymentModeRaw = optionalTrim(formData.get("payment_mode"));
  const paymentMode =
    paymentModeRaw && PAYMENT_MODES.has(paymentModeRaw)
      ? paymentModeRaw
      : "cash";

  if ((source === "agent" || source === "mou_agent") && !agentId) {
    throw new Error("Select an approved agent for agent bookings.");
  }
  if (guestOrigin === "international" && !guideNumber) {
    throw new Error(
      "Guide number is required for international tourists.",
    );
  }
  if (paymentMode === "on_credit" && !agentId) {
    throw new Error("Select an agent to book on credit.");
  }

  return {
    checkIn,
    checkOut,
    contactName,
    contactPhone,
    contactEmail,
    adults,
    children,
    extraBeds,
    guideNumber,
    notes,
    agentId,
    source,
    guestOrigin,
    paymentMode,
  };
}

async function resolveAddonsFromForm(
  admin: ReturnType<typeof createSupabaseAdminClient>,
  propertyId: string,
  formData: FormData,
  adults: number,
  children: number,
  extraBeds: number,
  checkIn: string,
  checkOut: string,
) {
  const mealPlanCodeRaw = trimRequired(formData.get("meal_plan_code"), "Meal plan");
  const nights = nightsBetween(checkIn, checkOut);
  const addons = await resolveStayAddonsForBook(admin, propertyId, {
    mealPlanCode: mealPlanCodeRaw,
    adults,
    children,
    extraBeds,
    nights,
  });
  return {
    mealPlanCode: addons.mealPlanCode,
    mealPlanAmountBtn: addons.mealPlanAmountBtn,
    extraBeds: addons.extraBeds,
    extraBedAmountBtn: addons.extraBedAmountBtn,
  };
}

/** Single selected room → one confirmed booking assigned to that unit. */
export async function createCalendarReservation(
  _prev: CalendarBookState,
  formData: FormData,
): Promise<CalendarBookState> {
  try {
    await requireDesk();
    const common = parseCommon(formData);
    const unitIds = parseUnitIds(
      trimRequired(formData.get("room_unit_ids"), "Room"),
    );
    if (unitIds.length !== 1) {
      throw new Error("Select exactly one room for a single reservation.");
    }

    const admin = createSupabaseAdminClient();
    const propertyId = await resolveActivePropertyId(admin);
    const meal = await resolveAddonsFromForm(
      admin,
      propertyId,
      formData,
      common.adults,
      common.children,
      common.extraBeds,
      common.checkIn,
      common.checkOut,
    );
    const [unit] = await loadFreeUnits(
      admin,
      propertyId,
      unitIds,
      common.checkIn,
      common.checkOut,
    );

    const { data: booking, error: bookingError } = await admin
      .from("bookings")
      .insert({
        property_id: propertyId,
        agent_id: common.agentId,
        source: common.source === "mou_agent" ? "agent" : common.source,
        booked_by_role: common.source,
        status: "confirmed",
        confirmed_at: new Date().toISOString(),
        confirmed_by: "desk_calendar",
        check_in: common.checkIn,
        check_out: common.checkOut,
        contact_name: common.contactName,
        contact_phone: common.contactPhone,
        contact_email: common.contactEmail,
        adults: common.adults,
        children: common.children,
        extra_beds: meal.extraBeds,
        rooms: 1,
        guide_number: common.guideNumber,
        guest_origin: common.guestOrigin,
        payment_mode: common.paymentMode,
        notes: common.notes,
        meal_plan_code: meal.mealPlanCode,
        meal_plan_amount_btn: meal.mealPlanAmountBtn,
        extra_bed_amount_btn: meal.extraBedAmountBtn,
      })
      .select("id")
      .single();

    if (bookingError || !booking) {
      console.error("calendar reservation insert failed", bookingError);
      throw new Error("Could not save reservation.");
    }

    const { error: lineError } = await admin.from("booking_rooms").insert({
      booking_id: booking.id,
      room_type_id: unit.room_type_id,
      qty: 1,
      inventory_kind: "sellable_guest",
    });
    if (lineError) {
      await admin.from("bookings").delete().eq("id", booking.id);
      throw new Error("Could not save room line.");
    }

    try {
      await assignRoomsForBooking(admin, {
        propertyId,
        bookingId: booking.id as string,
        checkIn: common.checkIn,
        checkOut: common.checkOut,
        lines: [
          {
            room_type_id: unit.room_type_id,
            qty: 1,
            inventory_kind: "sellable_guest",
          },
        ],
        preferredUnitIds: [unit.id],
      });
    } catch (e) {
      await admin.from("booking_rooms").delete().eq("booking_id", booking.id);
      await admin.from("bookings").delete().eq("id", booking.id);
      throw e;
    }

    await admin.from("booking_guests").insert({
      booking_id: booking.id,
      full_name: common.contactName,
    });

    let creditNote = "";
    try {
      const charged = await estimateAndChargeCredit(admin, {
        propertyId,
        bookingId: booking.id as string,
        agentId: common.agentId,
        paymentMode: common.paymentMode,
        source: common.source,
        checkIn: common.checkIn,
        checkOut: common.checkOut,
        roomTypeIds: [unit.room_type_id],
      });
      if (charged > 0) creditNote = ` · credit Nu ${charged}`;
    } catch (creditError) {
      await admin.from("room_assignments").delete().eq("booking_id", booking.id);
      await admin.from("booking_guests").delete().eq("booking_id", booking.id);
      await admin.from("booking_rooms").delete().eq("booking_id", booking.id);
      await admin.from("bookings").delete().eq("id", booking.id);
      throw creditError;
    }

    await writeAuditEvent(admin, {
      propertyId,
      action: "calendar.reservation.create",
      entityType: "bookings",
      entityId: booking.id as string,
      summary: `${common.contactName} · ${unit.label} · ${common.checkIn}→${common.checkOut}${creditNote}`,
    });

    await notifyNewBooking({
      bookingId: booking.id as string,
      contactName: common.contactName,
      contactPhone: common.contactPhone,
      contactEmail: common.contactEmail,
      checkIn: common.checkIn,
      checkOut: common.checkOut,
      adults: common.adults,
      rooms: 1,
      guideNumber: common.guideNumber,
      notes: common.notes
        ? `[CALENDAR ${common.source}] ${common.notes}`
        : `[CALENDAR ${common.source}]`,
    });

    await enqueueAfterBookingChange(
      admin,
      propertyId,
      common.checkIn,
      common.checkOut,
      "calendar.create",
    );

    revalidateCalendar();
    return {
      ok: true,
      bookingId: booking.id as string,
      message: `Booked ${unit.label}.`,
    };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Could not create reservation.",
    };
  }
}

/**
 * Multi-room rectangle → one booking_groups master + one child booking per room,
 * each assigned to its selected physical unit. Rolls back on any failure.
 */
export async function createCalendarGroupReservation(
  _prev: CalendarBookState,
  formData: FormData,
): Promise<CalendarBookState> {
  const createdBookingIds: string[] = [];
  let groupId: string | null = null;
  const admin = createSupabaseAdminClient();

  try {
    await requireDesk();
    const common = parseCommon(formData);
    const groupName = trimRequired(formData.get("group_name"), "Group name");
    const unitIds = parseUnitIds(
      trimRequired(formData.get("room_unit_ids"), "Rooms"),
    );
    if (unitIds.length < 2) {
      throw new Error("Select at least two rooms for a group booking.");
    }

    const propertyId = await resolveActivePropertyId(admin);
    const meal = await resolveAddonsFromForm(
      admin,
      propertyId,
      formData,
      common.adults,
      common.children,
      common.extraBeds,
      common.checkIn,
      common.checkOut,
    );
    const units = await loadFreeUnits(
      admin,
      propertyId,
      unitIds,
      common.checkIn,
      common.checkOut,
    );

    const { data: group, error: groupError } = await admin
      .from("booking_groups")
      .insert({
        property_id: propertyId,
        name: groupName,
        agent_id: common.agentId,
        check_in: common.checkIn,
        check_out: common.checkOut,
        notes: common.notes,
        status: "confirmed",
      })
      .select("id")
      .single();
    if (groupError || !group) {
      throw new Error(groupError?.message ?? "Could not create group.");
    }
    groupId = group.id as string;

    for (let unitIndex = 0; unitIndex < units.length; unitIndex++) {
      const unit = units[unitIndex]!;
      const unitAdults = Math.max(1, Math.floor(common.adults / units.length));
      const unitChildren =
        unitIndex === 0
          ? common.children -
            Math.floor(common.children / units.length) * (units.length - 1)
          : Math.floor(common.children / units.length);
      const unitExtraBeds = unitIndex === 0 ? meal.extraBeds : 0;
      const unitMealAmount =
        unitIndex === 0 ? meal.mealPlanAmountBtn : 0;
      const unitExtraBedAmount =
        unitIndex === 0 ? meal.extraBedAmountBtn : 0;

      const { data: booking, error: bookingError } = await admin
        .from("bookings")
        .insert({
          property_id: propertyId,
          agent_id: common.agentId,
          source: common.source === "mou_agent" ? "agent" : common.source,
          booked_by_role: common.source,
          status: "confirmed",
          confirmed_at: new Date().toISOString(),
          confirmed_by: "desk_calendar_group",
          check_in: common.checkIn,
          check_out: common.checkOut,
          contact_name: common.contactName,
          contact_phone: common.contactPhone,
          contact_email: common.contactEmail,
          adults: unitAdults,
          children: unitChildren,
          extra_beds: unitExtraBeds,
          rooms: 1,
          guide_number: common.guideNumber,
          guest_origin: common.guestOrigin,
          payment_mode: common.paymentMode,
          notes: `${groupName} · ${unit.label}${common.notes ? ` · ${common.notes}` : ""}`,
          meal_plan_code: meal.mealPlanCode,
          meal_plan_amount_btn: unitMealAmount,
          extra_bed_amount_btn: unitExtraBedAmount,
        })
        .select("id")
        .single();

      if (bookingError || !booking) {
        throw new Error(`Could not create booking for ${unit.label}.`);
      }
      createdBookingIds.push(booking.id as string);

      const { error: lineError } = await admin.from("booking_rooms").insert({
        booking_id: booking.id,
        room_type_id: unit.room_type_id,
        qty: 1,
        inventory_kind: "sellable_guest",
      });
      if (lineError) throw new Error(`Room line failed for ${unit.label}.`);

      await assignRoomsForBooking(admin, {
        propertyId,
        bookingId: booking.id as string,
        checkIn: common.checkIn,
        checkOut: common.checkOut,
        lines: [
          {
            room_type_id: unit.room_type_id,
            qty: 1,
            inventory_kind: "sellable_guest",
          },
        ],
        preferredUnitIds: [unit.id],
      });

      await admin.from("booking_guests").insert({
        booking_id: booking.id,
        full_name: common.contactName,
      });

      await admin.from("booking_group_members").insert({
        group_id: groupId,
        booking_id: booking.id,
      });
    }

    const charged = await estimateAndChargeCredit(admin, {
      propertyId,
      bookingId: createdBookingIds[0]!,
      agentId: common.agentId,
      paymentMode: common.paymentMode,
      source: common.source,
      checkIn: common.checkIn,
      checkOut: common.checkOut,
      roomTypeIds: units.map((unit) => unit.room_type_id),
    });

    await writeAuditEvent(admin, {
      propertyId,
      action: "calendar.group.create",
      entityType: "booking_groups",
      entityId: groupId,
      summary: `${groupName} · ${units.length} rooms · ${common.checkIn}→${common.checkOut}${charged > 0 ? ` · credit Nu ${charged}` : ""}`,
      meta: { booking_ids: createdBookingIds, unit_ids: unitIds },
    });

    await notifyNewBooking({
      bookingId: createdBookingIds[0]!,
      contactName: common.contactName,
      contactPhone: common.contactPhone,
      contactEmail: common.contactEmail,
      checkIn: common.checkIn,
      checkOut: common.checkOut,
      adults: common.adults,
      rooms: units.length,
      guideNumber: common.guideNumber,
      notes: `[CALENDAR GROUP ${groupName}] ${units.length} rooms`,
    });

    await enqueueAfterBookingChange(
      admin,
      propertyId,
      common.checkIn,
      common.checkOut,
      "calendar.group.create",
    );

    revalidateCalendar();
    return {
      ok: true,
      groupId,
      bookingId: createdBookingIds[0],
      message: `Group “${groupName}” — ${units.length} rooms booked.`,
    };
  } catch (e) {
    // Best-effort rollback
    for (const id of createdBookingIds.reverse()) {
      await admin.from("room_assignments").delete().eq("booking_id", id);
      await admin.from("booking_group_members").delete().eq("booking_id", id);
      await admin.from("booking_guests").delete().eq("booking_id", id);
      await admin.from("booking_rooms").delete().eq("booking_id", id);
      await admin.from("bookings").delete().eq("id", id);
    }
    if (groupId) {
      await admin.from("booking_groups").delete().eq("id", groupId);
    }
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Could not create group booking.",
    };
  }
}

/** Assign one missing room slot without disturbing a booking's other rooms. */
export async function assignCalendarBookingRoom(
  bookingId: string,
  roomUnitId: string,
): Promise<CalendarBookState> {
  try {
    await requireDesk();
    if (!UUID_RE.test(bookingId) || !UUID_RE.test(roomUnitId)) {
      throw new Error("Invalid booking or room.");
    }

    const admin = createSupabaseAdminClient();
    const propertyId = await resolveActivePropertyId(admin);
    const { data: booking } = await admin
      .from("bookings")
      .select("contact_name, check_in, check_out")
      .eq("id", bookingId)
      .eq("property_id", propertyId)
      .maybeSingle();
    const { data: unit } = await admin
      .from("room_units")
      .select("label")
      .eq("id", roomUnitId)
      .eq("property_id", propertyId)
      .maybeSingle();

    const { error } = await admin.rpc("assign_unassigned_booking_room", {
      p_property_id: propertyId,
      p_booking_id: bookingId,
      p_room_unit_id: roomUnitId,
    });
    if (error) {
      console.error("calendar room assignment failed", error);
      throw new Error(
        error.message.includes("full stay")
          ? "That room is no longer free for the full stay."
          : error.message,
      );
    }

    await writeAuditEvent(admin, {
      propertyId,
      action: "calendar.room.assign",
      entityType: "bookings",
      entityId: bookingId,
      summary: `${booking?.contact_name ?? "Guest"} · ${unit?.label ?? "room"} · assigned from pool`,
      meta: { room_unit_id: roomUnitId },
    });

    revalidateCalendar();
    return {
      ok: true,
      bookingId,
      message: `${unit?.label ?? "Room"} assigned.`,
    };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Could not assign room.",
    };
  }
}

export async function setCalendarAssignmentLock(
  assignmentId: string,
  locked: boolean,
  reason?: string,
): Promise<CalendarBookState> {
  try {
    await requireDesk();
    if (!UUID_RE.test(assignmentId)) throw new Error("Invalid assignment.");
    const admin = createSupabaseAdminClient();
    const propertyId = await resolveActivePropertyId(admin);
    const { data: assignment } = await admin
      .from("room_assignments")
      .select("booking_id, room_units(label)")
      .eq("id", assignmentId)
      .eq("property_id", propertyId)
      .maybeSingle();
    const { error } = await admin.rpc("set_room_assignment_lock", {
      p_property_id: propertyId,
      p_assignment_id: assignmentId,
      p_locked: locked,
      p_reason: reason ?? null,
    });
    if (error) throw new Error(error.message);

    const rawUnit = assignment?.room_units as
      | { label?: string }
      | { label?: string }[]
      | null;
    const unit = Array.isArray(rawUnit) ? rawUnit[0] : rawUnit;
    await writeAuditEvent(admin, {
      propertyId,
      action: locked
        ? "calendar.assignment.lock"
        : "calendar.assignment.unlock",
      entityType: "room_assignments",
      entityId: assignmentId,
      summary: `${unit?.label ?? "Room"} ${locked ? "locked" : "unlocked"}`,
      meta: { booking_id: assignment?.booking_id, reason: reason ?? null },
    });
    revalidateCalendar();
    return {
      ok: true,
      message: locked ? "Room assignment locked." : "Room assignment unlocked.",
    };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Could not update room lock.",
    };
  }
}

export async function moveCalendarAssignment(
  assignmentId: string,
  toUnitId: string,
): Promise<CalendarBookState> {
  try {
    await requireDesk();
    if (!UUID_RE.test(assignmentId) || !UUID_RE.test(toUnitId)) {
      throw new Error("Invalid assignment or destination room.");
    }
    const admin = createSupabaseAdminClient();
    const propertyId = await resolveActivePropertyId(admin);
    const [{ data: assignment }, { data: destination }] = await Promise.all([
      admin
        .from("room_assignments")
        .select("booking_id, from_date, to_date, room_units(label)")
        .eq("id", assignmentId)
        .eq("property_id", propertyId)
        .maybeSingle(),
      admin
        .from("room_units")
        .select("label")
        .eq("id", toUnitId)
        .eq("property_id", propertyId)
        .maybeSingle(),
    ]);
    const { data: moveId, error } = await admin.rpc(
      "move_room_assignment_same_type",
      {
        p_property_id: propertyId,
        p_assignment_id: assignmentId,
        p_to_unit_id: toUnitId,
      },
    );
    if (error) throw new Error(error.message);

    const rawUnit = assignment?.room_units as
      | { label?: string }
      | { label?: string }[]
      | null;
    const fromUnit = Array.isArray(rawUnit) ? rawUnit[0] : rawUnit;
    await writeAuditEvent(admin, {
      propertyId,
      action: "calendar.assignment.move",
      entityType: "room_assignments",
      entityId: assignmentId,
      summary: `${fromUnit?.label ?? "Room"} → ${destination?.label ?? "room"}`,
      meta: {
        booking_id: assignment?.booking_id,
        move_id: moveId,
        to_unit_id: toUnitId,
      },
    });
    revalidateCalendar();
    return {
      ok: true,
      bookingId: assignment?.booking_id as string | undefined,
      moveId: moveId as string,
      message: `Moved to ${destination?.label ?? "selected room"}. Undo available for 60 seconds.`,
    };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Could not move room.",
    };
  }
}

export async function undoCalendarAssignmentMove(
  moveId: string,
): Promise<CalendarBookState> {
  try {
    await requireDesk();
    if (!UUID_RE.test(moveId)) throw new Error("Invalid move.");
    const admin = createSupabaseAdminClient();
    const propertyId = await resolveActivePropertyId(admin);
    const { data: move } = await admin
      .from("room_assignment_moves")
      .select("assignment_id, booking_id, from_unit_id, to_unit_id")
      .eq("id", moveId)
      .eq("property_id", propertyId)
      .maybeSingle();
    const { error } = await admin.rpc("undo_room_assignment_move", {
      p_property_id: propertyId,
      p_move_id: moveId,
    });
    if (error) throw new Error(error.message);

    await writeAuditEvent(admin, {
      propertyId,
      action: "calendar.assignment.move_undo",
      entityType: "room_assignments",
      entityId: (move?.assignment_id as string | null) ?? moveId,
      summary: "Room move undone",
      meta: {
        move_id: moveId,
        booking_id: move?.booking_id,
        from_unit_id: move?.from_unit_id,
        to_unit_id: move?.to_unit_id,
      },
    });
    revalidateCalendar();
    return { ok: true, message: "Room move undone." };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Could not undo room move.",
    };
  }
}

export async function createCalendarRoomBlock(
  _prev: CalendarBookState,
  formData: FormData,
): Promise<CalendarBookState> {
  try {
    await requireDesk();
    const roomUnitId = trimRequired(formData.get("room_unit_id"), "Room");
    const blockKind = trimRequired(formData.get("block_kind"), "Block type");
    const fromDate = trimRequired(formData.get("from_date"), "Start date");
    const toDate = trimRequired(formData.get("to_date"), "End date");
    const reason = trimRequired(formData.get("reason"), "Reason");
    if (!UUID_RE.test(roomUnitId)) throw new Error("Invalid room.");
    if (!["ooo", "oos", "hold"].includes(blockKind)) {
      throw new Error("Invalid room block type.");
    }
    assertStayDates(fromDate, toDate);

    const admin = createSupabaseAdminClient();
    const propertyId = await resolveActivePropertyId(admin);
    const { data: unit } = await admin
      .from("room_units")
      .select("label")
      .eq("id", roomUnitId)
      .eq("property_id", propertyId)
      .maybeSingle();
    const { data: blockId, error } = await admin.rpc(
      "create_calendar_room_block",
      {
        p_property_id: propertyId,
        p_room_unit_id: roomUnitId,
        p_block_kind: blockKind,
        p_from_date: fromDate,
        p_to_date: toDate,
        p_reason: reason,
      },
    );
    if (error) throw new Error(error.message);

    await writeAuditEvent(admin, {
      propertyId,
      action: "calendar.block.create",
      entityType: "room_blocks",
      entityId: blockId as string,
      summary: `${unit?.label ?? "Room"} · ${blockKind.toUpperCase()} · ${fromDate}→${toDate}`,
      meta: { room_unit_id: roomUnitId, reason },
    });
    revalidateCalendar();
    return { ok: true, message: `${blockKind.toUpperCase()} block created.` };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Could not block room.",
    };
  }
}

export async function releaseCalendarRoomBlock(
  blockId: string,
): Promise<CalendarBookState> {
  try {
    await requireDesk();
    if (!UUID_RE.test(blockId)) throw new Error("Invalid room block.");
    const admin = createSupabaseAdminClient();
    const propertyId = await resolveActivePropertyId(admin);
    const { data: block } = await admin
      .from("room_blocks")
      .select("room_unit_id, block_kind, from_date, to_date")
      .eq("id", blockId)
      .eq("property_id", propertyId)
      .maybeSingle();
    const { error } = await admin.rpc("release_calendar_room_block", {
      p_property_id: propertyId,
      p_block_id: blockId,
    });
    if (error) throw new Error(error.message);

    await writeAuditEvent(admin, {
      propertyId,
      action: "calendar.block.release",
      entityType: "room_blocks",
      entityId: blockId,
      summary: `${String(block?.block_kind ?? "room").toUpperCase()} block released`,
      meta: {
        room_unit_id: block?.room_unit_id,
        from_date: block?.from_date,
        to_date: block?.to_date,
      },
    });
    revalidateCalendar();
    return { ok: true, message: "Room block released." };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Could not release room block.",
    };
  }
}

export type CalendarRatePreview = {
  ok: boolean;
  error?: string;
  fromTypeName?: string;
  toTypeName?: string;
  fromRateBtn?: number | null;
  toRateBtn?: number | null;
  nights?: number;
  deltaBtn?: number | null;
  sameType?: boolean;
};

/** Preview rate change before a cross-category room move. */
export async function previewCalendarCrossTypeMove(
  assignmentId: string,
  toUnitId: string,
): Promise<CalendarRatePreview> {
  try {
    await requireDesk();
    if (!UUID_RE.test(assignmentId) || !UUID_RE.test(toUnitId)) {
      throw new Error("Invalid assignment or destination room.");
    }
    const admin = createSupabaseAdminClient();
    const propertyId = await resolveActivePropertyId(admin);
    const { data: assignment } = await admin
      .from("room_assignments")
      .select(
        `from_date, to_date,
         room_units!inner(room_type_id, room_types(name)),
         bookings!inner(agent_id, booked_by_role, source, agents(rate_tier))`,
      )
      .eq("id", assignmentId)
      .eq("property_id", propertyId)
      .maybeSingle();
    const { data: destination } = await admin
      .from("room_units")
      .select("room_type_id, room_types(name)")
      .eq("id", toUnitId)
      .eq("property_id", propertyId)
      .maybeSingle();
    if (!assignment || !destination) throw new Error("Assignment or room missing.");

    const fromUnit = (
      Array.isArray(assignment.room_units)
        ? assignment.room_units[0]
        : assignment.room_units
    ) as {
      room_type_id: string;
      room_types: { name?: string } | { name?: string }[] | null;
    };
    const toUnit = destination as {
      room_type_id: string;
      room_types: { name?: string } | { name?: string }[] | null;
    };
    const fromTypeName = Array.isArray(fromUnit.room_types)
      ? fromUnit.room_types[0]?.name
      : fromUnit.room_types?.name;
    const toTypeName = Array.isArray(toUnit.room_types)
      ? toUnit.room_types[0]?.name
      : toUnit.room_types?.name;
    const booking = (
      Array.isArray(assignment.bookings)
        ? assignment.bookings[0]
        : assignment.bookings
    ) as {
      agent_id?: string | null;
      booked_by_role?: string | null;
      source?: string | null;
      agents?: { rate_tier?: string } | { rate_tier?: string }[] | null;
    };
    const agent = Array.isArray(booking.agents)
      ? booking.agents[0]
      : booking.agents;
    const source = booking.booked_by_role || booking.source || "reservation";
    const tier = booking.agent_id
      ? agentRateTier(agent?.rate_tier)
      : rateTierFromSource(source);
    const nights = nightsBetween(
      assignment.from_date as string,
      assignment.to_date as string,
    );
    const season = await resolveSeasonKind(
      admin,
      propertyId,
      assignment.from_date as string,
    );
    const fromRate = await lookupRoomRateBtn(admin, {
      propertyId,
      roomTypeId: fromUnit.room_type_id,
      seasonKind: season,
      rateTier: tier,
    });
    const toRate = await lookupRoomRateBtn(admin, {
      propertyId,
      roomTypeId: toUnit.room_type_id,
      seasonKind: season,
      rateTier: tier,
    });
    const sameType = fromUnit.room_type_id === toUnit.room_type_id;
    const delta =
      fromRate != null && toRate != null
        ? roundBtn((toRate - fromRate) * nights)
        : null;
    return {
      ok: true,
      fromTypeName: fromTypeName ?? "Current category",
      toTypeName: toTypeName ?? "New category",
      fromRateBtn: fromRate,
      toRateBtn: toRate,
      nights,
      deltaBtn: delta,
      sameType,
    };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Could not preview rates.",
    };
  }
}

export async function resizeCalendarAssignment(
  assignmentId: string,
  fromDate: string,
  toDate: string,
): Promise<CalendarBookState> {
  try {
    await requireDesk();
    if (!UUID_RE.test(assignmentId)) throw new Error("Invalid assignment.");
    assertStayDates(fromDate, toDate);
    const admin = createSupabaseAdminClient();
    const propertyId = await resolveActivePropertyId(admin);
    const { error } = await admin.rpc("resize_room_assignment_dates", {
      p_property_id: propertyId,
      p_assignment_id: assignmentId,
      p_from_date: fromDate,
      p_to_date: toDate,
    });
    if (error) throw new Error(error.message);
    await writeAuditEvent(admin, {
      propertyId,
      action: "calendar.assignment.resize",
      entityType: "room_assignments",
      entityId: assignmentId,
      summary: `Stay resized ${fromDate}→${toDate}`,
    });
    const { data: assignment } = await admin
      .from("room_assignments")
      .select("from_date, to_date")
      .eq("id", assignmentId)
      .maybeSingle();
    if (assignment) {
      await enqueueAfterBookingChange(
        admin,
        propertyId,
        assignment.from_date as string,
        assignment.to_date as string,
        "calendar.resize",
      );
    }
    revalidateCalendar();
    return { ok: true, message: "Stay dates updated." };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Could not resize stay.",
    };
  }
}

export async function splitCalendarAssignment(
  assignmentId: string,
  splitDate: string,
  toUnitId: string,
): Promise<CalendarBookState> {
  try {
    await requireDesk();
    if (!UUID_RE.test(assignmentId) || !UUID_RE.test(toUnitId)) {
      throw new Error("Invalid assignment or destination room.");
    }
    const admin = createSupabaseAdminClient();
    const propertyId = await resolveActivePropertyId(admin);
    const { data: newId, error } = await admin.rpc("split_room_assignment", {
      p_property_id: propertyId,
      p_assignment_id: assignmentId,
      p_split_date: splitDate,
      p_to_unit_id: toUnitId,
    });
    if (error) throw new Error(error.message);
    await writeAuditEvent(admin, {
      propertyId,
      action: "calendar.assignment.split",
      entityType: "room_assignments",
      entityId: assignmentId,
      summary: `Stay split from ${splitDate}`,
      meta: { new_assignment_id: newId, to_unit_id: toUnitId },
    });
    revalidateCalendar();
    return {
      ok: true,
      message: "Stay split onto the destination room.",
    };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Could not split stay.",
    };
  }
}

export async function moveCalendarAssignmentCrossType(
  assignmentId: string,
  toUnitId: string,
  rateDecision: "continue" | "override" | "same_type",
  overrideAmountBtn?: number,
  overrideReason?: string,
): Promise<CalendarBookState> {
  try {
    await requireDesk();
    if (!UUID_RE.test(assignmentId) || !UUID_RE.test(toUnitId)) {
      throw new Error("Invalid assignment or destination room.");
    }
    const admin = createSupabaseAdminClient();
    const propertyId = await resolveActivePropertyId(admin);
    const preview = await previewCalendarCrossTypeMove(assignmentId, toUnitId);
    if (!preview.ok) throw new Error(preview.error ?? "Rate preview failed.");
    const decision = preview.sameType ? "same_type" : rateDecision;
    if (!preview.sameType && decision !== "continue" && decision !== "override") {
      throw new Error("Confirm the new rate or enter an override.");
    }
    const reasonTrim = (overrideReason ?? "").trim();
    if (decision === "override") {
      if (overrideAmountBtn == null || !Number.isFinite(overrideAmountBtn)) {
        throw new Error("Override amount is required.");
      }
      if (!reasonTrim) {
        throw new Error("Override reason is required for rate override audit.");
      }
    }
    const { data: moveId, error } = await admin.rpc(
      "move_room_assignment_cross_type",
      {
        p_property_id: propertyId,
        p_assignment_id: assignmentId,
        p_to_unit_id: toUnitId,
        p_rate_decision: decision,
        p_override_amount_btn:
          decision === "override" ? (overrideAmountBtn ?? null) : null,
        p_override_reason: decision === "override" ? reasonTrim : null,
      },
    );
    if (error) throw new Error(error.message);
    await writeAuditEvent(admin, {
      propertyId,
      action: "calendar.assignment.move_cross_type",
      entityType: "room_assignments",
      entityId: assignmentId,
      summary: `${preview.fromTypeName} → ${preview.toTypeName} · ${decision}`,
      meta: {
        move_id: moveId,
        delta_btn: preview.deltaBtn,
        override_amount_btn: overrideAmountBtn ?? null,
        override_reason: decision === "override" ? reasonTrim : null,
      },
    });
    if (decision === "override") {
      await writeAuditEvent(admin, {
        propertyId,
        action: "rate.override",
        entityType: "room_assignments",
        entityId: assignmentId,
        summary: `Rate override Nu ${overrideAmountBtn}: ${reasonTrim}`,
        meta: {
          move_id: moveId,
          override_amount_btn: overrideAmountBtn,
          override_reason: reasonTrim,
          from_type: preview.fromTypeName,
          to_type: preview.toTypeName,
        },
      });
    }
    revalidateCalendar();
    return {
      ok: true,
      moveId: moveId as string,
      message: `Moved to ${preview.toTypeName}. Undo available for 60 seconds.`,
    };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Could not move across categories.",
    };
  }
}

export type CalendarReservationEditInput = {
  bookingId: string;
  contactName: string;
  contactPhone: string;
  contactEmail: string;
  adults: number;
  guideNumber: string;
  guestOrigin: string;
  source: string;
  agentId: string;
  notes: string;
};

/** Edit reservation details without changing payment/folio accounting. */
export async function updateCalendarReservationDetails(
  input: CalendarReservationEditInput,
): Promise<CalendarBookState> {
  try {
    await requireDesk();
    if (!UUID_RE.test(input.bookingId)) throw new Error("Invalid booking.");
    const contactName = trimRequired(input.contactName, "Guest name");
    const contactPhone = trimRequired(input.contactPhone, "Phone");
    assertPhone(contactPhone);
    const contactEmail = optionalTrim(input.contactEmail);
    assertOptionalEmail(contactEmail);
    const guideNumber = optionalTrim(input.guideNumber);
    const notes = optionalTrim(input.notes);
    const agentId = optionalTrim(input.agentId);
    const source = trimRequired(input.source, "Booked by");
    if (!SOURCES.has(source)) throw new Error("Invalid booked-by role.");
    if (!GUEST_ORIGINS.has(input.guestOrigin)) {
      throw new Error("Invalid guest origin.");
    }
    const adults = Math.max(1, Math.min(48, Math.floor(Number(input.adults))));
    if (!Number.isFinite(adults)) throw new Error("Adults must be a number.");
    if ((source === "agent" || source === "mou_agent") && !agentId) {
      throw new Error("Select an approved agent for agent bookings.");
    }
    if (input.guestOrigin === "international" && !guideNumber) {
      throw new Error("Guide number is required for international tourists.");
    }

    const admin = createSupabaseAdminClient();
    const propertyId = await resolveActivePropertyId(admin);
    const { data: existing } = await admin
      .from("bookings")
      .select("id, payment_mode, contact_name")
      .eq("id", input.bookingId)
      .eq("property_id", propertyId)
      .maybeSingle();
    if (!existing) throw new Error("Booking not found at this property.");

    if (agentId) {
      const { data: agent } = await admin
        .from("agents")
        .select("status")
        .eq("id", agentId)
        .maybeSingle();
      if (!agent || !["approved", "demo"].includes(agent.status as string)) {
        throw new Error("Agent must be approved (or demo).");
      }
    }

    const { error } = await admin
      .from("bookings")
      .update({
        contact_name: contactName,
        contact_phone: contactPhone,
        contact_email: contactEmail,
        adults,
        guide_number: guideNumber,
        guest_origin: input.guestOrigin,
        source: source === "mou_agent" ? "agent" : source,
        booked_by_role: source,
        agent_id: agentId,
        notes,
      })
      .eq("id", input.bookingId)
      .eq("property_id", propertyId);
    if (error) throw new Error("Could not update reservation.");

    await writeAuditEvent(admin, {
      propertyId,
      action: "calendar.reservation.update",
      entityType: "bookings",
      entityId: input.bookingId,
      summary: `${existing.contact_name ?? "Guest"} → ${contactName}`,
      meta: {
        source,
        agent_id: agentId,
        adults,
        guest_origin: input.guestOrigin,
      },
    });
    revalidateCalendar();
    return { ok: true, bookingId: input.bookingId, message: "Reservation updated." };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Could not update reservation.",
    };
  }
}
