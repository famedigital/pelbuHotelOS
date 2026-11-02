import { bookingConfirmationLabel } from "@/lib/booking-ref";
import { guestLedgerBalance } from "@/lib/folio/guest-ledger";
import { assertPortalAgentScope } from "@/lib/agent-auth";
import type { createSupabaseAdminClient } from "@/lib/supabase/admin";

type Admin = ReturnType<typeof createSupabaseAdminClient>;

export type AgentStayInvoice = {
  id: string;
  docNo: string;
  docKind: string;
  status: string;
};

export type AgentStayAttachment = {
  id: string;
  kind: string;
  docUrl: string;
  docName: string | null;
  createdAt: string;
};

export type AgentStayRoomDetail = {
  categoryName: string;
  count: number;
  mealPlan: string;
};

export type AgentStayPaymentStatus = "paid" | "partial" | "unpaid" | "hold";

export type AgentStayRow = {
  id: string;
  confirmationCode: string | null;
  confirmationLabel: string;
  guestName: string | null;
  paxCount: number;
  nationality: string | null;
  guideNumber: string | null;
  checkIn: string;
  checkOut: string;
  nights: number;
  rooms: number;
  roomsCount: number;
  roomDetails: AgentStayRoomDetail[];
  roomLabel: string | null;
  mealPlanCode: string;
  rateBtn: number;
  subtotalBtn: number;
  gstBtn: number;
  serviceChargeBtn: number;
  grandTotalBtn: number;
  /** @deprecated prefer grandTotalBtn — kept for dashboard / voucher */
  quotedBtn: number | null;
  paidBtn: number;
  dueBtn: number;
  paymentStatus: AgentStayPaymentStatus;
  status: string;
  folioId: string | null;
  holdExpiresAt: string | null;
  invoices: AgentStayInvoice[];
  proofCount: number;
  hasVoucherProof: boolean;
};

function nightsBetween(checkIn: string, checkOut: string): number {
  const a = new Date(`${checkIn}T00:00:00Z`).getTime();
  const b = new Date(`${checkOut}T00:00:00Z`).getTime();
  if (!Number.isFinite(a) || !Number.isFinite(b) || b <= a) return 0;
  return Math.round((b - a) / 86_400_000);
}

/** Stay overlaps [from, to) in calendar dates (UTC midnight boundaries). */
export function stayOverlapsRange(
  checkIn: string,
  checkOut: string,
  from: string,
  to: string,
): boolean {
  return checkIn < to && checkOut > from;
}

export function derivePaymentStatus(input: {
  status: string;
  paidBtn: number;
  dueBtn: number;
  grandTotalBtn: number;
}): AgentStayPaymentStatus {
  if (input.status === "held") return "hold";
  const due = Math.abs(input.dueBtn);
  const paid = input.paidBtn;
  if (due <= 0.5 && paid > 0.5) return "paid";
  if (due <= 0.5 && input.grandTotalBtn <= 0.5) return "paid";
  if (paid <= 0.5 && due > 0.5) return "unpaid";
  if (paid > 0.5 && due > 0.5) return "partial";
  return due > 0.5 ? "unpaid" : "paid";
}

export function agentStayDateBounds(rows: AgentStayRow[]): {
  from: string | null;
  to: string | null;
} {
  if (rows.length === 0) return { from: null, to: null };
  let from = rows[0].checkIn;
  let to = rows[0].checkOut;
  for (const r of rows) {
    if (r.checkIn < from) from = r.checkIn;
    if (r.checkOut > to) to = r.checkOut;
  }
  return { from, to };
}

type FolioLineTax = {
  id: string;
  status: string;
  total_btn: number;
  gst_btn?: number | null;
  service_charge_btn?: number | null;
  reverses_line_id: string | null;
};

function sumPostedTax(lines: FolioLineTax[]): {
  gst: number;
  sc: number;
  total: number;
} {
  const active = lines.filter(
    (l) =>
      (l.status ?? "posted") !== "void" &&
      !l.reverses_line_id,
  );
  const reversed = new Set(
    lines
      .filter((l) => l.reverses_line_id)
      .map((l) => l.reverses_line_id as string),
  );
  let gst = 0;
  let sc = 0;
  let total = 0;
  for (const l of active) {
    if (reversed.has(l.id)) continue;
    gst += Number(l.gst_btn ?? 0);
    sc += Number(l.service_charge_btn ?? 0);
    total += Number(l.total_btn ?? 0);
  }
  return { gst, sc, total };
}

/** Full stay rows for partner DataTable — own agent + active hotel only. */
export async function loadAgentStayRows(
  admin: Admin,
  opts: {
    agentId: string;
    propertyId: string;
    sessionAgentId: string;
    limit?: number;
    from?: string;
    to?: string;
  },
): Promise<AgentStayRow[]> {
  assertPortalAgentScope({ agentId: opts.sessionAgentId }, opts.agentId);

  const staySelectWithPayments = `id, confirmation_code, contact_name, check_in, check_out, status, rooms,
       adults, children, meal_plan_code, guide_number, quoted_total_btn, agreed_nightly_rate_btn,
       hold_expires_at, created_at,
       booking_rooms(qty, adults, children, meal_plan_code, agreed_nightly_rate_btn, sheet_nightly_rate_btn, room_types(name)),
       booking_guests(full_name, nationality),
       folios(
         id,
         folio_lines(id, status, total_btn, gst_btn, service_charge_btn, reverses_line_id),
         payments(amount_btn, confirmation_status),
         fiscal_documents(id, doc_no, doc_kind, status)
       )`;
  const staySelectNoPayments = `id, confirmation_code, contact_name, check_in, check_out, status, rooms,
       adults, children, meal_plan_code, guide_number, quoted_total_btn, agreed_nightly_rate_btn,
       hold_expires_at, created_at,
       booking_rooms(qty, adults, children, meal_plan_code, agreed_nightly_rate_btn, sheet_nightly_rate_btn, room_types(name)),
       booking_guests(full_name, nationality),
       folios(
         id,
         folio_lines(id, status, total_btn, gst_btn, service_charge_btn, reverses_line_id),
         fiscal_documents(id, doc_no, doc_kind, status)
       )`;
  const staySelectMinimal = `id, confirmation_code, contact_name, check_in, check_out, status, rooms,
       guide_number, quoted_total_btn, hold_expires_at, created_at,
       booking_rooms(qty, room_types(name)),
       folios(
         id,
         folio_lines(id, status, total_btn, reverses_line_id),
         payments(amount_btn, confirmation_status),
         fiscal_documents(id, doc_no, doc_kind, status)
       )`;

  let { data: bookings, error } = await admin
    .from("bookings")
    .select(staySelectWithPayments)
    .eq("agent_id", opts.agentId)
    .eq("property_id", opts.propertyId)
    .order("check_in", { ascending: true })
    .limit(opts.limit ?? 200);

  if (error && /payments/i.test(error.message ?? "")) {
    console.warn("loadAgentStayRows payments embed failed; retrying without", error.message);
    const retry = await admin
      .from("bookings")
      .select(staySelectNoPayments)
      .eq("agent_id", opts.agentId)
      .eq("property_id", opts.propertyId)
      .order("check_in", { ascending: true })
      .limit(opts.limit ?? 200);
    bookings = retry.data as typeof bookings;
    error = retry.error;
  }

  if (error) {
    console.warn("loadAgentStayRows rich select failed; retrying minimal", error.message);
    const retry = await admin
      .from("bookings")
      .select(staySelectMinimal)
      .eq("agent_id", opts.agentId)
      .eq("property_id", opts.propertyId)
      .order("check_in", { ascending: true })
      .limit(opts.limit ?? 200);
    bookings = retry.data as typeof bookings;
    error = retry.error;
  }

  if (error) {
    console.error("loadAgentStayRows", error);
    throw new Error("Could not load stays.");
  }

  const bookingIds = (bookings ?? []).map((b) => b.id as string);
  const proofByBooking = new Map<string, number>();
  if (bookingIds.length) {
    const { data: proofs, error: proofErr } = await admin
      .from("agent_booking_attachments")
      .select("booking_id")
      .eq("agent_id", opts.agentId)
      .in("booking_id", bookingIds)
      .eq("kind", "payment_proof");
    if (proofErr) {
      console.warn("agent_booking_attachments", proofErr.message);
    } else {
      for (const p of proofs ?? []) {
        const bid = p.booking_id as string;
        proofByBooking.set(bid, (proofByBooking.get(bid) ?? 0) + 1);
      }
    }
  }

  const from = opts.from && /^\d{4}-\d{2}-\d{2}$/.test(opts.from) ? opts.from : null;
  const to = opts.to && /^\d{4}-\d{2}-\d{2}$/.test(opts.to) ? opts.to : null;

  const mapped = (bookings ?? []).map((b) => {
    const folioRaw = b.folios;
    const folio = Array.isArray(folioRaw) ? folioRaw[0] : folioRaw;
    const rawLines = (folio?.folio_lines ?? []) as FolioLineTax[];
    const linesForBalance = rawLines.map((l, i) => ({
      id: l.id ?? `tmp-${i}`,
      status: l.status ?? "posted",
      total_btn: Number(l.total_btn ?? 0),
      reverses_line_id: l.reverses_line_id ?? null,
    }));
    const dueBtn = folio ? guestLedgerBalance(linesForBalance) : 0;
    const paidBtn = ((folio?.payments ?? []) as Array<{
      amount_btn: number;
      confirmation_status?: string;
    }>)
      .filter((p) => (p.confirmation_status ?? "confirmed") === "confirmed")
      .reduce((s, p) => s + Number(p.amount_btn ?? 0), 0);

    const tax = sumPostedTax(
      rawLines.map((l, i) => ({
        id: l.id ?? `tmp-${i}`,
        status: l.status ?? "posted",
        total_btn: Number(l.total_btn ?? 0),
        gst_btn: l.gst_btn,
        service_charge_btn: l.service_charge_btn,
        reverses_line_id: l.reverses_line_id ?? null,
      })),
    );

    const fiscal = (folio?.fiscal_documents ?? []) as Array<{
      id: string;
      doc_no: string;
      doc_kind: string;
      status: string;
    }>;
    const invoices = fiscal
      .filter((d) => d.doc_kind === "invoice" || d.doc_kind === "receipt")
      .map((d) => ({
        id: d.id,
        docNo: d.doc_no,
        docKind: d.doc_kind,
        status: d.status,
      }));

    const roomLines = (b.booking_rooms ?? []) as Array<{
      qty?: number;
      adults?: number | null;
      children?: number | null;
      meal_plan_code?: string | null;
      agreed_nightly_rate_btn?: number | null;
      sheet_nightly_rate_btn?: number | null;
      room_types?: { name: string } | { name: string }[] | null;
    }>;

    const roomDetails: AgentStayRoomDetail[] = roomLines.map((r) => {
      const rt = Array.isArray(r.room_types) ? r.room_types[0] : r.room_types;
      const meal =
        (r.meal_plan_code as string | null) ||
        (b.meal_plan_code as string | null) ||
        "EP";
      return {
        categoryName: rt?.name ?? "Room",
        count: Number(r.qty ?? 1) || 1,
        mealPlan: meal,
      };
    });

    const rooms =
      roomDetails.reduce((s, r) => s + r.count, 0) || Number(b.rooms ?? 1);

    let paxCount = roomLines.reduce(
      (s, r) =>
        s +
        Number(r.adults ?? 0) * Number(r.qty ?? 1) +
        Number(r.children ?? 0) * Number(r.qty ?? 1),
      0,
    );
    if (paxCount <= 0) {
      paxCount =
        Number(b.adults ?? 0) + Number(b.children ?? 0) ||
        Math.max(1, rooms);
    }

    const guests = (b.booking_guests ?? []) as Array<{
      full_name?: string | null;
      nationality?: string | null;
    }>;
    const guestName =
      ((b.contact_name as string | null) ?? null)?.trim() ||
      guests.find((g) => g.full_name?.trim())?.full_name?.trim() ||
      null;
    const nationality =
      guests.find((g) => g.nationality?.trim())?.nationality?.trim() || null;

    const mealPlanCode =
      roomDetails[0]?.mealPlan ||
      (b.meal_plan_code as string | null) ||
      "EP";

    const nights = nightsBetween(b.check_in as string, b.check_out as string);
    const nightlyCandidates = roomLines
      .map((r) =>
        Number(r.agreed_nightly_rate_btn ?? r.sheet_nightly_rate_btn ?? 0),
      )
      .filter((n) => n > 0);
    const bookingNightly = Number(b.agreed_nightly_rate_btn ?? 0);
    const quoted = b.quoted_total_btn == null ? null : Number(b.quoted_total_btn);

    let rateBtn =
      nightlyCandidates[0] ||
      bookingNightly ||
      (quoted != null && nights > 0 && rooms > 0
        ? quoted / (nights * rooms)
        : 0);

    const hasFolioTax = tax.total > 0.5 || tax.gst > 0.5 || tax.sc > 0.5;
    const gstBtn = hasFolioTax ? tax.gst : 0;
    const serviceChargeBtn = hasFolioTax ? tax.sc : 0;
    const grandTotalBtn = hasFolioTax
      ? tax.total
      : quoted != null
        ? quoted
        : rateBtn * nights * rooms;
    const subtotalBtn = Math.max(
      0,
      grandTotalBtn - gstBtn - serviceChargeBtn,
    );
    if (rateBtn <= 0 && nights > 0 && rooms > 0) {
      rateBtn = subtotalBtn / (nights * rooms);
    }

    const status = (b.status as string) ?? "—";
    const paymentStatus = derivePaymentStatus({
      status,
      paidBtn,
      dueBtn: folio ? dueBtn : grandTotalBtn - paidBtn,
      grandTotalBtn,
    });

    const proofCount = proofByBooking.get(b.id as string) ?? 0;
    const roomBits = roomDetails.map(
      (r) => `${r.count}× ${r.categoryName}`,
    );

    return {
      id: b.id as string,
      confirmationCode: (b.confirmation_code as string | null) ?? null,
      confirmationLabel: bookingConfirmationLabel({
        confirmationCode: b.confirmation_code as string | null,
        bookingId: b.id as string,
      }),
      guestName,
      paxCount,
      nationality,
      guideNumber: (b.guide_number as string | null) ?? null,
      checkIn: b.check_in as string,
      checkOut: b.check_out as string,
      nights,
      rooms,
      roomsCount: rooms,
      roomDetails,
      roomLabel: roomBits.length ? roomBits.join(", ") : null,
      mealPlanCode,
      rateBtn,
      subtotalBtn,
      gstBtn,
      serviceChargeBtn,
      grandTotalBtn,
      quotedBtn: quoted,
      paidBtn,
      dueBtn: folio ? dueBtn : Math.max(0, grandTotalBtn - paidBtn),
      paymentStatus,
      status,
      folioId: (folio?.id as string | null) ?? null,
      holdExpiresAt: (b.hold_expires_at as string | null) ?? null,
      invoices,
      proofCount,
      hasVoucherProof: proofCount > 0,
    } satisfies AgentStayRow;
  });

  if (from && to) {
    return mapped.filter((r) =>
      stayOverlapsRange(r.checkIn, r.checkOut, from, to),
    );
  }
  return mapped;
}

export async function loadAgentStayDetail(
  admin: Admin,
  opts: {
    agentId: string;
    propertyId: string;
    bookingId: string;
    sessionAgentId: string;
  },
): Promise<(AgentStayRow & { attachments: AgentStayAttachment[] }) | null> {
  assertPortalAgentScope({ agentId: opts.sessionAgentId }, opts.agentId);

  const { data: booking } = await admin
    .from("bookings")
    .select("id")
    .eq("id", opts.bookingId)
    .eq("agent_id", opts.agentId)
    .eq("property_id", opts.propertyId)
    .maybeSingle();
  if (!booking) return null;

  const rows = await loadAgentStayRows(admin, {
    agentId: opts.agentId,
    propertyId: opts.propertyId,
    sessionAgentId: opts.sessionAgentId,
    limit: 300,
  });
  const row = rows.find((r) => r.id === opts.bookingId);
  if (!row) return null;

  const { data: attachments, error: attErr } = await admin
    .from("agent_booking_attachments")
    .select("id, kind, doc_url, doc_name, created_at")
    .eq("agent_id", opts.agentId)
    .eq("booking_id", opts.bookingId)
    .order("created_at", { ascending: false });
  if (attErr) {
    console.warn("agent_booking_attachments detail", attErr.message);
  }

  return {
    ...row,
    attachments: (attachments ?? []).map((a) => ({
      id: a.id as string,
      kind: a.kind as string,
      docUrl: a.doc_url as string,
      docName: (a.doc_name as string | null) ?? null,
      createdAt: a.created_at as string,
    })),
  };
}
