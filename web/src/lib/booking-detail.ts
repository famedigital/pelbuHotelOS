import "server-only";

import { assertDeskProperty } from "@/lib/desk/property-guard";
import { resolveCancelPolicyContext } from "@/lib/policies/cancel-policy";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type Admin = ReturnType<typeof createSupabaseAdminClient>;

type MaybeList<T> = T | T[] | null;

export type BookingDetailGuest = {
  full_name: string | null;
  nationality: string | null;
  passport_or_cid: string | null;
};

export type BookingDetailRoomLine = {
  qty: number;
  inventory_kind: string | null;
  name: string;
  code: string | null;
};

export type BookingDetailPayment = {
  id: string;
  amount_btn: number;
  method: string | null;
  kind: string | null;
  reference: string | null;
  created_at: string | null;
};

/** Serializable booking detail for desk accordion, calendar modal, and dossier. */
export type BookingDetailData = {
  id: string;
  status: string;
  contact_name: string | null;
  contact_phone: string | null;
  contact_email: string | null;
  check_in: string;
  check_out: string;
  source: string | null;
  channel_source: string | null;
  guest_origin: string | null;
  guide_number: string | null;
  payment_mode: string | null;
  adults: number;
  rooms: number;
  notes: string | null;
  created_at: string | null;
  cancelled_at: string | null;
  cancel_reason: string | null;
  hold_expires_at: string | null;
  hold_extended_count: number;
  token_required_btn: number;
  token_received_btn: number;
  quoted_total_btn: number | null;
  meal_plan_code: string | null;
  meal_plan_amount_btn: number | null;
  children: number;
  extra_beds: number;
  extra_bed_amount_btn: number | null;
  agent_id: string | null;
  agent_name: string | null;
  is_mou_agent: boolean;
  cancel_policy_summary: string;
  room_labels: string[];
  open_folio_id: string | null;
  folio_balance_btn: number;
  /** Non-payment posted charge lines exist */
  folio_has_charges: boolean;
  guests: BookingDetailGuest[];
  room_lines: BookingDetailRoomLine[];
  payments: BookingDetailPayment[];
};

const BOOKING_SELECT = `
  id, property_id, contact_name, contact_phone, contact_email, check_in, check_out, status,
  source, channel_source, guest_origin, guide_number, payment_mode, adults, children, rooms,
  extra_beds, notes, created_at, cancelled_at, cancel_reason, hold_expires_at, hold_extended_count,
  token_required_btn, token_received_btn, quoted_total_btn, meal_plan_code, meal_plan_amount_btn,
  extra_bed_amount_btn, booked_by_role, agent_id,
  agents(company_name, wants_mou),
  booking_rooms(qty, inventory_kind, room_types(name, code)),
  booking_guests(full_name, nationality, passport_or_cid, sort_order),
  room_assignments(room_units(label)),
  folios(id, status, folio_lines(total_btn, status, source_type, reverses_line_id)),
  payments(id, amount_btn, method, kind, reference, created_at)
`;

function firstOf<T>(value: MaybeList<T>): T | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

export async function loadBookingDetail(
  admin: Admin,
  propertyId: string,
  bookingId: string,
): Promise<BookingDetailData | null> {
  const { data, error } = await admin
    .from("bookings")
    .select(BOOKING_SELECT)
    .eq("id", bookingId)
    .maybeSingle();

  if (error) throw new Error(`Could not load booking: ${error.message}`);
  if (!data) return null;

  try {
    assertDeskProperty(propertyId, data.property_id as string, "Booking");
  } catch {
    return null;
  }

  const agentRow = firstOf(
    data.agents as MaybeList<{ company_name?: string; wants_mou?: boolean }>,
  );

  const cancelCtx = await resolveCancelPolicyContext(admin, {
    propertyId,
    checkIn: data.check_in as string,
    bookedByRole: data.booked_by_role as string | null,
    agentId: data.agent_id as string | null,
  });

  const isMouAgent = cancelCtx.isMouAgent || Boolean(agentRow?.wants_mou);

  const guests = (
    (data.booking_guests as Array<{
      full_name?: string | null;
      nationality?: string | null;
      passport_or_cid?: string | null;
      sort_order?: number | null;
    }> | null) ?? []
  )
    .slice()
    .sort((a, b) => Number(a.sort_order ?? 0) - Number(b.sort_order ?? 0))
    .map((g) => ({
      full_name: g.full_name ?? null,
      nationality: g.nationality ?? null,
      passport_or_cid: g.passport_or_cid ?? null,
    }));

  const roomLabels = (
    (data.room_assignments as Array<{
      room_units: MaybeList<{ label?: string }>;
    }> | null) ?? []
  )
    .map((row) => firstOf(row.room_units)?.label)
    .filter((label): label is string => Boolean(label));

  const folios =
    (data.folios as Array<{
      id: string;
      status?: string;
      folio_lines?: Array<{
        total_btn?: number;
        status?: string;
        source_type?: string;
        reverses_line_id?: string | null;
      }> | null;
    }> | null) ?? [];
  const openFolio = folios.find((f) => f.status === "open") ?? folios[0];
  const openLines = openFolio?.folio_lines ?? [];
  const folioBalance = openLines
    .filter((l) => l.status === "posted")
    .reduce((sum, l) => sum + Number(l.total_btn ?? 0), 0);
  const folioHasCharges = openLines.some(
    (l) =>
      l.status === "posted" &&
      l.source_type !== "payment" &&
      l.source_type !== "deposit" &&
      l.source_type !== "comp",
  );

  const payments = ((data.payments as BookingDetailPayment[] | null) ?? [])
    .slice()
    .sort((a, b) =>
      String(b.created_at ?? "").localeCompare(String(a.created_at ?? "")),
    )
    .map((p) => ({
      id: p.id,
      amount_btn: Number(p.amount_btn ?? 0),
      method: p.method ?? null,
      kind: p.kind ?? null,
      reference: p.reference ?? null,
      created_at: p.created_at ?? null,
    }));

  const roomLines = (
    (data.booking_rooms as Array<{
      qty: number;
      inventory_kind?: string | null;
      room_types: MaybeList<{ name?: string; code?: string }>;
    }> | null) ?? []
  ).map((line) => {
    const rt = firstOf(line.room_types);
    return {
      qty: Number(line.qty),
      inventory_kind: line.inventory_kind ?? null,
      name: rt?.name ?? rt?.code ?? "Room",
      code: rt?.code ?? null,
    };
  });

  return {
    id: data.id as string,
    status: (data.status as string) ?? "unknown",
    contact_name: (data.contact_name as string) ?? null,
    contact_phone: (data.contact_phone as string) ?? null,
    contact_email: (data.contact_email as string) ?? null,
    check_in: data.check_in as string,
    check_out: data.check_out as string,
    source: (data.source as string) ?? null,
    channel_source: (data.channel_source as string) ?? null,
    guest_origin: (data.guest_origin as string) ?? null,
    guide_number: (data.guide_number as string) ?? null,
    payment_mode: (data.payment_mode as string) ?? null,
    adults: Number(data.adults ?? 0),
    rooms: Number(data.rooms ?? 0),
    notes: (data.notes as string) ?? null,
    created_at: (data.created_at as string) ?? null,
    cancelled_at: (data.cancelled_at as string) ?? null,
    cancel_reason: (data.cancel_reason as string) ?? null,
    hold_expires_at: (data.hold_expires_at as string) ?? null,
    hold_extended_count: Number(data.hold_extended_count ?? 0),
    token_required_btn: Number(data.token_required_btn ?? 0),
    token_received_btn: Number(data.token_received_btn ?? 0),
    quoted_total_btn:
      data.quoted_total_btn != null ? Number(data.quoted_total_btn) : null,
    meal_plan_code: (data.meal_plan_code as string) ?? null,
    meal_plan_amount_btn:
      data.meal_plan_amount_btn != null
        ? Number(data.meal_plan_amount_btn)
        : null,
    children: Number(data.children ?? 0),
    extra_beds: Number(data.extra_beds ?? 0),
    extra_bed_amount_btn:
      data.extra_bed_amount_btn != null
        ? Number(data.extra_bed_amount_btn)
        : null,
    agent_id: (data.agent_id as string | null) ?? null,
    agent_name: agentRow?.company_name ?? null,
    is_mou_agent: isMouAgent,
    cancel_policy_summary: cancelCtx.summary,
    room_labels: roomLabels,
    open_folio_id: openFolio?.id ?? null,
    folio_balance_btn: folioBalance,
    folio_has_charges: folioHasCharges,
    guests,
    room_lines: roomLines,
    payments,
  };
}
