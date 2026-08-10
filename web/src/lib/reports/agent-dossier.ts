import { netFolioBalance } from "@/lib/folio/balance";
import {
  addToAging,
  daysBetweenIso,
  emptyAging,
  type AgingAmounts,
} from "@/lib/reports/ar-aging";
import type { SupabaseClient } from "@supabase/supabase-js";

export type AgentDossierTab =
  | "overview"
  | "bookings"
  | "guests"
  | "rooms"
  | "money"
  | "rates";

export const AGENT_DOSSIER_TABS: { id: AgentDossierTab; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "bookings", label: "Bookings" },
  { id: "guests", label: "Guests" },
  { id: "rooms", label: "Rooms" },
  { id: "money", label: "Money" },
  { id: "rates", label: "Rates" },
];

export function parseAgentDossierTab(raw: string | undefined): AgentDossierTab {
  const allowed = new Set(AGENT_DOSSIER_TABS.map((t) => t.id));
  if (raw && allowed.has(raw as AgentDossierTab)) return raw as AgentDossierTab;
  return "overview";
}

export type AgentDossierAgent = {
  id: string;
  company_name: string;
  market: string;
  contact_name: string | null;
  contact_phone: string | null;
  contact_email: string | null;
  status: string;
  rate_tier: string;
  credit_limit: number;
  credit_used: number;
  open_room_cap: number;
};

export type AgentDossierPack = {
  id: string;
  bookingId: string;
  guestName: string | null;
  sealedAt: string;
  emailSentAt: string | null;
  emailTo: string | null;
  guideSignStatus: string | null;
};

export type AgentDossierBooking = {
  id: string;
  contact_name: string | null;
  contact_phone: string | null;
  check_in: string;
  check_out: string;
  status: string;
  rooms: number;
  quoted_total_btn: number | null;
  folio_id: string | null;
  folio_label: string | null;
  nights: number;
};

export type AgentDossierGuest = {
  key: string;
  contact_name: string;
  contact_phone: string | null;
  stays: number;
  last_check_in: string;
};

export type AgentDossierRoomLine = {
  room_type_name: string;
  room_type_code: string;
  inventory_kind: string;
  qty: number;
  room_nights: number;
};

export type AgentDossierPayment = {
  id: string;
  amount_btn: number;
  method: string;
  kind: string | null;
  created_at: string;
  booking_id: string | null;
  reference: string | null;
};

export type AgentDossierLedger = {
  id: string;
  entry_type: string;
  amount_btn: number;
  balance_after_btn: number | null;
  note: string | null;
  created_at: string;
};

export type AgentDossierRate = {
  season_kind: string;
  rate_tier: string;
  amount_btn: number;
  room_type_name: string;
};

export type AgentDossierAllotment = {
  id: string;
  room_type_name: string;
  rooms_per_week: number;
  valid_from: string;
  valid_to: string;
};

export type AgentPaymentHabit = {
  paymentCount: number;
  creditSharePct: number;
  cashLikeSharePct: number;
  avgDaysToPay: number | null;
  blurb: string;
};

export type AgentDossierMoney = {
  folioTotal: number;
  paid: number;
  outstanding: number;
  aging: AgingAmounts;
  payments: AgentDossierPayment[];
  ledger: AgentDossierLedger[];
  habit: AgentPaymentHabit;
  openRoomsInHouse: number;
  packs: AgentDossierPack[];
};

export type AgentDossier = {
  agent: AgentDossierAgent;
  from: string;
  to: string;
  today: string;
  bookings: AgentDossierBooking[];
  bookingsInRange: AgentDossierBooking[];
  guests: AgentDossierGuest[];
  rooms: AgentDossierRoomLine[];
  money: AgentDossierMoney;
  rates: AgentDossierRate[];
  allotments: AgentDossierAllotment[];
  summary: {
    bookingCount: number;
    roomNights: number;
    quotedTotal: number;
  };
};

type FolioLine = {
  id: string;
  total_btn: number;
  status: string;
  reverses_line_id?: string | null;
};

type FolioJoin = {
  id: string;
  label: string;
  status: string;
  created_at: string;
  folio_lines?: FolioLine[] | null;
};

function monthStartIso(today: string): string {
  return `${today.slice(0, 7)}-01`;
}

export function defaultDossierRange(today: string): { from: string; to: string } {
  return { from: monthStartIso(today), to: today };
}

function isCreditMethod(method: string): boolean {
  const m = method.toLowerCase();
  return m.includes("credit") || m === "on_credit" || m === "agent_credit";
}

function buildHabit(
  payments: AgentDossierPayment[],
  bookings: AgentDossierBooking[],
): AgentPaymentHabit {
  const paymentCount = payments.length;
  if (paymentCount === 0) {
    return {
      paymentCount: 0,
      creditSharePct: 0,
      cashLikeSharePct: 0,
      avgDaysToPay: null,
      blurb: "No payments recorded for this agent’s bookings yet.",
    };
  }
  let creditAmt = 0;
  let cashAmt = 0;
  for (const p of payments) {
    const amt = Math.abs(p.amount_btn);
    if (isCreditMethod(p.method)) creditAmt += amt;
    else cashAmt += amt;
  }
  const total = creditAmt + cashAmt || 1;
  const creditSharePct = Math.round((creditAmt / total) * 1000) / 10;
  const cashLikeSharePct = Math.round((cashAmt / total) * 1000) / 10;

  const checkoutByBooking = new Map(
    bookings.map((b) => [b.id, b.check_out] as const),
  );
  const delays: number[] = [];
  for (const p of payments) {
    if (!p.booking_id) continue;
    const co = checkoutByBooking.get(p.booking_id);
    if (!co) continue;
    const payDay = p.created_at.slice(0, 10);
    delays.push(daysBetweenIso(co, payDay));
  }
  const avgDaysToPay =
    delays.length === 0
      ? null
      : Math.round(
          (delays.reduce((s, d) => s + d, 0) / delays.length) * 10,
        ) / 10;

  const habitPay =
    avgDaysToPay == null
      ? "timing unknown"
      : avgDaysToPay <= 0
        ? "often pays on or before check-out"
        : `avg ${avgDaysToPay} days after check-out`;

  return {
    paymentCount,
    creditSharePct,
    cashLikeSharePct,
    avgDaysToPay,
    blurb: `${creditSharePct}% via credit · ${cashLikeSharePct}% cash/card · ${habitPay}.`,
  };
}

export async function loadAgentDossier(
  admin: SupabaseClient,
  opts: {
    propertyId: string;
    agentId: string;
    from: string;
    to: string;
    today: string;
  },
): Promise<AgentDossier | null> {
  const { propertyId, agentId, from, to, today } = opts;

  const { data: agentRow } = await admin
    .from("agents")
    .select(
      "id, company_name, market, contact_name, contact_phone, contact_email, status, rate_tier, credit_limit, credit_used, open_room_cap",
    )
    .eq("id", agentId)
    .maybeSingle();
  if (!agentRow) return null;

  const agent: AgentDossierAgent = {
    id: agentRow.id as string,
    company_name: (agentRow.company_name as string) ?? "Agent",
    market: (agentRow.market as string) ?? "—",
    contact_name: (agentRow.contact_name as string | null) ?? null,
    contact_phone: (agentRow.contact_phone as string | null) ?? null,
    contact_email: (agentRow.contact_email as string | null) ?? null,
    status: (agentRow.status as string) ?? "pending",
    rate_tier: (agentRow.rate_tier as string) ?? "agents",
    credit_limit: Number(agentRow.credit_limit ?? 0),
    credit_used: Number(agentRow.credit_used ?? 0),
    open_room_cap: Number(agentRow.open_room_cap ?? 15),
  };

  const { data: bookingRows } = await admin
    .from("bookings")
    .select(
      "id, contact_name, contact_phone, check_in, check_out, status, rooms, quoted_total_btn, folios(id, label, status, created_at, folio_lines(id, total_btn, status, reverses_line_id))",
    )
    .eq("property_id", propertyId)
    .eq("agent_id", agentId)
    .order("check_in", { ascending: false })
    .limit(300);

  const bookings: AgentDossierBooking[] = (bookingRows ?? []).map((b) => {
    const folios = (b.folios as FolioJoin[] | null) ?? [];
    const folio = folios[0] ?? null;
    const checkIn = b.check_in as string;
    const checkOut = b.check_out as string;
    return {
      id: b.id as string,
      contact_name: (b.contact_name as string | null) ?? null,
      contact_phone: (b.contact_phone as string | null) ?? null,
      check_in: checkIn,
      check_out: checkOut,
      status: b.status as string,
      rooms: Number(b.rooms ?? 1),
      quoted_total_btn:
        b.quoted_total_btn == null ? null : Number(b.quoted_total_btn),
      folio_id: folio?.id ?? null,
      folio_label: folio?.label ?? null,
      nights: daysBetweenIso(checkIn, checkOut),
    };
  });

  const bookingsInRange = bookings.filter(
    (b) => b.check_in <= to && b.check_out > from,
  );

  const guestMap = new Map<string, AgentDossierGuest>();
  for (const b of bookingsInRange) {
    const name = (b.contact_name ?? "Guest").trim() || "Guest";
    const phone = b.contact_phone?.trim() || null;
    const key = `${name.toLowerCase()}|${phone ?? ""}`;
    const existing = guestMap.get(key);
    if (existing) {
      existing.stays += 1;
      if (b.check_in > existing.last_check_in) existing.last_check_in = b.check_in;
    } else {
      guestMap.set(key, {
        key,
        contact_name: name,
        contact_phone: phone,
        stays: 1,
        last_check_in: b.check_in,
      });
    }
  }
  const guests = [...guestMap.values()].sort((a, b) =>
    b.last_check_in.localeCompare(a.last_check_in),
  );

  const bookingIds = bookings.map((b) => b.id);
  const rangeBookingIds = new Set(bookingsInRange.map((b) => b.id));

  const roomAgg = new Map<string, AgentDossierRoomLine>();
  if (bookingIds.length > 0) {
    const { data: roomLines } = await admin
      .from("booking_rooms")
      .select(
        "booking_id, qty, inventory_kind, room_types(name, code)",
      )
      .in("booking_id", bookingIds);

    const nightsByBooking = new Map(
      bookings.map((b) => [b.id, b.nights] as const),
    );

    for (const line of roomLines ?? []) {
      const bid = line.booking_id as string;
      if (!rangeBookingIds.has(bid)) continue;
      const rt = line.room_types as
        | { name?: string; code?: string }
        | { name?: string; code?: string }[]
        | null;
      const roomType = Array.isArray(rt) ? rt[0] : rt;
      const name = roomType?.name ?? "Room";
      const code = roomType?.code ?? "—";
      const kind = (line.inventory_kind as string) ?? "sellable_guest";
      const qty = Number(line.qty ?? 0);
      const nights = nightsByBooking.get(bid) ?? 0;
      const key = `${code}|${kind}`;
      const existing = roomAgg.get(key);
      if (existing) {
        existing.qty += qty;
        existing.room_nights += qty * nights;
      } else {
        roomAgg.set(key, {
          room_type_name: name,
          room_type_code: code,
          inventory_kind: kind,
          qty,
          room_nights: qty * nights,
        });
      }
    }
  }
  const rooms = [...roomAgg.values()].sort((a, b) =>
    a.room_type_name.localeCompare(b.room_type_name),
  );

  const { data: paymentRows } =
    bookingIds.length === 0
      ? { data: [] as Record<string, unknown>[] }
      : await admin
          .from("payments")
          .select(
            "id, amount_btn, method, kind, created_at, booking_id, reference",
          )
          .eq("property_id", propertyId)
          .in("booking_id", bookingIds)
          .order("created_at", { ascending: false })
          .limit(200);

  const payments: AgentDossierPayment[] = (paymentRows ?? []).map((p) => ({
    id: p.id as string,
    amount_btn: Number(p.amount_btn ?? 0),
    method: (p.method as string) ?? "—",
    kind: (p.kind as string | null) ?? null,
    created_at: p.created_at as string,
    booking_id: (p.booking_id as string | null) ?? null,
    reference: (p.reference as string | null) ?? null,
  }));

  let folioTotal = 0;
  let aging = emptyAging();
  for (const b of bookingRows ?? []) {
    const folios = (b.folios as FolioJoin[] | null) ?? [];
    for (const f of folios) {
      const lines = f.folio_lines ?? [];
      const chargeTotal = lines
        .filter((l) => l.status === "posted" && Number(l.total_btn) > 0)
        .reduce((s, l) => s + Number(l.total_btn), 0);
      folioTotal += chargeTotal;
      const balance = netFolioBalance(lines);
      if (Math.abs(balance) > 0.009 && f.status !== "settled") {
        const openDate =
          (b.check_out as string) ||
          String(f.created_at).slice(0, 10) ||
          today;
        aging = addToAging(aging, balance, today, openDate);
      }
    }
  }
  const paid = payments.reduce((s, p) => s + p.amount_btn, 0);
  const outstanding = folioTotal - paid;

  const { data: ledgerRows } = await admin
    .from("agent_credit_ledger")
    .select(
      "id, entry_type, amount_btn, balance_after_btn, note, created_at",
    )
    .eq("agent_id", agentId)
    .order("created_at", { ascending: false })
    .limit(60);

  const ledger: AgentDossierLedger[] = (ledgerRows ?? []).map((r) => ({
    id: r.id as string,
    entry_type: (r.entry_type as string) ?? "—",
    amount_btn: Number(r.amount_btn ?? 0),
    balance_after_btn:
      r.balance_after_btn == null ? null : Number(r.balance_after_btn),
    note: (r.note as string | null) ?? null,
    created_at: r.created_at as string,
  }));

  const { data: rateRows } = await admin
    .from("room_rates")
    .select("season_kind, rate_tier, amount_btn, room_types(name)")
    .eq("property_id", propertyId)
    .eq("rate_tier", agent.rate_tier)
    .order("season_kind");

  const rates: AgentDossierRate[] = (rateRows ?? []).map((r) => {
    const rt = r.room_types as
      | { name?: string }
      | { name?: string }[]
      | null;
    const roomType = Array.isArray(rt) ? rt[0] : rt;
    return {
      season_kind: (r.season_kind as string) ?? "—",
      rate_tier: (r.rate_tier as string) ?? agent.rate_tier,
      amount_btn: Number(r.amount_btn ?? 0),
      room_type_name: roomType?.name ?? "Room",
    };
  });

  const { data: allotmentRows } = await admin
    .from("agent_allotments")
    .select(
      "id, rooms_per_week, valid_from, valid_to, room_types(name)",
    )
    .eq("property_id", propertyId)
    .eq("agent_id", agentId)
    .order("valid_from", { ascending: false })
    .limit(40);

  const allotments: AgentDossierAllotment[] = (allotmentRows ?? []).map((a) => {
    const rt = a.room_types as
      | { name?: string }
      | { name?: string }[]
      | null;
    const roomType = Array.isArray(rt) ? rt[0] : rt;
    return {
      id: a.id as string,
      room_type_name: roomType?.name ?? "Room",
      rooms_per_week: Number(a.rooms_per_week ?? 0),
      valid_from: a.valid_from as string,
      valid_to: a.valid_to as string,
    };
  });

  const roomNights = rooms.reduce((s, r) => s + r.room_nights, 0);
  const quotedTotal = bookingsInRange.reduce(
    (s, b) => s + (b.quoted_total_btn ?? 0),
    0,
  );

  const openRoomsInHouse = bookings
    .filter((b) => b.status === "checked_in")
    .reduce((s, b) => s + Math.max(1, b.rooms), 0);

  const { data: packRows } = await admin
    .from("booking_settlement_packs")
    .select(
      "id, booking_id, sealed_at, email_sent_at, email_to, guide_sign_status, bookings(contact_name)",
    )
    .eq("agent_id", agentId)
    .eq("property_id", propertyId)
    .order("sealed_at", { ascending: false })
    .limit(40);

  const packs: AgentDossierPack[] = (packRows ?? []).map((p) => {
    const bRaw = p.bookings as
      | { contact_name?: string }
      | { contact_name?: string }[]
      | null;
    const b = Array.isArray(bRaw) ? bRaw[0] : bRaw;
    return {
      id: p.id as string,
      bookingId: p.booking_id as string,
      guestName: b?.contact_name ?? null,
      sealedAt: p.sealed_at as string,
      emailSentAt: (p.email_sent_at as string | null) ?? null,
      emailTo: (p.email_to as string | null) ?? null,
      guideSignStatus: (p.guide_sign_status as string | null) ?? null,
    };
  });

  return {
    agent,
    from,
    to,
    today,
    bookings,
    bookingsInRange,
    guests,
    rooms,
    money: {
      folioTotal,
      paid,
      outstanding,
      aging,
      payments,
      ledger,
      habit: buildHabit(payments, bookings),
      openRoomsInHouse,
      packs,
    },
    rates,
    allotments,
    summary: {
      bookingCount: bookingsInRange.length,
      roomNights,
      quotedTotal,
    },
  };
}

/** Aggregate production across agents for a date range (reports catalog). */
export async function loadAgentProductionReport(
  admin: SupabaseClient,
  opts: { propertyId: string; from: string; to: string; agentId?: string },
): Promise<
  {
    agent_id: string;
    company_name: string;
    bookings: number;
    room_nights: number;
    quoted_total: number;
    rooms: number;
    commission_pct: number | null;
    commission_btn: number;
  }[]
> {
  let q = admin
    .from("bookings")
    .select(
      "id, agent_id, rooms, quoted_total_btn, check_in, check_out, agents(company_name, commission_pct)",
    )
    .eq("property_id", opts.propertyId)
    .not("agent_id", "is", null)
    .lte("check_in", opts.to)
    .gt("check_out", opts.from)
    .limit(1000);
  if (opts.agentId) q = q.eq("agent_id", opts.agentId);

  const { data: bookingRows } = await q;
  const ids = (bookingRows ?? []).map((b) => b.id as string);

  const nightsByBooking = new Map<string, number>();
  const roomsByBooking = new Map<string, number>();
  for (const b of bookingRows ?? []) {
    nightsByBooking.set(
      b.id as string,
      daysBetweenIso(b.check_in as string, b.check_out as string),
    );
  }

  if (ids.length > 0) {
    const { data: lines } = await admin
      .from("booking_rooms")
      .select("booking_id, qty")
      .in("booking_id", ids);
    for (const line of lines ?? []) {
      const bid = line.booking_id as string;
      roomsByBooking.set(
        bid,
        (roomsByBooking.get(bid) ?? 0) + Number(line.qty ?? 0),
      );
    }
  }

  const byAgent = new Map<
    string,
    {
      agent_id: string;
      company_name: string;
      bookings: number;
      room_nights: number;
      quoted_total: number;
      rooms: number;
      commission_pct: number | null;
      commission_btn: number;
    }
  >();

  for (const b of bookingRows ?? []) {
    const agentId = b.agent_id as string;
    if (!agentId) continue;
    const ag = b.agents as
      | { company_name?: string; commission_pct?: number | null }
      | { company_name?: string; commission_pct?: number | null }[]
      | null;
    const agentObj = Array.isArray(ag) ? ag[0] : ag;
    const name = agentObj?.company_name ?? "Agent";
    const commissionPct =
      agentObj?.commission_pct == null
        ? null
        : Number(agentObj.commission_pct);
    const nights = nightsByBooking.get(b.id as string) ?? 0;
    const qty =
      roomsByBooking.get(b.id as string) ?? Number(b.rooms ?? 1);
    const quoted = Number(b.quoted_total_btn ?? 0);
    const existing = byAgent.get(agentId);
    if (existing) {
      existing.bookings += 1;
      existing.room_nights += qty * nights;
      existing.quoted_total += quoted;
      existing.rooms += qty;
    } else {
      byAgent.set(agentId, {
        agent_id: agentId,
        company_name: name,
        bookings: 1,
        room_nights: qty * nights,
        quoted_total: quoted,
        rooms: qty,
        commission_pct: commissionPct,
        commission_btn: 0,
      });
    }
  }

  return [...byAgent.values()]
    .map((row) => {
      const pct = row.commission_pct;
      const commission_btn =
        pct != null && pct > 0
          ? Math.round((row.quoted_total * pct) / 100 * 100) / 100
          : 0;
      return { ...row, commission_btn };
    })
    .sort((a, b) => b.room_nights - a.room_nights);
}
