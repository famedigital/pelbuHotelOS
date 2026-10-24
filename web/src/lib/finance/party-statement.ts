import type { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { amountInWordsNu } from "@/lib/print/amount-in-words";

type Admin = ReturnType<typeof createSupabaseAdminClient>;

export type StatementLine = {
  date: string;
  details: string;
  debit: number | null;
  credit: number | null;
  balance: number;
};

export type PartyStatement = {
  title: string;
  period: string;
  broughtForward: number;
  lines: StatementLine[];
  due: number;
  dueWords: string;
};

type RawLine = {
  description?: string | null;
  total_btn?: number | null;
  business_date?: string | null;
  created_at?: string | null;
  source_type?: string | null;
  status?: string | null;
  folios?: { booking_id?: string } | { booking_id?: string }[] | null;
};

function lineDate(line: RawLine): string {
  return (line.business_date || line.created_at || "").slice(0, 10);
}

function build(
  title: string,
  from: string,
  to: string,
  raw: RawLine[],
  detailFor: (line: RawLine) => string,
): PartyStatement {
  const posted = raw.filter((line) => line.status !== "void");
  const before = posted.filter((line) => lineDate(line) && lineDate(line) < from);
  const inside = posted
    .filter((line) => {
      const date = lineDate(line);
      return date >= from && date <= to;
    })
    .sort((a, b) => lineDate(a).localeCompare(lineDate(b)));
  let balance = before.reduce((sum, line) => sum + Number(line.total_btn ?? 0), 0);
  const broughtForward = Math.round(balance * 100) / 100;
  const lines: StatementLine[] = inside.map((line) => {
    const total = Number(line.total_btn ?? 0);
    balance = Math.round((balance + total) * 100) / 100;
    const payment = total < 0 || line.source_type === "payment";
    return {
      date: lineDate(line),
      details: detailFor(line),
      debit: payment ? null : total,
      credit: payment ? Math.abs(total) : null,
      balance,
    };
  });
  const due = balance;
  return {
    title,
    period: `${from} to ${to}`,
    broughtForward,
    lines,
    due,
    dueWords: amountInWordsNu(Math.abs(due)),
  };
}

export async function loadGuestStatement(
  admin: Admin,
  propertyId: string,
  bookingId: string,
  from: string,
  to: string,
): Promise<PartyStatement | null> {
  const { data: booking } = await admin
    .from("bookings")
    .select("id, contact_name, confirmation_code")
    .eq("id", bookingId)
    .eq("property_id", propertyId)
    .maybeSingle();
  if (!booking) return null;
  const { data: folios } = await admin.from("folios").select("id").eq("booking_id", bookingId);
  const folioIds = (folios ?? []).map((folio) => folio.id as string);
  if (!folioIds.length) {
    return build(booking.contact_name as string, from, to, [], (line) => line.description ?? "");
  }
  const { data: lines } = await admin
    .from("folio_lines")
    .select("description, total_btn, business_date, created_at, source_type, status")
    .in("folio_id", folioIds);
  return build(
    `${booking.contact_name as string}`,
    from,
    to,
    (lines ?? []) as RawLine[],
    (line) => line.description || "Charge",
  );
}

export async function loadAgentStatement(
  admin: Admin,
  propertyId: string,
  agentId: string,
  from: string,
  to: string,
): Promise<PartyStatement | null> {
  const { data: agent } = await admin
    .from("agents")
    .select("id, company_name")
    .eq("id", agentId)
    .maybeSingle();
  if (!agent) return null;
  const { data: bookings } = await admin
    .from("bookings")
    .select("id, contact_name, check_in, check_out")
    .eq("property_id", propertyId)
    .eq("agent_id", agentId)
    .lt("check_in", to)
    .gt("check_out", from)
    .limit(400);
  const bookingIds = (bookings ?? []).map((booking) => booking.id as string);
  const guestByBooking = new Map(
    (bookings ?? []).map((booking) => [booking.id as string, booking.contact_name as string]),
  );
  if (!bookingIds.length) {
    return build(agent.company_name as string, from, to, [], () => "");
  }
  const { data: folios } = await admin
    .from("folios")
    .select("id, booking_id")
    .in("booking_id", bookingIds);
  const folioIds = (folios ?? []).map((folio) => folio.id as string);
  const bookingByFolio = new Map(
    (folios ?? []).map((folio) => [folio.id as string, folio.booking_id as string]),
  );
  if (!folioIds.length) {
    return build(agent.company_name as string, from, to, [], () => "");
  }
  const { data: lines } = await admin
    .from("folio_lines")
    .select("description, total_btn, business_date, created_at, source_type, status, folio_id")
    .in("folio_id", folioIds);
  return build(
    agent.company_name as string,
    from,
    to,
    (lines ?? []) as RawLine[],
    (line) => {
      const folioId = (line as RawLine & { folio_id?: string }).folio_id;
      const guest = folioId ? guestByBooking.get(bookingByFolio.get(folioId) ?? "") : "";
      return [guest, line.description].filter(Boolean).join(" · ") || "Charge";
    },
  );
}

