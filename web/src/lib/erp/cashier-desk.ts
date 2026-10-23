import "server-only";

import { thimphuDateOffset, thimphuToday } from "@/lib/erp-lists";
import { loadUnpaidBills } from "@/lib/erp/unpaid-bills";
import { bucketTender, folioMoney, type FolioMoneyLine } from "@/lib/erp/cashier-desk-math";
import type { createSupabaseAdminClient } from "@/lib/supabase/admin";

type Admin = ReturnType<typeof createSupabaseAdminClient>;

export type CashierStrip = {
  toCollectBtn: number;
  openFolios: number;
  cashBtn: number;
  bankBtn: number;
  qrBtn: number;
  otherBtn: number;
  takenTodayBtn: number;
  invoicesToday: number;
};

export type CashierFolioRow = {
  folioId: string;
  bookingId: string | null;
  guestName: string;
  confirmationCode: string | null;
  rooms: string;
  agentName: string | null;
  phone: string | null;
  checkIn: string | null;
  checkOut: string | null;
  chargesBtn: number;
  paidBtn: number;
  dueBtn: number;
  invoiceId: string | null;
  invoiceDocNo: string | null;
};

function one<T>(raw: T | T[] | null | undefined): T | null {
  if (raw == null) return null;
  return Array.isArray(raw) ? (raw[0] ?? null) : raw;
}

function roomLabels(
  assigns:
    | {
        room_units?: { label?: string | null } | { label?: string | null }[] | null;
      }[]
    | null
    | undefined,
): string {
  if (!assigns?.length) return "";
  const labels = assigns
    .map((row) => one(row.room_units)?.label?.trim() || "")
    .filter(Boolean);
  return [...new Set(labels)].join(", ");
}

/** Thimphu civil day as timestamptz bounds. */
export function thimphuDayBounds(day: string): { fromIso: string; toIso: string } {
  const next = thimphuDateOffset(day, 1);
  return {
    fromIso: `${day}T00:00:00.000+06:00`,
    toIso: `${next}T00:00:00.000+06:00`,
  };
}

type BookingShape = {
  id?: string;
  confirmation_code?: string | null;
  contact_name?: string | null;
  contact_phone?: string | null;
  check_in?: string | null;
  check_out?: string | null;
  agents?:
    | { company_name?: string | null }
    | { company_name?: string | null }[]
    | null;
  room_assignments?:
    | {
        room_units?: { label?: string | null } | { label?: string | null }[] | null;
      }[]
    | null;
};

export async function loadOpenFolioRegister(
  admin: Admin,
  propertyId: string,
): Promise<CashierFolioRow[]> {
  const { data: folios } = await admin
    .from("folios")
    .select(
      `id, label, status, booking_id,
       bookings(
         id, confirmation_code, contact_name, contact_phone,
         check_in, check_out,
         agents(company_name),
         room_assignments(room_units(label))
       ),
       folio_lines(id, total_btn, status, reverses_line_id, source_type)`,
    )
    .eq("property_id", propertyId)
    .eq("status", "open")
    .limit(500);

  const folioIds = (folios ?? []).map((row) => row.id as string);
  const invoiceByFolio = new Map<string, { id: string; docNo: string | null }>();
  if (folioIds.length > 0) {
    const { data: docs } = await admin
      .from("fiscal_documents")
      .select("id, folio_id, doc_no, issued_at")
      .in("folio_id", folioIds)
      .eq("doc_kind", "invoice")
      .in("status", ["issued", "sent"])
      .order("issued_at", { ascending: false })
      .limit(2000);
    for (const doc of docs ?? []) {
      const folioId = doc.folio_id as string;
      if (!invoiceByFolio.has(folioId)) {
        invoiceByFolio.set(folioId, {
          id: doc.id as string,
          docNo: (doc.doc_no as string | null) ?? null,
        });
      }
    }
  }

  const rows: CashierFolioRow[] = [];
  for (const folio of folios ?? []) {
    const booking = one(folio.bookings as BookingShape | BookingShape[] | null);
    const agent = one(booking?.agents ?? null);
    const lines = (folio.folio_lines as FolioMoneyLine[] | null) ?? [];
    const money = folioMoney(
      lines.map((line, index) => ({
        ...line,
        id: line.id || String(index),
      })),
    );
    rows.push({
      folioId: folio.id as string,
      bookingId:
        (booking?.id as string | undefined) ??
        (folio.booking_id as string | null) ??
        null,
      guestName:
        booking?.contact_name?.trim() ||
        (folio.label as string | null)?.trim() ||
        "Guest",
      confirmationCode: booking?.confirmation_code ?? null,
      rooms: roomLabels(booking?.room_assignments),
      agentName: agent?.company_name?.trim() || null,
      phone: booking?.contact_phone?.trim() || null,
      checkIn: booking?.check_in?.toString().slice(0, 10) ?? null,
      checkOut: booking?.check_out?.toString().slice(0, 10) ?? null,
      chargesBtn: money.chargesBtn,
      paidBtn: money.paidBtn,
      dueBtn: money.dueBtn,
      invoiceId: invoiceByFolio.get(folio.id as string)?.id ?? null,
      invoiceDocNo: invoiceByFolio.get(folio.id as string)?.docNo ?? null,
    });
  }

  rows.sort((a, b) => {
    if (b.dueBtn !== a.dueBtn) return b.dueBtn - a.dueBtn;
    return a.guestName.localeCompare(b.guestName);
  });
  return rows;
}

export async function loadCashierStrip(
  admin: Admin,
  propertyId: string,
): Promise<CashierStrip> {
  const today = thimphuToday();
  const { fromIso, toIso } = thimphuDayBounds(today);
  const [unpaid, openCount, payments, invoiceCount] = await Promise.all([
    loadUnpaidBills(admin, { propertyId, filter: "all" }),
    admin
      .from("folios")
      .select("id", { count: "exact", head: true })
      .eq("property_id", propertyId)
      .eq("status", "open"),
    admin
      .from("payments")
      .select("amount_btn, method")
      .eq("property_id", propertyId)
      .gte("created_at", fromIso)
      .lt("created_at", toIso)
      .limit(2000),
    admin
      .from("fiscal_documents")
      .select("id", { count: "exact", head: true })
      .eq("property_id", propertyId)
      .eq("doc_kind", "invoice")
      .in("status", ["issued", "sent"])
      .gte("issued_at", fromIso)
      .lt("issued_at", toIso),
  ]);

  let cashBtn = 0;
  let bankBtn = 0;
  let qrBtn = 0;
  let otherBtn = 0;
  for (const payment of payments.data ?? []) {
    const amount = Number(payment.amount_btn ?? 0);
    const bucket = bucketTender(payment.method as string | null);
    if (bucket === "cash") cashBtn += amount;
    else if (bucket === "bank") bankBtn += amount;
    else if (bucket === "qr") qrBtn += amount;
    else otherBtn += amount;
  }

  return {
    toCollectBtn: unpaid.totals.totalDue,
    openFolios: openCount.count ?? 0,
    cashBtn,
    bankBtn,
    qrBtn,
    otherBtn,
    takenTodayBtn: cashBtn + bankBtn + qrBtn + otherBtn,
    invoicesToday: invoiceCount.count ?? 0,
  };
}
