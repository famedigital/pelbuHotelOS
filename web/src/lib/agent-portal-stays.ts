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

export type AgentStayRow = {
  id: string;
  confirmationCode: string | null;
  confirmationLabel: string;
  guestName: string | null;
  checkIn: string;
  checkOut: string;
  nights: number;
  rooms: number;
  status: string;
  guideNumber: string | null;
  quotedBtn: number | null;
  dueBtn: number;
  paidBtn: number;
  folioId: string | null;
  holdExpiresAt: string | null;
  invoices: AgentStayInvoice[];
  proofCount: number;
  roomLabel: string | null;
};

function nightsBetween(checkIn: string, checkOut: string): number {
  const a = new Date(`${checkIn}T00:00:00Z`).getTime();
  const b = new Date(`${checkOut}T00:00:00Z`).getTime();
  if (!Number.isFinite(a) || !Number.isFinite(b) || b <= a) return 0;
  return Math.round((b - a) / 86_400_000);
}

/** Full stay rows for partner DataTable — own agent + active hotel only. */
export async function loadAgentStayRows(
  admin: Admin,
  opts: {
    agentId: string;
    propertyId: string;
    sessionAgentId: string;
    limit?: number;
  },
): Promise<AgentStayRow[]> {
  assertPortalAgentScope({ agentId: opts.sessionAgentId }, opts.agentId);

  const staySelectWithPayments = `id, confirmation_code, contact_name, check_in, check_out, status, rooms,
       guide_number, quoted_total_btn, hold_expires_at, created_at,
       booking_rooms(qty, room_types(name)),
       folios(
         id,
         folio_lines(id, status, total_btn, reverses_line_id),
         payments(amount_btn, confirmation_status),
         fiscal_documents(id, doc_no, doc_kind, status)
       )`;
  const staySelectNoPayments = `id, confirmation_code, contact_name, check_in, check_out, status, rooms,
       guide_number, quoted_total_btn, hold_expires_at, created_at,
       booking_rooms(qty, room_types(name)),
       folios(
         id,
         folio_lines(id, status, total_btn, reverses_line_id),
         fiscal_documents(id, doc_no, doc_kind, status)
       )`;

  let { data: bookings, error } = await admin
    .from("bookings")
    .select(staySelectWithPayments)
    .eq("agent_id", opts.agentId)
    .eq("property_id", opts.propertyId)
    .order("check_in", { ascending: false })
    .limit(opts.limit ?? 120);

  // Degrade: if payments embed fails, still load stays (paid = 0).
  if (error && /payments/i.test(error.message ?? "")) {
    console.warn("loadAgentStayRows payments embed failed; retrying without", error.message);
    const retry = await admin
      .from("bookings")
      .select(staySelectNoPayments)
      .eq("agent_id", opts.agentId)
      .eq("property_id", opts.propertyId)
      .order("check_in", { ascending: false })
      .limit(opts.limit ?? 120);
    // Retry omits payments; runtime treats missing as []. Cast past PostgREST select variance.
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
      // Table may not be migrated yet — stays table still loads.
      console.warn("agent_booking_attachments", proofErr.message);
    } else {
      for (const p of proofs ?? []) {
        const bid = p.booking_id as string;
        proofByBooking.set(bid, (proofByBooking.get(bid) ?? 0) + 1);
      }
    }
  }

  return (bookings ?? []).map((b) => {
    const folioRaw = b.folios;
    const folio = Array.isArray(folioRaw) ? folioRaw[0] : folioRaw;
    const lines = ((folio?.folio_lines ?? []) as Array<{
      id: string;
      status: string;
      total_btn: number;
      reverses_line_id: string | null;
    }>).map((l, i) => ({
      id: l.id ?? `tmp-${i}`,
      status: l.status ?? "posted",
      total_btn: Number(l.total_btn ?? 0),
      reverses_line_id: l.reverses_line_id ?? null,
    }));
    const dueBtn = folio ? guestLedgerBalance(lines) : 0;
    const paidBtn = ((folio?.payments ?? []) as Array<{
      amount_btn: number;
      confirmation_status?: string;
    }>)
      .filter((p) => (p.confirmation_status ?? "confirmed") === "confirmed")
      .reduce((s, p) => s + Number(p.amount_btn ?? 0), 0);

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
      qty: number;
      room_types?: { name: string } | { name: string }[] | null;
    }>;
    const roomBits = roomLines.map((r) => {
      const rt = Array.isArray(r.room_types) ? r.room_types[0] : r.room_types;
      return rt?.name ? `${r.qty}× ${rt.name}` : `${r.qty} room`;
    });

    const rooms =
      roomLines.reduce((s, r) => s + Number(r.qty ?? 0), 0) ||
      Number(b.rooms ?? 1);

    return {
      id: b.id as string,
      confirmationCode: (b.confirmation_code as string | null) ?? null,
      confirmationLabel: bookingConfirmationLabel({
        confirmationCode: b.confirmation_code as string | null,
        bookingId: b.id as string,
      }),
      guestName: (b.contact_name as string | null) ?? null,
      checkIn: b.check_in as string,
      checkOut: b.check_out as string,
      nights: nightsBetween(b.check_in as string, b.check_out as string),
      rooms,
      status: (b.status as string) ?? "—",
      guideNumber: (b.guide_number as string | null) ?? null,
      quotedBtn:
        b.quoted_total_btn == null ? null : Number(b.quoted_total_btn),
      dueBtn,
      paidBtn,
      folioId: (folio?.id as string | null) ?? null,
      holdExpiresAt: (b.hold_expires_at as string | null) ?? null,
      invoices,
      proofCount: proofByBooking.get(b.id as string) ?? 0,
      roomLabel: roomBits.length ? roomBits.join(", ") : null,
    };
  });
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
    limit: 200,
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
