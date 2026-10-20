import { InvoicesDesk, type InvoiceDeskRow } from "@/components/erp/bills/InvoicesDesk";
import { requireDeskPropertyId } from "@/lib/desk-property";
import {
  guestVisibleBalanceLines,
  netFolioBalance,
} from "@/lib/folio/balance";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function BillsInvoicesPanel({
  fromRaw,
  toRaw,
}: {
  fromRaw?: string;
  toRaw?: string;
} = {}) {
  const admin = createSupabaseAdminClient();
  const propertyId = await requireDeskPropertyId();

  const { data: docs } = await admin
    .from("fiscal_documents")
    .select(
      `id, doc_no, status, issued_at, folio_id,
       folios(
         id, label, status, booking_id,
         folio_lines(id, total_btn, gst_btn, status, source_type, reverses_line_id),
         bookings(
           contact_name, meal_plan_code, guide_number,
           agents(company_name),
           room_assignments(rooms(code))
         )
       )`,
    )
    .eq("property_id", propertyId)
    .eq("doc_kind", "invoice")
    .in("status", ["issued", "superseded"])
    .order("issued_at", { ascending: false })
    .limit(200);

  const rows: InvoiceDeskRow[] = (docs ?? []).map((doc) => {
    const rawFolio = doc.folios;
    const folio = (Array.isArray(rawFolio) ? rawFolio[0] : rawFolio) as {
      id: string;
      label: string;
      status: string;
      booking_id: string | null;
      folio_lines: {
        id?: string;
        total_btn: number;
        gst_btn: number;
        status: string;
        source_type?: string;
        reverses_line_id?: string | null;
      }[] | null;
      bookings:
        | {
            contact_name?: string | null;
            meal_plan_code?: string | null;
            guide_number?: string | null;
            agents?: { company_name?: string } | { company_name?: string }[] | null;
            room_assignments?:
              | { rooms?: { code?: string } | { code?: string }[] | null }[]
              | null;
          }
        | {
            contact_name?: string | null;
            meal_plan_code?: string | null;
            guide_number?: string | null;
            agents?: { company_name?: string } | { company_name?: string }[] | null;
            room_assignments?:
              | { rooms?: { code?: string } | { code?: string }[] | null }[]
              | null;
          }[]
        | null;
    } | null;

    const bookingRaw = folio?.bookings;
    const booking = Array.isArray(bookingRaw) ? bookingRaw[0] : bookingRaw;
    const agentRaw = booking?.agents;
    const agent = Array.isArray(agentRaw) ? agentRaw[0] : agentRaw;
    const rooms = (booking?.room_assignments ?? [])
      .map((a) => {
        const r = a.rooms;
        const room = Array.isArray(r) ? r[0] : r;
        return room?.code;
      })
      .filter(Boolean)
      .join(", ");

    const lines = folio?.folio_lines ?? [];
    const visible = guestVisibleBalanceLines(
      lines.map((l, i) => ({
        ...l,
        id: l.id ?? String(i),
      })),
    );
    const charges = visible.filter((l) => {
      const source = (l.source_type ?? "").toLowerCase();
      return source !== "payment" && source !== "deposit";
    });
    const total = charges.reduce((s, l) => s + Number(l.total_btn), 0);
    const balance = netFolioBalance(
      lines.map((l, i) => ({
        id: l.id ?? String(i),
        status: l.status,
        total_btn: Number(l.total_btn),
        reverses_line_id: l.reverses_line_id ?? null,
      })),
    );
    const issuedAt = doc.issued_at as string | null;
    return {
      id: doc.id as string,
      docNo: (doc.doc_no as string) ?? "—",
      status: (doc.status as string) ?? "issued",
      issuedAt,
      issueDate: issuedAt ? issuedAt.slice(0, 10) : "",
      folioId: (doc.folio_id as string) ?? folio?.id ?? null,
      label: folio?.label ?? "—",
      bookingId: folio?.booking_id ?? null,
      agentName: agent?.company_name ?? null,
      guestName: booking?.contact_name ?? null,
      guideNumber: booking?.guide_number ?? null,
      mealPlan: booking?.meal_plan_code ?? null,
      roomsLabel: rooms || null,
      total,
      balance,
      unpaid: folio?.status === "open" && Math.abs(balance) > 0.009,
    };
  });

  return (
    <InvoicesDesk rows={rows} fromDefault={fromRaw} toDefault={toRaw} />
  );
}
