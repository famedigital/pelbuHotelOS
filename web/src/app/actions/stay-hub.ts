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
import { buildLedgerStripSummary } from "@/lib/folio/ledger-summary";
import { thimphuToday } from "@/lib/erp-lists";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type StayHubCheckInPayload = {
  booking: CheckInBooking;
  guides: PartnerOption[];
  drivers: PartnerOption[];
  slots: Awaited<ReturnType<typeof loadCheckInRoomOptions>>["slots"];
  units: Awaited<ReturnType<typeof loadCheckInRoomOptions>>["units"];
};

export type StayHubMoneyLine = {
  id: string;
  source_type: string;
  description: string | null;
  total_btn: number;
  gst_btn: number | null;
  status: string | null;
  bill_to: string | null;
  /** YYYY-MM-DD for grid (business_date or created day). */
  date: string | null;
  created_at: string | null;
};

export type StayHubLedgerSummary = {
  rateBtn: number;
  extBtn: number;
  discountBtn: number;
  /** Absolute paid (payments + deposits as positive Nu collected). */
  paymentBtn: number;
  balanceBtn: number;
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
  /**
   * Folio lines including voided (ledger can filter). Posted-only balance math
   * uses status === posted.
   */
  lines: StayHubMoneyLine[];
  /** Rate / Ext / Discount / Payment / Balance for Manage Folio strip. */
  ledgerSummary: StayHubLedgerSummary;
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
  propertyId: string;
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
  roomHkStatus: string | null;
  roomTypeId: string | null;
  roomTypeName: string | null;
  /**
   * All sellable/comp lines on this stay (New booking multi-category).
   * Distinct from formal party sibling bookings.
   */
  roomLines: Array<{
    roomTypeId: string;
    roomTypeName: string;
    roomTypeCode: string | null;
    qty: number;
    inventoryKind: string;
    assignedLabels: string[];
  }>;
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
  /** True when any booking_rooms line awaits GM rate approval. */
  ratePendingApproval: boolean;
  mealPlanCode: string | null;
  /** Agent guide-settlement evidence (photo | waived | null). */
  guideSignStatus: string | null;
  guideSignPhotoPublicId: string | null;
  guideSignWaiveReason: string | null;
  /** Cloudinary public_id of signed guest reg card (post CI). */
  regCardPhotoPublicId: string | null;
  regCardSignedAt: string | null;
  /** FO rate tax mode at book (eZee-style). */
  rateTaxMode: "inclusive" | "exclusive";
  taxExemptGst: boolean;
  taxExemptService: boolean;
  taxExemptBst: boolean;
  /** Property room tax settings for night grid. */
  roomTax: {
    gstRate: number;
    serviceChargeRate: number;
    applyServiceCharge: boolean;
    inclusiveOfGstSc: boolean;
  };
  /** FO logistics / eZee Room Sharing lite. */
  houseUse: boolean;
  dnr: boolean;
  dnrReason: string | null;
  pickupNeeded: boolean;
  dropoffNeeded: boolean;
  pickupAt: string | null;
  dropoffAt: string | null;
  transportArrivalMode: string | null;
  transportDepartureMode: string | null;
  transportNotes: string | null;
  visaNo: string | null;
  visaExpiry: string | null;
  arrivedFrom: string | null;
  purposeOfVisit: string | null;
  /** Lifecycle stamps. */
  bookedAt: string | null;
  checkedInAt: string | null;
  checkedOutAt: string | null;
  releaseDaysBeforeArrival: number | null;
  releasePercent: number | null;
  depositDueOn: string | null;
  /** Recent stay audit lines (newest first). */
  auditTrail: { at: string; action: string; summary: string; actor: string }[];
  /** Next reservation on the same room (if assigned). */
  /** Open folio balances (BTN) for night grid / billing context. */
  nextRes: {
    bookingId: string;
    confirmationCode: string | null;
    contactName: string | null;
    checkIn: string;
    status: string;
  } | null;
  /** Named guests on stay (sharers / SDF people). */
  guests: Array<{
    id: string;
    fullName: string;
    passportOrCid: string | null;
    nationality: string | null;
    blacklisted: boolean;
  }>;
  /** Open desk requests (wake-up, message, follow-up). */
  openTasks: Array<{
    id: string;
    dueAt: string;
    kind: string;
    notes: string | null;
    doneAt: string | null;
  }>;
  confirmMode: string;
  advanceStatus: string;
  advanceDueBtn: number | null;
  /**
   * Open hotel business date (YYYY-MM-DD). Check-in is only offered when
   * booking.check_in <= this day (matches assertBusinessDateOpenForCheckIn).
   */
  openBusinessDate: string;
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

  const [bookingResult, roomNcList] = await Promise.all([
    admin
      .from("bookings")
      .select(
        `
      id, confirmation_code, contact_name, contact_phone, contact_email, status, check_in, check_out,
      adults, children, extra_beds, rooms, guide_number, guest_origin, source, notes, agent_id, payment_mode,
      booked_by_role, sold_by_staff_id, sales_claim_status, meal_plan_code,
      agreed_nightly_rate_btn, agreed_rate_reason,
      rate_tax_mode, tax_exempt_gst, tax_exempt_service, tax_exempt_bst,
      release_days_before_arrival, release_percent, deposit_due_on,
      house_use, dnr, dnr_reason, pickup_needed, dropoff_needed, pickup_at, dropoff_at,
      transport_arrival_mode, transport_departure_mode, transport_notes,
      visa_no, visa_expiry, arrived_from, purpose_of_visit,
      created_at, checked_in_at, checked_out_at,
      guide_sign_status, guide_sign_photo_public_id, guide_sign_waive_reason,
      reg_card_photo_public_id, reg_card_signed_at,
      confirm_mode, advance_status, advance_due_btn,
      agents(company_name, contact_email, status, market),
      sold_by_staff:staff_members!sold_by_staff_id(full_name),
      booking_guests(id, full_name, passport_or_cid, nationality, sdf_ref, blacklisted),
      booking_rooms(qty, inventory_kind, room_type_id, rate_request_status, room_types(id, name, code)),
      room_assignments(id, room_unit_id, is_locked, from_date, to_date,
        chargeable, nc_reason_code,
        room_units(id, label, room_type_id, hk_status, room_types(id, name))),
      folios(id, status, folio_lines(total_btn, status, source_type))
    `,
      )
      .eq("id", bookingId)
      .eq("property_id", propertyId)
      .maybeSingle(),
    listNcReasonCodes(admin, propertyId, "room"),
  ]);

  const { data, error } = bookingResult;
  if (error) return { ok: false, error: error.message };
  if (!data) return { ok: false, error: "Booking not found" };

  const roomNcReasons = roomNcList.map((r) => ({
    code: r.code,
    label: r.label,
  }));

  const agentRaw = data.agents as
    | { company_name?: string; status?: string; market?: string }
    | { company_name?: string; status?: string; market?: string }[]
    | null;
  const agent = Array.isArray(agentRaw) ? agentRaw[0] : agentRaw;

  const guests =
    (data.booking_guests as
      | Array<{
          id?: string;
          full_name?: string | null;
          passport_or_cid?: string | null;
          nationality?: string | null;
          sdf_ref?: string | null;
          blacklisted?: boolean;
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
                hk_status?: string;
                room_types?:
                  | { id?: string; name?: string }
                  | { id?: string; name?: string }[]
                  | null;
              }
            | {
                id?: string;
                label?: string;
                room_type_id?: string;
                hk_status?: string;
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

  const [{ data: policy }, { data: propertyRow }, roomTax] = await Promise.all([
    admin
      .from("property_policies")
      .select("early_checkout_fee_btn, late_checkout_fee_btn")
      .eq("property_id", propertyId)
      .maybeSingle(),
    admin
      .from("properties")
      .select("current_business_date")
      .eq("id", propertyId)
      .maybeSingle(),
    loadRoomRateTaxSettings(admin, propertyId),
  ]);

  const openBusinessDate =
    (propertyRow?.current_business_date as string | null)?.slice(0, 10) ||
    thimphuToday();

  const roomUnitId = preferred?.room_unit_id ?? unit?.id ?? null;
  const checkOutIso = (data.check_out as string).slice(0, 10);

  const [{ data: auditRows }, nextRes, { data: taskRows }] = await Promise.all([
    admin
      .from("audit_events")
      .select("created_at, action, summary, actor")
      .eq("property_id", propertyId)
      .eq("entity_type", "booking")
      .eq("entity_id", bookingId)
      .order("created_at", { ascending: false })
      .limit(8),
    roomUnitId
      ? (async () => {
          const { data: nextAssign } = await admin
            .from("room_assignments")
            .select(
              `from_date, booking_id,
               bookings!inner(id, confirmation_code, contact_name, check_in, status, property_id)`,
            )
            .eq("room_unit_id", roomUnitId)
            .gte("from_date", checkOutIso)
            .neq("booking_id", bookingId)
            .order("from_date", { ascending: true })
            .limit(6);
          for (const row of nextAssign ?? []) {
            const bRaw = row.bookings as
              | {
                  id?: string;
                  confirmation_code?: string | null;
                  contact_name?: string | null;
                  check_in?: string;
                  status?: string;
                  property_id?: string;
                }
              | {
                  id?: string;
                  confirmation_code?: string | null;
                  contact_name?: string | null;
                  check_in?: string;
                  status?: string;
                  property_id?: string;
                }[]
              | null;
            const b = Array.isArray(bRaw) ? bRaw[0] : bRaw;
            if (!b?.id || b.property_id !== propertyId) continue;
            if (
              ["cancelled", "no_show", "expired"].includes(
                (b.status ?? "").toLowerCase(),
              )
            ) {
              continue;
            }
            return {
              bookingId: b.id,
              confirmationCode: b.confirmation_code ?? null,
              contactName: b.contact_name ?? null,
              checkIn: (b.check_in ?? "").slice(0, 10),
              status: b.status ?? "",
            };
          }
          return null;
        })()
      : Promise.resolve(null),
    admin
      .from("inhouse_tasks")
      .select("id, due_at, kind, notes, done_at")
      .eq("property_id", propertyId)
      .eq("booking_id", bookingId)
      .order("due_at", { ascending: true })
      .limit(20),
  ]);

  const labelsByTypeId = new Map<string, string[]>();
  for (const a of assigns) {
    const u = Array.isArray(a.room_units) ? a.room_units[0] : a.room_units;
    const typeId = u?.room_type_id;
    const label = u?.label?.trim();
    if (!typeId || !label) continue;
    const list = labelsByTypeId.get(typeId) ?? [];
    list.push(label);
    labelsByTypeId.set(typeId, list);
  }

  const roomLines = (
    (data.booking_rooms as
      | Array<{
          qty?: number;
          inventory_kind?: string;
          room_type_id?: string;
          rate_request_status?: string | null;
          room_types?:
            | { id?: string; name?: string; code?: string }
            | { id?: string; name?: string; code?: string }[]
            | null;
        }>
      | null) ?? []
  ).map((r) => {
    const rtRow = Array.isArray(r.room_types) ? r.room_types[0] : r.room_types;
    const typeId = (r.room_type_id as string) || (rtRow?.id as string) || "";
    return {
      roomTypeId: typeId,
      roomTypeName: (rtRow?.name as string) || "Room",
      roomTypeCode: (rtRow?.code as string | null) ?? null,
      qty: Number(r.qty ?? 1),
      inventoryKind: (r.inventory_kind as string) || "sellable_guest",
      assignedLabels: typeId ? (labelsByTypeId.get(typeId) ?? []) : [],
    };
  });

  const ratePendingApproval = (
    (data.booking_rooms as Array<{ rate_request_status?: string | null }> | null) ??
    []
  ).some((r) => (r.rate_request_status as string) === "pending");

  return {
    ok: true,
    data: {
      bookingId: data.id as string,
      propertyId,
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
      roomUnitId,
      roomLabel: unit?.label ?? null,
      roomHkStatus: (unit?.hk_status as string | null) ?? null,
      roomTypeId: unit?.room_type_id ?? rt?.id ?? null,
      roomTypeName: rt?.name ?? null,
      roomLines,
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
      ratePendingApproval,
      mealPlanCode: (data.meal_plan_code as string | null) ?? null,
      guideSignStatus: (data.guide_sign_status as string | null) ?? null,
      guideSignPhotoPublicId:
        (data.guide_sign_photo_public_id as string | null) ?? null,
      guideSignWaiveReason:
        (data.guide_sign_waive_reason as string | null) ?? null,
      regCardPhotoPublicId:
        (data.reg_card_photo_public_id as string | null) ?? null,
      regCardSignedAt: (data.reg_card_signed_at as string | null) ?? null,
      rateTaxMode:
        data.rate_tax_mode === "inclusive" ? "inclusive" : "exclusive",
      taxExemptGst: Boolean(data.tax_exempt_gst),
      taxExemptService: Boolean(data.tax_exempt_service),
      taxExemptBst: Boolean(data.tax_exempt_bst),
      roomTax,
      houseUse: Boolean(data.house_use),
      dnr: Boolean(data.dnr),
      dnrReason: (data.dnr_reason as string | null) ?? null,
      pickupNeeded: Boolean(data.pickup_needed),
      dropoffNeeded: Boolean(data.dropoff_needed),
      pickupAt: (data.pickup_at as string | null) ?? null,
      dropoffAt: (data.dropoff_at as string | null) ?? null,
      transportArrivalMode:
        (data.transport_arrival_mode as string | null) ?? null,
      transportDepartureMode:
        (data.transport_departure_mode as string | null) ?? null,
      transportNotes: (data.transport_notes as string | null) ?? null,
      visaNo: (data.visa_no as string | null) ?? null,
      visaExpiry: (data.visa_expiry as string | null)
        ? String(data.visa_expiry).slice(0, 10)
        : null,
      arrivedFrom: (data.arrived_from as string | null) ?? null,
      purposeOfVisit: (data.purpose_of_visit as string | null) ?? null,
      bookedAt: (data.created_at as string | null) ?? null,
      checkedInAt: (data.checked_in_at as string | null) ?? null,
      checkedOutAt: (data.checked_out_at as string | null) ?? null,
      releaseDaysBeforeArrival:
        data.release_days_before_arrival == null
          ? null
          : Number(data.release_days_before_arrival),
      releasePercent:
        data.release_percent == null ? null : Number(data.release_percent),
      depositDueOn: (data.deposit_due_on as string | null)
        ? String(data.deposit_due_on).slice(0, 10)
        : null,
      auditTrail: (auditRows ?? []).map((r) => ({
        at: (r.created_at as string) ?? "",
        action: (r.action as string) ?? "",
        summary: (r.summary as string) ?? "",
        actor: (r.actor as string) ?? "desk",
      })),
      nextRes,
      guests: guests.map((g) => ({
        id: (g.id as string) ?? "",
        fullName: (g.full_name as string) || "Guest",
        passportOrCid: (g.passport_or_cid as string | null) ?? null,
        nationality: (g.nationality as string | null) ?? null,
        blacklisted: Boolean(g.blacklisted),
      })),
      openTasks: (taskRows ?? []).map((t) => ({
        id: t.id as string,
        dueAt: (t.due_at as string) ?? "",
        kind: (t.kind as string) ?? "other",
        notes: (t.notes as string | null) ?? null,
        doneAt: (t.done_at as string | null) ?? null,
      })),
      confirmMode: (data.confirm_mode as string | null) ?? "soft",
      advanceStatus: (data.advance_status as string | null) ?? "none",
      advanceDueBtn:
        data.advance_due_btn != null ? Number(data.advance_due_btn) : null,
      openBusinessDate,
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
        folio_lines(id, total_btn, gst_btn, status, source_type, description, bill_to, business_date, created_at),
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
            gst_btn?: number | null;
            status?: string;
            source_type?: string;
            description?: string | null;
            bill_to?: string | null;
            business_date?: string | null;
            created_at?: string | null;
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
    gst_btn?: number | null;
    status?: string;
    source_type?: string;
    description?: string | null;
    bill_to?: string | null;
    business_date?: string | null;
    created_at?: string | null;
  }>;
  /** Include voided for ledger “Show voided”; balance uses posted only. */
  const allLines = rawLines.filter((l) => l.id);
  const postedLines = allLines.filter((l) => (l.status ?? "posted") === "posted");
  const balance = postedLines.reduce((s, l) => s + Number(l.total_btn ?? 0), 0);
  const guestVisibleBalanceBtn = postedLines.reduce((s, l) => {
    const st = (l.source_type ?? "").toLowerCase();
    if (st === "payment" || st === "deposit") {
      return s + Number(l.total_btn ?? 0);
    }
    if ((l.bill_to ?? "guest") === "agent") return s;
    return s + Number(l.total_btn ?? 0);
  }, 0);
  const agentChargesBtn = postedLines.reduce((s, l) => {
    if ((l.bill_to ?? "guest") !== "agent") return s;
    const st = (l.source_type ?? "").toLowerCase();
    if (st === "payment" || st === "deposit") return s;
    return s + Number(l.total_btn ?? 0);
  }, 0);
  const hasCharges = postedLines.some(
    (l) => (l.source_type ?? "") !== "payment" && Number(l.total_btn ?? 0) > 0,
  );
  const chargesOnly = postedLines.some(
    (l) =>
      !["payment", "deposit"].includes(l.source_type ?? "") &&
      Number(l.total_btn ?? 0) !== 0,
  );

  const mappedLines = allLines.map((l) => {
    const biz = l.business_date
      ? String(l.business_date).slice(0, 10)
      : null;
    const created = l.created_at ? String(l.created_at) : null;
    return {
      id: l.id as string,
      source_type: l.source_type ?? "other",
      description: l.description ?? null,
      total_btn: Number(l.total_btn ?? 0),
      gst_btn:
        l.gst_btn == null ? null : Number(l.gst_btn),
      status: l.status ?? "posted",
      bill_to: l.bill_to ?? null,
      date: biz || (created ? created.slice(0, 10) : null),
      created_at: created,
    };
  });
  const ledgerSummary = buildLedgerStripSummary(mappedLines);

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
      lines: mappedLines.sort((a, b) => {
        const da = a.date ?? a.created_at ?? "";
        const db = b.date ?? b.created_at ?? "";
        return db.localeCompare(da);
      }),
      ledgerSummary,
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
    propertyId: string;
    agents: StayHubCatalogAgent[];
    staff: StayHubCatalogStaff[];
    mealPlans: StayHubCatalogMealPlan[];
    registration: {
      design: import("@/lib/property-settings").PropertyRegistrationDesign;
      property: {
        name: string;
        legal_name: string | null;
        address: string | null;
        phone: string | null;
        email: string | null;
        tax_id: string | null;
        logo_public_id: string | null;
        check_in_time: string | null;
        check_out_time: string | null;
      };
    };
  }>
> {
  if (!(await isDeskAuthenticated())) {
    return { ok: false, error: "Not signed in" };
  }
  const admin = createSupabaseAdminClient();
  const propertyId = await requireDeskPropertyId();

  const [
    { data: agents },
    { data: staff },
    { data: mealRows },
    { data: propRow },
    { data: policyRow },
  ] = await Promise.all([
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
    admin
      .from("properties")
      .select(
        "name, legal_name, address, phone, email, tax_id, logo_public_id, doc_registration",
      )
      .eq("id", propertyId)
      .maybeSingle(),
    admin
      .from("property_policies")
      .select("check_in_time, check_out_time")
      .eq("property_id", propertyId)
      .maybeSingle(),
  ]);

  const { mapRegistrationDesign } = await import("@/lib/property-settings");

  return {
    ok: true,
    data: {
      propertyId,
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
      registration: {
        design: mapRegistrationDesign(propRow?.doc_registration),
        property: {
          name: (propRow?.name as string) || "Pelbu Suites",
          legal_name: (propRow?.legal_name as string | null) ?? null,
          address: (propRow?.address as string | null) ?? null,
          phone: (propRow?.phone as string | null) ?? null,
          email: (propRow?.email as string | null) ?? null,
          tax_id: (propRow?.tax_id as string | null) ?? null,
          logo_public_id: (propRow?.logo_public_id as string | null) ?? null,
          check_in_time:
            (policyRow?.check_in_time as string | null) ?? "14:00",
          check_out_time:
            (policyRow?.check_out_time as string | null) ?? "12:00",
        },
      },
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
        occupancy: adults === 1 ? "single" : "double",
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

export type StayHubFoExtrasInput = {
  bookingId: string;
  houseUse: boolean;
  dnr: boolean;
  dnrReason?: string | null;
  pickupNeeded: boolean;
  dropoffNeeded: boolean;
  pickupAt?: string | null;
  dropoffAt?: string | null;
  transportArrivalMode?: string | null;
  transportDepartureMode?: string | null;
  transportNotes?: string | null;
  visaNo?: string | null;
  visaExpiry?: string | null;
  arrivedFrom?: string | null;
  purposeOfVisit?: string | null;
};

function optionalLocalDateTime(raw: string | null | undefined): string | null {
  if (raw == null) return null;
  const t = raw.trim();
  if (!t) return null;
  // datetime-local → treat as Asia/Thimphu wall time if no zone
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(t) && !/[zZ]|[+-]\d{2}:?\d{2}$/.test(t)) {
    return `${t.length === 16 ? `${t}:00` : t}+06:00`;
  }
  const d = new Date(t);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

/** Save FO logistics, visa lite, house-use / DNR (eZee Edit Transaction lite). */
export async function updateStayHubFoExtras(
  input: StayHubFoExtrasInput,
): Promise<Result<null>> {
  if (!(await isDeskAuthenticated())) {
    return { ok: false, error: "Not signed in" };
  }
  const admin = createSupabaseAdminClient();
  const propertyId = await requireDeskPropertyId();
  const bookingId = input.bookingId?.trim();
  if (!bookingId) return { ok: false, error: "Missing booking." };

  const dnrReason =
    input.dnr && input.dnrReason?.trim()
      ? input.dnrReason.trim().slice(0, 240)
      : null;

  const { error } = await admin
    .from("bookings")
    .update({
      house_use: Boolean(input.houseUse),
      dnr: Boolean(input.dnr),
      dnr_reason: dnrReason,
      pickup_needed: Boolean(input.pickupNeeded),
      dropoff_needed: Boolean(input.dropoffNeeded),
      pickup_at: optionalLocalDateTime(input.pickupAt ?? null),
      dropoff_at: optionalLocalDateTime(input.dropoffAt ?? null),
      transport_arrival_mode:
        input.transportArrivalMode?.trim().slice(0, 80) || null,
      transport_departure_mode:
        input.transportDepartureMode?.trim().slice(0, 80) || null,
      transport_notes: input.transportNotes?.trim().slice(0, 500) || null,
      visa_no: input.visaNo?.trim().slice(0, 80) || null,
      visa_expiry: input.visaExpiry?.trim().slice(0, 10) || null,
      arrived_from: input.arrivedFrom?.trim().slice(0, 120) || null,
      purpose_of_visit: input.purposeOfVisit?.trim().slice(0, 120) || null,
    })
    .eq("id", bookingId)
    .eq("property_id", propertyId);

  if (error) return { ok: false, error: error.message };

  const { writeAuditEvent } = await import("@/lib/audit");
  await writeAuditEvent(admin, {
    propertyId,
    action: "booking.fo_extras",
    entityType: "booking",
    entityId: bookingId,
    summary: "Updated FO logistics / flags",
    meta: {
      house_use: input.houseUse,
      dnr: input.dnr,
      pickup: input.pickupNeeded,
      dropoff: input.dropoffNeeded,
    },
  });

  return { ok: true, data: null };
}

export type StayHubPartyMember = {
  bookingId: string;
  confirmationCode: string | null;
  contactName: string | null;
  status: string;
  roomLabel: string | null;
  assignmentId: string | null;
};

export type StayHubPartyContext = {
  bookingId: string;
  groupId: string | null;
  groupName: string | null;
  /** Soft party (same agent/dates) not yet linked as booking_groups. */
  suggested: boolean;
  members: StayHubPartyMember[];
};

/**
 * Formal group siblings, or soft-suggested multi-room peers (agent + dates).
 * StayHub stays single-booking for money; this powers the room switcher strip.
 */
export async function fetchStayHubPartyContext(
  bookingId: string,
): Promise<Result<StayHubPartyContext>> {
  try {
    if (!(await isDeskAuthenticated())) {
      return { ok: false, error: "Not signed in" };
    }
    const admin = createSupabaseAdminClient();
    const propertyId = await requireDeskPropertyId();
    const id = bookingId.trim();
    if (!id) return { ok: false, error: "Booking required." };

    const { data: anchor, error: anchorErr } = await admin
      .from("bookings")
      .select(
        `id, confirmation_code, contact_name, contact_phone, check_in, check_out, status, rooms, agent_id,
         agents(company_name),
         room_assignments(id, room_units(label))`,
      )
      .eq("id", id)
      .eq("property_id", propertyId)
      .maybeSingle();
    if (anchorErr) return { ok: false, error: anchorErr.message };
    if (!anchor) return { ok: false, error: "Booking not found." };

    const { data: membership } = await admin
      .from("booking_group_members")
      .select("group_id, booking_groups(id, name, property_id)")
      .eq("booking_id", id)
      .maybeSingle();

    let partyIds = [id];
    let groupId: string | null = null;
    let groupName: string | null = null;
    let suggested = false;

    if (membership?.group_id) {
      const gRaw = membership.booking_groups as
        | { id?: string; name?: string; property_id?: string }
        | { id?: string; name?: string; property_id?: string }[]
        | null;
      const g = Array.isArray(gRaw) ? gRaw[0] : gRaw;
      if (g?.id && g.property_id === propertyId) {
        groupId = g.id;
        groupName = g.name ?? null;
        const { data: siblings } = await admin
          .from("booking_group_members")
          .select("booking_id")
          .eq("group_id", groupId);
        partyIds = [
          ...new Set(
            (siblings ?? [])
              .map((s) => s.booking_id as string)
              .filter(Boolean),
          ),
        ];
        if (!partyIds.includes(id)) partyIds.push(id);
      }
    }

    // Soft party: same agent+dates, or same contact phone/name + dates (board parity).
    if (!groupId) {
      const agentId = (anchor.agent_id as string | null) ?? null;
      const checkIn = (anchor.check_in as string).slice(0, 10);
      const checkOut = (anchor.check_out as string).slice(0, 10);
      const phone = String(anchor.contact_phone ?? "")
        .replace(/\D/g, "")
        .slice(-10);
      const contactName = String(anchor.contact_name ?? "")
        .trim()
        .toLowerCase();

      let peerIds: string[] = [];
      if (agentId && checkIn) {
        const { data: peers } = await admin
          .from("bookings")
          .select("id")
          .eq("property_id", propertyId)
          .eq("agent_id", agentId)
          .eq("check_in", checkIn)
          .eq("check_out", checkOut)
          .not("status", "in", '("cancelled","no_show","expired")')
          .limit(40);
        peerIds = (peers ?? []).map((p) => p.id as string);
      } else if (checkIn && (phone.length >= 8 || contactName.length >= 4)) {
        const { data: peers } = await admin
          .from("bookings")
          .select("id, contact_phone, contact_name")
          .eq("property_id", propertyId)
          .eq("check_in", checkIn)
          .eq("check_out", checkOut)
          .is("agent_id", null)
          .not("status", "in", '("cancelled","no_show","expired")')
          .limit(60);
        peerIds = (peers ?? [])
          .filter((p) => {
            if (phone.length >= 8) {
              const pp = String(p.contact_phone ?? "")
                .replace(/\D/g, "")
                .slice(-10);
              return pp === phone;
            }
            return (
              String(p.contact_name ?? "")
                .trim()
                .toLowerCase() === contactName
            );
          })
          .map((p) => p.id as string);
      }

      if (peerIds.length >= 2) {
        const { data: alreadyGrouped } = await admin
          .from("booking_group_members")
          .select("booking_id")
          .in("booking_id", peerIds);
        const grouped = new Set(
          (alreadyGrouped ?? []).map((r) => r.booking_id as string),
        );
        const ungrouped = peerIds.filter((pid) => !grouped.has(pid));
        if (ungrouped.length >= 2 && ungrouped.includes(id)) {
          partyIds = ungrouped;
          suggested = true;
        }
      }
    }

    const { data: bookings, error: bookErr } = await admin
      .from("bookings")
      .select(
        `id, confirmation_code, contact_name, status,
         room_assignments(id, room_units(label))`,
      )
      .eq("property_id", propertyId)
      .in("id", partyIds)
      .order("confirmation_code", { ascending: true });
    if (bookErr) return { ok: false, error: bookErr.message };

    const members: StayHubPartyMember[] = (bookings ?? []).map((b) => {
      const assigns =
        (b.room_assignments as
          | Array<{
              id?: string;
              room_units?:
                | { label?: string }
                | { label?: string }[]
                | null;
            }>
          | null) ?? [];
      const first = assigns[0];
      const ru = first?.room_units;
      const unit = Array.isArray(ru) ? ru[0] : ru;
      return {
        bookingId: b.id as string,
        confirmationCode: (b.confirmation_code as string | null) ?? null,
        contactName: (b.contact_name as string | null) ?? null,
        status: (b.status as string) ?? "pending",
        roomLabel: unit?.label?.trim() || null,
        assignmentId: (first?.id as string | null) ?? null,
      };
    });

    // Prefer room label sort when assigned
    members.sort((a, b) => {
      const la = a.roomLabel ?? a.confirmationCode ?? a.bookingId;
      const lb = b.roomLabel ?? b.confirmationCode ?? b.bookingId;
      return la.localeCompare(lb, undefined, { numeric: true });
    });

    return {
      ok: true,
      data: {
        bookingId: id,
        groupId,
        groupName,
        suggested,
        members:
          members.length > 0
            ? members
            : [
                {
                  bookingId: id,
                  confirmationCode:
                    (anchor.confirmation_code as string | null) ?? null,
                  contactName: (anchor.contact_name as string | null) ?? null,
                  status: (anchor.status as string) ?? "pending",
                  roomLabel: null,
                  assignmentId: null,
                },
              ],
      },
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Could not load party.",
    };
  }
}

/**
 * One round-trip to open Edit Transaction: summary + party + check-in
 * (+ catalog when the desk tab has not cached it yet).
 */
export async function fetchStayHubOpen(
  bookingId: string,
  preferredAssignmentId?: string | null,
  opts?: { catalog?: boolean },
): Promise<
  Result<{
    summary: StayHubSummary;
    party: StayHubPartyContext | null;
    checkIn: StayHubCheckInPayload | null;
    catalog: Extract<
      Awaited<ReturnType<typeof fetchStayHubCatalog>>,
      { ok: true }
    >["data"] | null;
  }>
> {
  const [summaryRes, partyRes, checkInRes, catalogRes] = await Promise.all([
    fetchStayHubSummary(bookingId, preferredAssignmentId),
    fetchStayHubPartyContext(bookingId),
    fetchStayHubCheckIn(bookingId),
    opts?.catalog
      ? fetchStayHubCatalog()
      : Promise.resolve(null as Awaited<ReturnType<typeof fetchStayHubCatalog>> | null),
  ]);
  if (!summaryRes.ok) return summaryRes;
  return {
    ok: true,
    data: {
      summary: summaryRes.data,
      party: partyRes.ok ? partyRes.data : null,
      checkIn: checkInRes.ok ? checkInRes.data : null,
      catalog:
        catalogRes && catalogRes.ok ? catalogRes.data : null,
    },
  };
}
