"use server";

import type {
  CheckInBooking,
  PartnerOption,
} from "@/components/erp/CheckInForm";
import { isDeskAuthenticated } from "@/lib/desk-auth";
import { requireDeskPropertyId } from "@/lib/desk-property";
import { listNcReasonCodes } from "@/lib/marketing/nc";
import { calculateRoomNightTax, roundBtn } from "@/lib/pricing";
import {
  agentRateTier,
  lookupRoomRateBtn,
  nightsBetween,
  resolveSeasonKind,
} from "@/lib/rates";
import { loadRoomRateTaxSettings } from "@/lib/room-rate-tax";
import { loadCheckInRoomOptions } from "@/lib/room-assignments";
import { loadRoomChargePosOrders } from "@/lib/folio/room-pos-orders";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type StayHubCheckInPayload = {
  booking: CheckInBooking;
  guides: PartnerOption[];
  drivers: PartnerOption[];
  slots: Awaited<ReturnType<typeof loadCheckInRoomOptions>>["slots"];
  units: Awaited<ReturnType<typeof loadCheckInRoomOptions>>["units"];
};

export type StayHubMoneyPayload = {
  folioId: string | null;
  balanceBtn: number;
  roomLabels: string[];
  hasCharges: boolean;
  hasInvoice: boolean;
  invoiceNo: string | null;
  invoiceDocId: string | null;
  agentId: string | null;
  agentName: string | null;
  paymentMode: string | null;
  /** Room-charge F&B tickets with item-level serve / void audit. */
  roomPosOrders: import("@/lib/folio/room-pos-orders-types").RoomChargePosOrder[];
};

export type StayHubSummary = {
  bookingId: string;
  contactName: string | null;
  contactPhone: string | null;
  contactEmail: string | null;
  status: string;
  checkIn: string;
  checkOut: string;
  adults: number;
  rooms: number;
  guideNumber: string | null;
  guestOrigin: string | null;
  source: string | null;
  agentId: string | null;
  agentName: string | null;
  soldByStaffId: string | null;
  soldByName: string | null;
  salesClaimStatus: string | null;
  notes: string | null;
  paymentMode: string | null;
  sdfIncomplete: boolean;
  hasRoomAssigned: boolean;
  assignmentId: string | null;
  roomUnitId: string | null;
  roomLabel: string | null;
  roomTypeId: string | null;
  roomTypeName: string | null;
  folioId: string | null;
  folioBalance: number;
  isLocked: boolean;
  earlyCheckoutFeeBtn: number | null;
  lateCheckoutFeeBtn: number | null;
  /** Room assignment chargeable flag (false = NC). */
  chargeable: boolean;
  ncReasonCode: string | null;
  roomNcReasons: { code: string; label: string }[];
  /** Manager-approved nightly rate (null = use rate sheet). */
  agreedNightlyRateBtn: number | null;
  agreedRateReason: string | null;
  mealPlanCode: string | null;
};

type Result<T> = { ok: true; data: T } | { ok: false; error: string };

export async function fetchStayHubSummary(
  bookingId: string,
  preferredAssignmentId?: string | null,
): Promise<Result<StayHubSummary>> {
  if (!(await isDeskAuthenticated())) {
    return { ok: false, error: "Not signed in" };
  }
  const admin = createSupabaseAdminClient();
  const propertyId = await requireDeskPropertyId();

  const { data, error } = await admin
    .from("bookings")
    .select(
      `
      id, contact_name, contact_phone, contact_email, status, check_in, check_out,
      adults, rooms, guide_number, guest_origin, source, notes, agent_id, payment_mode,
      booked_by_role, sold_by_staff_id, sales_claim_status, meal_plan_code,
      agreed_nightly_rate_btn, agreed_rate_reason,
      agents(company_name),
      sold_by_staff:staff_members!sold_by_staff_id(full_name),
      booking_guests(full_name, passport_or_cid, nationality, sdf_ref),
      room_assignments(id, room_unit_id, is_locked, from_date, to_date,
        chargeable, nc_reason_code,
        room_units(id, label, room_type_id, room_types(id, name))),
      folios(id, status, folio_lines(total_btn, status, source_type))
    `,
    )
    .eq("id", bookingId)
    .eq("property_id", propertyId)
    .maybeSingle();

  if (error) return { ok: false, error: error.message };
  if (!data) return { ok: false, error: "Booking not found" };

  const roomNcReasons = (
    await listNcReasonCodes(admin, propertyId, "room")
  ).map((r) => ({ code: r.code, label: r.label }));

  const agentRaw = data.agents as
    | { company_name?: string }
    | { company_name?: string }[]
    | null;
  const agent = Array.isArray(agentRaw) ? agentRaw[0] : agentRaw;

  const guests =
    (data.booking_guests as
      | Array<{
          full_name?: string | null;
          passport_or_cid?: string | null;
          nationality?: string | null;
          sdf_ref?: string | null;
        }>
      | null) ?? [];
  const origin = (data.guest_origin as string | null) ?? "international";
  const needsDocs = origin === "international" || origin === "regional";
  const sdfIncomplete =
    needsDocs &&
    (guests.length === 0 ||
      guests.some(
        (g) =>
          !String(g.passport_or_cid ?? "").trim() ||
          !String(g.nationality ?? "").trim(),
      ));

  const assigns =
    (data.room_assignments as
      | Array<{
          id: string;
          room_unit_id: string;
          is_locked?: boolean;
          chargeable?: boolean;
          nc_reason_code?: string | null;
          room_units:
            | {
                id?: string;
                label?: string;
                room_type_id?: string;
                room_types?:
                  | { id?: string; name?: string }
                  | { id?: string; name?: string }[]
                  | null;
              }
            | {
                id?: string;
                label?: string;
                room_type_id?: string;
                room_types?:
                  | { id?: string; name?: string }
                  | { id?: string; name?: string }[]
                  | null;
              }[]
            | null;
        }>
      | null) ?? [];

  const preferred =
    (preferredAssignmentId
      ? assigns.find((a) => a.id === preferredAssignmentId)
      : null) ??
    assigns[0] ??
    null;

  const unit = preferred
    ? Array.isArray(preferred.room_units)
      ? preferred.room_units[0]
      : preferred.room_units
    : null;
  const rt = unit?.room_types
    ? Array.isArray(unit.room_types)
      ? unit.room_types[0]
      : unit.room_types
    : null;

  const folios =
    (data.folios as
      | Array<{
          id: string;
          status: string;
          folio_lines?: Array<{
            total_btn?: number;
            status?: string;
            source_type?: string;
          }> | null;
        }>
      | null) ?? [];
  const openFolio = folios.find((f) => f.status === "open") ?? folios[0] ?? null;
  const lines = (openFolio?.folio_lines ?? []).filter(
    (l) => l.status === "posted",
  );
  const balance = lines.reduce((s, l) => s + Number(l.total_btn ?? 0), 0);

  const { data: policy } = await admin
    .from("property_policies")
    .select("early_checkout_fee_btn, late_checkout_fee_btn")
    .eq("property_id", propertyId)
    .maybeSingle();

  return {
    ok: true,
    data: {
      bookingId: data.id as string,
      contactName: (data.contact_name as string | null) ?? null,
      contactPhone: (data.contact_phone as string | null) ?? null,
      contactEmail: (data.contact_email as string | null) ?? null,
      status: data.status as string,
      checkIn: data.check_in as string,
      checkOut: data.check_out as string,
      adults: Number(data.adults ?? 1),
      rooms: Number(data.rooms ?? 1),
      guideNumber: (data.guide_number as string | null) ?? null,
      guestOrigin: (data.guest_origin as string | null) ?? null,
      source:
        (data.booked_by_role as string | null) ||
        (data.source as string | null) ||
        null,
      agentId: (data.agent_id as string | null) ?? null,
      agentName: agent?.company_name ?? null,
      soldByStaffId: (data.sold_by_staff_id as string | null) ?? null,
      soldByName: (() => {
        const raw = data.sold_by_staff as
          | { full_name?: string }
          | { full_name?: string }[]
          | null;
        const s = Array.isArray(raw) ? raw[0] : raw;
        return s?.full_name ?? null;
      })(),
      salesClaimStatus: (data.sales_claim_status as string | null) ?? null,
      notes: (data.notes as string | null) ?? null,
      paymentMode: (data.payment_mode as string | null) ?? null,
      sdfIncomplete,
      hasRoomAssigned: assigns.length > 0,
      assignmentId: preferred?.id ?? null,
      roomUnitId: preferred?.room_unit_id ?? unit?.id ?? null,
      roomLabel: unit?.label ?? null,
      roomTypeId: unit?.room_type_id ?? rt?.id ?? null,
      roomTypeName: rt?.name ?? null,
      folioId: openFolio?.id ?? null,
      folioBalance: balance,
      isLocked: Boolean(preferred?.is_locked),
      chargeable: preferred?.chargeable !== false,
      ncReasonCode: (preferred?.nc_reason_code as string | null) ?? null,
      roomNcReasons,
      agreedNightlyRateBtn:
        data.agreed_nightly_rate_btn != null
          ? Number(data.agreed_nightly_rate_btn)
          : null,
      agreedRateReason: (data.agreed_rate_reason as string | null) ?? null,
      mealPlanCode: (data.meal_plan_code as string | null) ?? null,
      earlyCheckoutFeeBtn:
        policy?.early_checkout_fee_btn == null
          ? null
          : Number(policy.early_checkout_fee_btn),
      lateCheckoutFeeBtn:
        policy?.late_checkout_fee_btn == null
          ? null
          : Number(policy.late_checkout_fee_btn),
    },
  };
}

export async function fetchStayHubCheckIn(
  bookingId: string,
): Promise<Result<StayHubCheckInPayload>> {
  if (!(await isDeskAuthenticated())) {
    return { ok: false, error: "Not signed in" };
  }
  const admin = createSupabaseAdminClient();
  const propertyId = await requireDeskPropertyId();

  const { data, error } = await admin
    .from("bookings")
    .select(
      `id, contact_name, contact_phone, check_in, check_out, status, guest_origin, guide_number, guide_id, driver_id, payment_mode, adults, rooms, agent_id, quoted_total_btn,
       agents(company_name, credit_limit),
       booking_rooms(qty, inventory_kind, room_type_id, room_types(name, code)),
       booking_guests(full_name, nationality, passport_or_cid, sdf_ref, sdf_doc_url, sort_order),
       booking_drivers(full_name, phone, vehicle_no, license_no),
       folios(id, status)`,
    )
    .eq("id", bookingId)
    .eq("property_id", propertyId)
    .maybeSingle();

  if (error) return { ok: false, error: error.message };
  if (!data) return { ok: false, error: "Booking not found" };

  if (!["pending", "confirmed"].includes(data.status as string)) {
    return { ok: false, error: `Status is ${data.status} — not open for check-in` };
  }

  const openFolio = (
    (data.folios as { id: string; status: string }[] | null) ?? []
  ).find((f) => f.status === "open");

  const agentRaw = data.agents as
    | { company_name?: string; credit_limit?: number }
    | { company_name?: string; credit_limit?: number }[]
    | null;
  const agent = Array.isArray(agentRaw) ? agentRaw[0] : agentRaw;
  const agentId = (data.agent_id as string | null) ?? null;

  let creditAvailable: number | null = null;
  let stayEstimate: number | null = null;
  if (agentId) {
    const { data: ledger } = await admin
      .from("agent_credit_ledger")
      .select("amount_btn, entry_type")
      .eq("agent_id", agentId);
    const balance = (ledger ?? []).reduce((sum, row) => {
      const amt = Number(row.amount_btn ?? 0);
      return row.entry_type === "charge" ? sum + amt : sum - amt;
    }, 0);
    const limit = Number(agent?.credit_limit ?? 0);
    creditAvailable = roundBtn(Math.max(0, limit - balance));

    const quoted =
      data.quoted_total_btn != null ? Number(data.quoted_total_btn) : null;
    if (quoted != null && Number.isFinite(quoted) && quoted > 0) {
      stayEstimate = roundBtn(quoted);
    } else {
      const rooms =
        (data.booking_rooms as
          | { qty: number; inventory_kind: string; room_type_id: string }[]
          | null) ?? [];
      const nights = nightsBetween(
        data.check_in as string,
        data.check_out as string,
      );
      const season = await resolveSeasonKind(
        admin,
        propertyId,
        data.check_in as string,
      );
      const taxSettings = await loadRoomRateTaxSettings(admin, propertyId);
      const { data: agentRow } = await admin
        .from("agents")
        .select("rate_tier")
        .eq("id", agentId)
        .maybeSingle();
      const tier = agentRateTier(agentRow?.rate_tier as string | undefined);
      let estimate = 0;
      for (const line of rooms) {
        if (line.inventory_kind !== "sellable_guest") continue;
        const rate = await lookupRoomRateBtn(admin, {
          propertyId,
          roomTypeId: line.room_type_id,
          seasonKind: season,
          rateTier: tier,
        });
        if (rate != null) {
          const nightAllIn = calculateRoomNightTax(rate, taxSettings).totalBtn;
          estimate += nightAllIn * Number(line.qty) * nights;
        }
      }
      stayEstimate = roundBtn(estimate);
    }
  }

  const guests = (
    (data.booking_guests as CheckInBooking["booking_guests"] | null) ?? []
  ).slice();
  guests.sort((a, b) => {
    const ao = (a as { sort_order?: number }).sort_order ?? 0;
    const bo = (b as { sort_order?: number }).sort_order ?? 0;
    return ao - bo;
  });

  const bookingRooms = (
    (data.booking_rooms as
      | {
          qty: number;
          inventory_kind: string;
          room_type_id: string;
          room_types:
            | { name: string; code: string }
            | { name: string; code: string }[]
            | null;
        }[]
      | null) ?? []
  ).map((r) => {
    const roomType = Array.isArray(r.room_types)
      ? (r.room_types[0] ?? null)
      : (r.room_types ?? null);
    return {
      qty: Number(r.qty),
      inventory_kind: r.inventory_kind,
      room_type_id: r.room_type_id,
      room_types: roomType,
    };
  });

  const booking: CheckInBooking = {
    id: data.id as string,
    contact_name: (data.contact_name as string | null) ?? null,
    contact_phone: (data.contact_phone as string | null) ?? null,
    check_in: data.check_in as string,
    check_out: data.check_out as string,
    status: data.status as string,
    guest_origin: (data.guest_origin as string | null) ?? null,
    guide_number: (data.guide_number as string | null) ?? null,
    guide_id: (data.guide_id as string | null) ?? null,
    driver_id: (data.driver_id as string | null) ?? null,
    payment_mode: (data.payment_mode as string | null) ?? null,
    adults: Number(data.adults ?? 1),
    rooms: Number(data.rooms ?? 1),
    agent_id: agentId,
    agent_name: agent?.company_name ?? null,
    credit_available_btn: creditAvailable,
    stay_estimate_btn: stayEstimate,
    booking_rooms: bookingRooms,
    booking_guests: guests,
    booking_drivers:
      (data.booking_drivers as CheckInBooking["booking_drivers"] | null) ?? [],
  };

  void openFolio;

  const [{ data: guideRows }, { data: driverRows }, roomOpts] =
    await Promise.all([
      admin
        .from("guides")
        .select("id, guide_number, full_name, phone, visit_count")
        .eq("property_id", propertyId)
        .order("visit_count", { ascending: false })
        .limit(50),
      admin
        .from("drivers")
        .select("id, full_name, phone, vehicle_no, license_no, visit_count")
        .eq("property_id", propertyId)
        .order("visit_count", { ascending: false })
        .limit(50),
      loadCheckInRoomOptions(admin, {
        propertyId,
        bookingId: booking.id,
        checkIn: booking.check_in,
        checkOut: booking.check_out,
        lines: bookingRooms.map((r) => ({
          room_type_id: r.room_type_id,
          qty: r.qty,
          inventory_kind: r.inventory_kind,
          room_types: r.room_types,
        })),
      }),
    ]);

  const guides: PartnerOption[] = (guideRows ?? []).map((g) => ({
    id: g.id as string,
    label: g.full_name
      ? `${g.full_name} (#${g.guide_number})`
      : `#${g.guide_number}`,
    sublabel: (g.phone as string | null) ?? undefined,
    fill: { guide_number: (g.guide_number as string) || "" },
  }));

  const drivers: PartnerOption[] = (driverRows ?? []).map((d) => ({
    id: d.id as string,
    label: (d.full_name as string) ?? (d.phone as string) ?? "Driver",
    sublabel:
      [d.phone, d.vehicle_no].filter(Boolean).join(" · ") || undefined,
    fill: {
      driver_name: (d.full_name as string | null) ?? "",
      driver_phone: (d.phone as string | null) ?? "",
      vehicle_no: (d.vehicle_no as string | null) ?? "",
      license_no: (d.license_no as string | null) ?? "",
    },
  }));

  return {
    ok: true,
    data: {
      booking,
      guides,
      drivers,
      slots: roomOpts.slots,
      units: roomOpts.units,
    },
  };
}

export async function fetchStayHubMoney(
  bookingId: string,
): Promise<Result<StayHubMoneyPayload>> {
  if (!(await isDeskAuthenticated())) {
    return { ok: false, error: "Not signed in" };
  }
  const admin = createSupabaseAdminClient();
  const propertyId = await requireDeskPropertyId();

  const { data, error } = await admin
    .from("bookings")
    .select(
      `
      id, agent_id, payment_mode,
      agents(company_name),
      room_assignments(room_units(label)),
      folios(id, status,
        folio_lines(total_btn, status, source_type),
        fiscal_documents(id, doc_no, doc_kind, status)
      )
    `,
    )
    .eq("id", bookingId)
    .eq("property_id", propertyId)
    .maybeSingle();

  if (error) return { ok: false, error: error.message };
  if (!data) return { ok: false, error: "Booking not found" };

  const agentRaw = data.agents as
    | { company_name?: string }
    | { company_name?: string }[]
    | null;
  const agent = Array.isArray(agentRaw) ? agentRaw[0] : agentRaw;

  const assigns =
    (data.room_assignments as
      | Array<{
          room_units:
            | { label?: string }
            | { label?: string }[]
            | null;
        }>
      | null) ?? [];
  const roomLabels = assigns
    .map((a) => {
      const u = Array.isArray(a.room_units) ? a.room_units[0] : a.room_units;
      return u?.label;
    })
    .filter(Boolean) as string[];

  const folios =
    (data.folios as
      | Array<{
          id: string;
          status: string;
          folio_lines?: Array<{
            total_btn?: number;
            status?: string;
            source_type?: string;
          }> | null;
          fiscal_documents?: Array<{
            id: string;
            doc_no?: string;
            doc_kind?: string;
            status?: string;
          }> | null;
        }>
      | null) ?? [];
  const openFolio = folios.find((f) => f.status === "open") ?? folios[0] ?? null;
  const lines = (openFolio?.folio_lines ?? []).filter(
    (l) => l.status === "posted",
  );
  const balance = lines.reduce((s, l) => s + Number(l.total_btn ?? 0), 0);
  const hasCharges = lines.some(
    (l) => (l.source_type ?? "") !== "payment" && Number(l.total_btn ?? 0) > 0,
  );
  // payments are negative or separate — balance already nets
  const chargesOnly = lines.some(
    (l) =>
      !["payment", "deposit"].includes(l.source_type ?? "") &&
      Number(l.total_btn ?? 0) !== 0,
  );

  const inv =
    (openFolio?.fiscal_documents ?? []).find(
      (d) => d.doc_kind === "tax_invoice" || d.doc_kind === "invoice",
    ) ?? (openFolio?.fiscal_documents ?? [])[0];

  let roomPosOrders: Awaited<ReturnType<typeof loadRoomChargePosOrders>> = [];
  try {
    roomPosOrders = await loadRoomChargePosOrders(
      admin,
      propertyId,
      bookingId,
    );
  } catch {
    roomPosOrders = [];
  }

  return {
    ok: true,
    data: {
      folioId: openFolio?.id ?? null,
      balanceBtn: balance,
      roomLabels,
      hasCharges: hasCharges || chargesOnly,
      hasInvoice: Boolean(inv?.doc_no),
      invoiceNo: inv?.doc_no ?? null,
      invoiceDocId: inv?.id ?? null,
      agentId: (data.agent_id as string | null) ?? null,
      agentName: agent?.company_name ?? null,
      paymentMode: (data.payment_mode as string | null) ?? null,
      roomPosOrders,
    },
  };
}

export async function fetchCalendarAgentsUnits(): Promise<
  Result<{ agents: { id: string; company_name: string | null }[]; units: { id: string; label: string; room_type_id: string; room_type_name: string }[] }>
> {
  if (!(await isDeskAuthenticated())) {
    return { ok: false, error: "Not signed in" };
  }
  const admin = createSupabaseAdminClient();
  const propertyId = await requireDeskPropertyId();

  const [{ data: agents }, { data: units }] = await Promise.all([
    admin
      .from("agents")
      .select("id, company_name")
      .eq("property_id", propertyId)
      .order("company_name")
      .limit(300),
    admin
      .from("room_units")
      .select("id, label, room_type_id, room_types(name)")
      .eq("property_id", propertyId)
      .order("sort_order")
      .limit(400),
  ]);

  return {
    ok: true,
    data: {
      agents: (agents ?? []).map((a) => ({
        id: a.id as string,
        company_name: (a.company_name as string | null) ?? null,
      })),
      units: (units ?? []).map((u) => {
        const rt = u.room_types as
          | { name?: string }
          | { name?: string }[]
          | null;
        const name = Array.isArray(rt) ? rt[0]?.name : rt?.name;
        return {
          id: u.id as string,
          label: u.label as string,
          room_type_id: u.room_type_id as string,
          room_type_name: name ?? "Room",
        };
      }),
    },
  };
}
