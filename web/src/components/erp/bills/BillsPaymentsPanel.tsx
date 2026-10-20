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
import { thimphuToday } from "@/lib/erp-lists";
import { formatBtn } from "@/lib/pricing";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import Link from "next/link";

function shiftDays(iso: string, days: number): string {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
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
      : shiftDays(to, -30);

  const fromIso = `${from}T00:00:00.000Z`;
  const toEnd = new Date(`${to}T12:00:00Z`);
  toEnd.setUTCDate(toEnd.getUTCDate() + 1);
  const toIso = toEnd.toISOString();

  const { data: payments } = await admin
    .from("payments")
    .select("id, amount_btn, method, kind, reference, created_at, folio_id")
    .eq("property_id", propertyId)
    .gte("created_at", fromIso)
    .lt("created_at", toIso)
    .order("created_at", { ascending: false })
    .limit(120);

  const rows = payments ?? [];

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
                <TableHead>When</TableHead>
                <TableHead>Method</TableHead>
                <TableHead>Kind</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead className="text-right">Bill</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((p) => (
                <TableRow key={p.id as string} className="h-11">
                  <TableCell className="text-sm text-muted-foreground">
                    {p.created_at
                      ? new Date(p.created_at as string).toLocaleString([], {
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })
                      : "—"}
                  </TableCell>
                  <TableCell className="capitalize">
                    {(p.method as string) ?? "—"}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {(p.kind as string) ?? "—"}
                  </TableCell>
                  <TableCell className="text-right font-medium tabular-nums">
                    {formatBtn(Number(p.amount_btn ?? 0))}
                  </TableCell>
                  <TableCell className="text-right">
                    {p.folio_id ? (
                      <Button asChild variant="ghost" size="sm" className="h-8">
                        <Link href={`/erp/folios/${p.folio_id as string}`}>
                          Open
                        </Link>
                      </Button>
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
