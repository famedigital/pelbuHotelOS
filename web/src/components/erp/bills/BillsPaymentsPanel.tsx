import { DeskMetricRow } from "@/components/erp/DeskMetricRow";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyState } from "@/components/ui/empty-state";
import { requireDeskPropertyId } from "@/lib/desk-property";
import { bucketTender } from "@/lib/erp/cashier-desk-math";
import { thimphuDayBounds } from "@/lib/erp/cashier-desk";
import { thimphuDateOffset, thimphuToday } from "@/lib/erp-lists";
import { foTenderLabel } from "@/lib/folio/fo-settlement";
import { stayFolioHref } from "@/lib/folio/stay-hub-cycle";
import { formatBtn } from "@/lib/pricing";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import Link from "next/link";

function one<T>(raw: T | T[] | null | undefined): T | null {
  if (raw == null) return null;
  return Array.isArray(raw) ? (raw[0] ?? null) : raw;
}

export async function BillsPaymentsPanel({
  fromRaw,
  toRaw,
}: {
  fromRaw?: string;
  toRaw?: string;
}) {
  const admin = createSupabaseAdminClient();
  const propertyId = await requireDeskPropertyId();
  const today = thimphuToday();
  const to = toRaw && /^\d{4}-\d{2}-\d{2}$/.test(toRaw) ? toRaw : today;
  const from =
    fromRaw && /^\d{4}-\d{2}-\d{2}$/.test(fromRaw)
      ? fromRaw
      : thimphuDateOffset(to, -30);

  const { fromIso } = thimphuDayBounds(from);
  const { toIso } = thimphuDayBounds(to);

  const { data: payments } = await admin
    .from("payments")
    .select(
      `id, amount_btn, method, kind, reference, created_at, folio_id,
       folios(
         label,
         bookings(
           id, contact_name, confirmation_code,
           room_assignments(room_units(label))
         )
       )`,
    )
    .eq("property_id", propertyId)
    .gte("created_at", fromIso)
    .lt("created_at", toIso)
    .order("created_at", { ascending: false })
    .limit(200);

  const rows = (payments ?? []).map((payment) => {
    const folio = one(
      payment.folios as
        | {
            label?: string | null;
            bookings?:
              | {
                  id?: string;
                  contact_name?: string | null;
                  confirmation_code?: string | null;
                  room_assignments?:
                    | {
                        room_units?:
                          | { label?: string | null }
                          | { label?: string | null }[]
                          | null;
                      }[]
                    | null;
                }
              | {
                  id?: string;
                  contact_name?: string | null;
                  confirmation_code?: string | null;
                  room_assignments?:
                    | {
                        room_units?:
                          | { label?: string | null }
                          | { label?: string | null }[]
                          | null;
                      }[]
                    | null;
                }[]
              | null;
          }
        | null,
    );
    const booking = one(folio?.bookings ?? null);
    const rooms = [
      ...new Set(
        (booking?.room_assignments ?? [])
          .map((row) => one(row.room_units)?.label?.trim() || "")
          .filter(Boolean),
      ),
    ].join(", ");
    return {
      id: payment.id as string,
      createdAt: payment.created_at as string | null,
      method: (payment.method as string) ?? "",
      kind: (payment.kind as string | null) ?? null,
      reference: (payment.reference as string | null) ?? null,
      amountBtn: Number(payment.amount_btn ?? 0),
      folioId: (payment.folio_id as string | null) ?? null,
      bookingId: (booking?.id as string | undefined) ?? null,
      guestName:
        booking?.contact_name?.trim() || folio?.label?.trim() || null,
      confirmationCode: booking?.confirmation_code ?? null,
      rooms,
    };
  });

  const totals = { cash: 0, bank: 0, qr: 0, other: 0 };
  for (const row of rows) {
    totals[bucketTender(row.method)] += row.amountBtn;
  }
  const windowTotal = totals.cash + totals.bank + totals.qr + totals.other;

  return (
    <div className="flex flex-col gap-3">
      <form
        className="flex flex-wrap items-end gap-2"
        action="/erp/bills"
        method="get"
      >
        <input type="hidden" name="tab" value="payments" />
        <div className="space-y-0.5">
          <label htmlFor="pay-from" className="text-[10px] text-muted-foreground">
            From
          </label>
          <Input
            id="pay-from"
            name="from"
            type="date"
            defaultValue={from}
            className="h-9 w-[10.5rem]"
          />
        </div>
        <div className="space-y-0.5">
          <label htmlFor="pay-to" className="text-[10px] text-muted-foreground">
            To
          </label>
          <Input
            id="pay-to"
            name="to"
            type="date"
            defaultValue={to}
            className="h-9 w-[10.5rem]"
          />
        </div>
        <Button type="submit" variant="outline" size="sm" className="h-9">
          Show
        </Button>
      </form>

      <DeskMetricRow
        className="sm:grid-cols-5"
        metrics={[
          { label: "Cash", value: formatBtn(totals.cash) },
          { label: "Bank", value: formatBtn(totals.bank) },
          { label: "QR", value: formatBtn(totals.qr) },
          { label: "Other", value: formatBtn(totals.other) },
          { label: "In this window", value: formatBtn(windowTotal) },
        ]}
      />

      {rows.length === 0 ? (
        <EmptyState
          title="No payments in range"
          description="Cash, bank, and QR in this date window will show here. Collect from Who owes or open a folio."
          action={
            <Button asChild size="sm">
              <Link href="/erp/bills?tab=owes">Who owes</Link>
            </Button>
          }
        />
      ) : (
        <div className="overflow-x-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="h-8 text-[11px]">When</TableHead>
                <TableHead className="h-8 text-[11px]">Guest</TableHead>
                <TableHead className="h-8 text-[11px]">Rooms</TableHead>
                <TableHead className="h-8 text-[11px]">Method</TableHead>
                <TableHead className="h-8 text-[11px]">Reference</TableHead>
                <TableHead className="h-8 text-right text-[11px]">Amount</TableHead>
                <TableHead className="h-8 text-right text-[11px]"> </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((p) => (
                <TableRow key={p.id} className="h-11">
                  <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                    {p.createdAt
                      ? new Date(p.createdAt).toLocaleString([], {
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })
                      : "—"}
                  </TableCell>
                  <TableCell className="max-w-[12rem] text-xs">
                    <span className="font-medium">{p.guestName ?? "—"}</span>
                    {p.confirmationCode ? (
                      <span className="block truncate text-[10px] text-muted-foreground">
                        {p.confirmationCode}
                        {p.kind ? ` · ${p.kind}` : ""}
                      </span>
                    ) : null}
                  </TableCell>
                  <TableCell className="max-w-[7rem] truncate text-xs text-muted-foreground">
                    {p.rooms || "—"}
                  </TableCell>
                  <TableCell className="text-xs">
                    {foTenderLabel(p.method)}
                  </TableCell>
                  <TableCell className="max-w-[8rem] truncate text-xs text-muted-foreground">
                    {p.reference || "—"}
                  </TableCell>
                  <TableCell className="text-right text-xs font-medium tabular-nums">
                    {formatBtn(p.amountBtn)}
                  </TableCell>
                  <TableCell className="text-right">
                    {p.folioId ? (
                      <div className="flex justify-end gap-1">
                        <Button asChild variant="ghost" size="sm" className="h-8">
                          <Link href={stayFolioHref(p.bookingId, p.folioId)}>
                            Open
                          </Link>
                        </Button>
                        <Button asChild variant="outline" size="sm" className="h-8">
                          <Link href={`/erp/folios/${p.folioId}/receipt`}>
                            Receipt
                          </Link>
                        </Button>
                      </div>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <p className="px-2 py-1.5 text-xs text-muted-foreground">
            {rows.length} payment{rows.length === 1 ? "" : "s"} · {from} → {to}
          </p>
        </div>
      )}
    </div>
  );
}
