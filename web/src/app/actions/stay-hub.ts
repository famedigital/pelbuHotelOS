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
  /** agents.status — for credit promote on Folio Settle */
  agentStatus: string | null;
  agentMarket: string | null;
  paymentMode: string | null;
  /** Room-charge F&B tickets with item-level serve / void audit. */
  roomPosOrders: import("@/lib/folio/room-pos-orders-types").RoomChargePosOrder[];
  /** Posted folio lines for Room / POS tabs (void-level corrections). */
  lines: Array<{
    id: string;
    source_type: string;
    description: string | null;
    total_btn: number;
    status: string | null;
    bill_to: string | null;
  }>;
  /** Guest-visible balance (excludes agent-billed room package). */
  guestVisibleBalanceBtn: number;
  agentChargesBtn: number;
  /** Open master folios for StayHub attach. */
  masterCandidates: Array<{ id: string; label: string }>;
  /** Sibling open folios on the same booking (transfer / multi-folio). */
  siblingFolios: Array<{ id: string; label: string }>;
};

export type StayHubSummary = {
  bookingId: string;
  /** Stay confirmation PS-YYYY-##### (searchable). Not a tax invoice. */
  confirmationCode: string | null;
  contactName: string | null;
  contactPhone: string | null;
  contactEmail: string | null;
  status: string;
  checkIn: string;
  checkOut: string;
  adults: number;
  children: number;
  extraBeds: number;
  rooms: number;
  guideNumber: string | null;
  guestOrigin: string | null;
  source: string | null;
  agentId: string | null;
  agentName: string | null;
  /** agents.status for left-rail credit chip + settle promote */
  agentStatus: string | null;
  agentMarket: string | null;
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
  /** Agent guide-settlement evidence (photo | waived | null). */
  guideSignStatus: string | null;
  guideSignPhotoPublicId: string | null;
  guideSignWaiveReason: string | null;
  confirmMode: string;
  advanceStatus: string;
  advanceDueBtn: number | null;
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
      id, confirmation_code, contact_name, contact_phone, contact_email, status, check_in, check_out,
      adults, children, extra_beds, rooms, guide_number, guest_origin, source, notes, agent_id, payment_mode,
      booked_by_role, sold_by_staff_id, sales_claim_status, meal_plan_code,
      agreed_nightly_rate_btn, agreed_rate_reason,
      guide_sign_status, guide_sign_photo_public_id, guide_sign_waive_reason,
      confirm_mode, advance_status, advance_due_btn,
      agents(company_name, contact_email, status, market),
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
    | { company_name?: string; status?: string; market?: string }
    | { company_name?: string; status?: string; market?: string }[]
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
      confirmationCode:
        (data.confirmation_code as string | null) ?? null,
      contactName: (data.contact_name as string | null) ?? null,
      contactPhone: (data.contact_phone as string | null) ?? null,
      contactEmail: (data.contact_email as string | null) ?? null,
      status: data.status as string,
      checkIn: data.check_in as string,
      checkOut: data.check_out as string,
      adults: Number(data.adults ?? 1),
      children: Number(data.children ?? 0),
      extraBeds: Number(data.extra_beds ?? 0),
      rooms: Number(data.rooms ?? 1),
      guideNumber: (data.guide_number as string | null) ?? null,
      guestOrigin: (data.guest_origin as string | null) ?? null,
      source:
        (data.booked_by_role as string | null) ||
        (data.source as string | null) ||
        null,
      agentId: (data.agent_id as string | null) ?? null,
      agentName: agent?.company_name ?? null,
      agentStatus: (agent?.status as string | null) ?? null,
      agentMarket: (agent?.market as string | null) ?? null,
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
      guideSignStatus: (data.guide_sign_status as string | null) ?? null,
      guideSignPhotoPublicId:
        (data.guide_sign_photo_public_id as string | null) ?? null,
      guideSignWaiveReason:
        (data.guide_sign_waive_reason as string | null) ?? null,
      confirmMode: (data.confirm_mode as string | null) ?? "soft",
      advanceStatus: (data.advance_status as string | null) ?? "none",
      advanceDueBtn:
        data.advance_due_btn != null ? Number(data.advance_due_btn) : null,
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
       booking_guests(full_name, nationality, passport_or_cid, sdf_ref, sdf_doc_url, id_photo_url, sort_order),
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
      agents(company_name, status, market),
      room_assignments(room_units(label)),
      folios(id, status,
        folio_lines(id, total_btn, status, source_type, description, bill_to),
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
    | { company_name?: string; status?: string; market?: string }
    | { company_name?: string; status?: string; market?: string }[]
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
            id?: string;
            total_btn?: number;
            status?: string;
            source_type?: string;
            description?: string | null;
            bill_to?: string | null;
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
  const rawLines = (openFolio?.folio_lines ?? []) as Array<{
    id?: string;
    total_btn?: number;
    status?: string;
    source_type?: string;
    description?: string | null;
    bill_to?: string | null;
  }>;
  const lines = rawLines.filter((l) => l.status === "posted");
  const balance = lines.reduce((s, l) => s + Number(l.total_btn ?? 0), 0);
  const guestVisibleBalanceBtn = lines.reduce((s, l) => {
    const st = (l.source_type ?? "").toLowerCase();
    if (st === "payment" || st === "deposit") {
      return s + Number(l.total_btn ?? 0);
    }
    if ((l.bill_to ?? "guest") === "agent") return s;
    return s + Number(l.total_btn ?? 0);
  }, 0);
  const agentChargesBtn = lines.reduce((s, l) => {
    if ((l.bill_to ?? "guest") !== "agent") return s;
    const st = (l.source_type ?? "").toLowerCase();
    if (st === "payment" || st === "deposit") return s;
    return s + Number(l.total_btn ?? 0);
  }, 0);
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

  const [{ data: masterRows }, { data: openOnBooking }] = await Promise.all([
    admin
      .from("folios")
      .select("id, label")
      .eq("property_id", propertyId)
      .eq("status", "open")
      .eq("folio_type", "master")
      .order("created_at", { ascending: false })
      .limit(40),
    admin
      .from("folios")
      .select("id, label")
      .eq("property_id", propertyId)
      .eq("booking_id", bookingId)
      .eq("status", "open")
      .order("created_at", { ascending: true })
      .limit(20),
  ]);

  const openFolioId = openFolio?.id ?? null;
  const masterCandidates = (masterRows ?? [])
    .filter((f) => f.id !== openFolioId)
    .map((f) => ({
      id: f.id as string,
      label: (f.label as string) || String(f.id).slice(0, 8),
    }));
  const siblingFolios = (openOnBooking ?? [])
    .filter((f) => f.id !== openFolioId)
    .map((f) => ({
      id: f.id as string,
      label: (f.label as string) || String(f.id).slice(0, 8),
    }));

  return {
    ok: true,
    data: {
      folioId: openFolioId,
      balanceBtn: balance,
      roomLabels,
      hasCharges: hasCharges || chargesOnly,
      hasInvoice: Boolean(inv?.doc_no),
      invoiceNo: inv?.doc_no ?? null,
      invoiceDocId: inv?.id ?? null,
      agentId: (data.agent_id as string | null) ?? null,
      agentName: agent?.company_name ?? null,
      agentStatus: (agent?.status as string | null) ?? null,
      agentMarket: (agent?.market as string | null) ?? null,
      paymentMode: (data.payment_mode as string | null) ?? null,
      roomPosOrders,
      lines: lines
        .filter((l) => l.id)
        .map((l) => ({
          id: l.id as string,
          source_type: l.source_type ?? "other",
          description: l.description ?? null,
          total_btn: Number(l.total_btn ?? 0),
          status: l.status ?? "posted",
          bill_to: l.bill_to ?? null,
        })),
      guestVisibleBalanceBtn,
      agentChargesBtn,
      masterCandidates,
      siblingFolios,
    },
  };
}

export type StayHubCatalogMealPlan = {
  code: string;
  name: string;
  blurb: string | null;
  amountPerAdultNight: number | null;
  amountPerChildNight: number | null;
};

export type StayHubCatalogAgent = {
  id: string;
  company_name: string;
  market: string;
  status: string;
};

export type StayHubCatalogStaff = {
  id: string;
  full_name: string;
  employee_code: string | null;
  role_label: string | null;
};

/** Agents, staff, meal plans for StayHub pickers (works on deep-link open). */
export async function fetchStayHubCatalog(): Promise<
  Result<{
    agents: StayHubCatalogAgent[];
    staff: StayHubCatalogStaff[];
    mealPlans: StayHubCatalogMealPlan[];
  }>
> {
  if (!(await isDeskAuthenticated())) {
    return { ok: false, error: "Not signed in" };
  }
  const admin = createSupabaseAdminClient();
  const propertyId = await requireDeskPropertyId();

  const [{ data: agents }, { data: staff }, { data: mealRows }] =
    await Promise.all([
      admin
        .from("agents")
        .select("id, company_name, market, status")
        .eq("property_id", propertyId)
        .in("status", ["approved", "demo", "directory"])
        .order("company_name")
        .limit(400),
      admin
        .from("staff_members")
        .select("id, full_name, employee_code, role_label, status")
        .eq("property_id", propertyId)
        .order("full_name")
        .limit(200),
      admin
        .from("meal_plans")
        .select(
          "code, name, blurb, sort_order, amount_btn_per_adult_night, amount_btn_per_child_night, is_active",
        )
        .eq("property_id", propertyId)
        .eq("is_active", true)
        .order("sort_order")
        .limit(40),
    ]);

  return {
    ok: true,
    data: {
      agents: (agents ?? []).map((a) => ({
        id: a.id as string,
        company_name: (a.company_name as string) || "Agent",
        market: (a.market as string) || "bhutan",
        status: (a.status as string) || "approved",
      })),
      staff: (staff ?? [])
        .filter((s) => {
          const st = String(s.status ?? "active").toLowerCase();
          return st !== "inactive" && st !== "terminated" && st !== "left";
        })
        .map((s) => ({
          id: s.id as string,
          full_name: (s.full_name as string) || "Staff",
          employee_code: (s.employee_code as string | null) ?? null,
          role_label: (s.role_label as string | null) ?? null,
        })),
      mealPlans: (mealRows ?? []).map((m) => ({
        code: m.code as string,
        name: (m.name as string) || (m.code as string),
        blurb: (m.blurb as string | null) ?? null,
        amountPerAdultNight:
          m.amount_btn_per_adult_night == null
            ? null
            : Number(m.amount_btn_per_adult_night),
        amountPerChildNight:
          m.amount_btn_per_child_night == null
            ? null
            : Number(m.amount_btn_per_child_night),
      })),
    },
  };
}

/**
 * @deprecated Use fetchStayHubCatalog — kept for older call sites.
 */
export async function fetchCalendarAgentsUnits(): Promise<
  Result<{
    agents: { id: string; company_name: string | null }[];
    units: {
      id: string;
      label: string;
      room_type_id: string;
      room_type_name: string;
    }[];
  }>
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

/** Live room-sheet + package addon quote for StayHub Rate tab. */
export async function previewStayHubSheetRate(input: {
  bookingId: string;
  mealPlanCode?: string | null;
  adults?: number;
  children?: number;
  extraBeds?: number;
}): Promise<
  | {
      ok: true;
      nights: number;
      seasonKind: string;
      rateTier: string;
      roomNightlyBtn: number | null;
      mealStayBtn: number;
      mealPerNightBtn: number;
      extraBedStayBtn: number;
      extraBedPerNightBtn: number;
      systemNightlyTotalBtn: number | null;
      systemStayTotalBtn: number | null;
      agreedNightlyBtn: number | null;
      mealPlanCode: string;
      hasRoomType: boolean;
    }
  | { ok: false; error: string }
> {
  try {
    if (!(await isDeskAuthenticated())) {
      return { ok: false, error: "Not signed in" };
    }
    const admin = createSupabaseAdminClient();
    const propertyId = await requireDeskPropertyId();
    const bookingId = (input.bookingId ?? "").trim();
    if (!bookingId) return { ok: false, error: "Booking required." };

    const { data: booking } = await admin
      .from("bookings")
      .select(
        `id, check_in, check_out, adults, children, extra_beds, meal_plan_code,
         agent_id, booked_by_role, source, agreed_nightly_rate_btn,
         agents(rate_tier, status),
         room_assignments(room_unit_id, room_units(room_type_id)),
         booking_rooms(qty, inventory_kind, room_type_id)`,
      )
      .eq("id", bookingId)
      .eq("property_id", propertyId)
      .maybeSingle();
    if (!booking) return { ok: false, error: "Booking not found." };

    const checkIn = booking.check_in as string;
    const checkOut = booking.check_out as string;
    const nights = nightsBetween(checkIn, checkOut);
    if (nights < 1) return { ok: false, error: "Invalid stay dates." };

    const adults = Math.max(
      1,
      Math.floor(Number(input.adults ?? booking.adults ?? 2)) || 2,
    );
    const children = Math.max(
      0,
      Math.floor(Number(input.children ?? booking.children ?? 0)) || 0,
    );
    const extraBeds = Math.max(
      0,
      Math.floor(Number(input.extraBeds ?? booking.extra_beds ?? 0)) || 0,
    );
    const mealPlanCode =
      (input.mealPlanCode ?? booking.meal_plan_code as string | null) ?? "EP";

    const agentRaw = booking.agents as
      | { rate_tier?: string; status?: string }
      | { rate_tier?: string; status?: string }[]
      | null;
    const agent = Array.isArray(agentRaw) ? agentRaw[0] : agentRaw;
    let tier: import("@/lib/rates").RateTier = "public";
    const source =
      (booking.booked_by_role as string) ||
      (booking.source as string) ||
      "reservation";
    if (source === "mou_agent") tier = agentRateTier("mou_agents");
    else if (source === "agent") tier = agentRateTier("agents");
    if (agent?.rate_tier) {
      tier = agentRateTier(agent.rate_tier);
    }

    const season = await resolveSeasonKind(admin, propertyId, checkIn);
    const taxSettings = await loadRoomRateTaxSettings(admin, propertyId);

    // Prefer assigned room type; else first guest booking_rooms line.
    let roomTypeId: string | null = null;
    const assigns =
      (booking.room_assignments as
        | Array<{
            room_units:
              | { room_type_id?: string }
              | { room_type_id?: string }[]
              | null;
          }>
        | null) ?? [];
    for (const a of assigns) {
      const u = Array.isArray(a.room_units) ? a.room_units[0] : a.room_units;
      if (u?.room_type_id) {
        roomTypeId = u.room_type_id;
        break;
      }
    }
    if (!roomTypeId) {
      const br =
        (booking.booking_rooms as
          | Array<{
              room_type_id?: string;
              inventory_kind?: string;
              qty?: number;
            }>
          | null) ?? [];
      const guest = br.find((r) => r.inventory_kind === "sellable_guest");
      roomTypeId = (guest?.room_type_id as string | undefined) ?? null;
    }

    let roomNightlyBtn: number | null = null;
    let qtyRooms = 1;
    if (roomTypeId) {
      const br =
        (booking.booking_rooms as
          | Array<{
              room_type_id?: string;
              inventory_kind?: string;
              qty?: number;
            }>
          | null) ?? [];
      const match = br.find(
        (r) =>
          r.inventory_kind === "sellable_guest" &&
          r.room_type_id === roomTypeId,
      );
      qtyRooms = Math.max(1, Number(match?.qty ?? 1) || 1);

      const sheet = await lookupRoomRateBtn(admin, {
        propertyId,
        roomTypeId,
        seasonKind: season,
        rateTier: tier,
        adults,
      });
      if (sheet != null) {
        roomNightlyBtn = calculateRoomNightTax(sheet, taxSettings).totalBtn;
      }
    }

    const { resolveStayAddonsForBook } = await import("@/lib/meal-plans");
    const addons = await resolveStayAddonsForBook(admin, propertyId, {
      mealPlanCode,
      adults,
      children,
      extraBeds,
      nights,
    });

    const mealStayBtn = roundBtn(addons.mealPlanAmountBtn);
    const extraBedStayBtn = roundBtn(addons.extraBedAmountBtn);
    const mealPerNightBtn =
      nights > 0 ? roundBtn(mealStayBtn / nights) : mealStayBtn;
    const extraBedPerNightBtn =
      nights > 0 ? roundBtn(extraBedStayBtn / nights) : extraBedStayBtn;

    let systemStayTotalBtn: number | null = null;
    let systemNightlyTotalBtn: number | null = null;
    if (roomNightlyBtn != null) {
      const roomsStay = roundBtn(roomNightlyBtn * qtyRooms * nights);
      systemStayTotalBtn = roundBtn(
        roomsStay + mealStayBtn + extraBedStayBtn,
      );
      systemNightlyTotalBtn =
        nights > 0 && qtyRooms > 0
          ? roundBtn(systemStayTotalBtn / (nights * qtyRooms))
          : systemStayTotalBtn;
    }

    return {
      ok: true,
      nights,
      seasonKind: season,
      rateTier: tier,
      roomNightlyBtn,
      mealStayBtn,
      mealPerNightBtn,
      extraBedStayBtn,
      extraBedPerNightBtn,
      systemNightlyTotalBtn,
      systemStayTotalBtn,
      agreedNightlyBtn:
        booking.agreed_nightly_rate_btn != null
          ? Number(booking.agreed_nightly_rate_btn)
          : null,
      mealPlanCode: addons.mealPlanCode,
      hasRoomType: Boolean(roomTypeId),
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Could not preview rate.",
    };
  }
}
