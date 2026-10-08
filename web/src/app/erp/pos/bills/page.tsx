import { DeskListShell } from "@/components/erp/DeskListShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { isDeskAuthenticated } from "@/lib/desk-auth";
import { requireDeskPropertyId } from "@/lib/desk-property";
import { thimphuToday } from "@/lib/erp-lists";
import { orderRef } from "@/lib/order-ref";
import { tenderMethodLabel } from "@/lib/pos-tenders";
import { formatBtn } from "@/lib/pricing";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";

export const metadata = {
  title: "POS bills",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

const PAGE_SIZE = 100;

function monthStart(today: string): string {
  return `${today.slice(0, 7)}-01`;
}

export default async function PosBillsPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; page?: string }>;
}) {
  if (!(await isDeskAuthenticated())) redirect("/erp/login");
  const sp = await searchParams;
  const today = thimphuToday();
  const from =
    sp.from && /^\d{4}-\d{2}-\d{2}$/.test(sp.from) ? sp.from : monthStart(today);
  const to = sp.to && /^\d{4}-\d{2}-\d{2}$/.test(sp.to) ? sp.to : today;
  const page = Math.max(1, Number(sp.page) || 1);
  const admin = createSupabaseAdminClient();
  const propertyId = await requireDeskPropertyId();
  const start = `${from}T00:00:00+06:00`;
  const end = `${to}T23:59:59.999+06:00`;
  const rangeFrom = (page - 1) * PAGE_SIZE;
  const rangeTo = rangeFrom + PAGE_SIZE;

  const { data } = await admin
    .from("orders")
    .select(
      "id, outlet, customer_name, total_btn, settled_at, voided_at, folio_id, order_tenders(method, amount_btn)",
    )
    .eq("property_id", propertyId)
    .not("settled_at", "is", null)
    .gte("settled_at", start)
    .lte("settled_at", end)
    .order("settled_at", { ascending: false })
    .range(rangeFrom, rangeTo);

  const fetched = data ?? [];
  const hasNext = fetched.length > PAGE_SIZE;
  const rows = hasNext ? fetched.slice(0, PAGE_SIZE) : fetched;

  const pageHref = (nextPage: number) => {
    const params = new URLSearchParams({ from, to });
    if (nextPage > 1) params.set("page", String(nextPage));
    return `/erp/pos/bills?${params.toString()}`;
  };

  return (
    <DeskListShell
      eyebrow="POS"
      heading="POS bills"
      blurb="Every settled ticket in this range: cash, card, QR, room charge, and agent credit. This is the guest bill. A tax invoice is issued later from the folio when the sale is charged to a room or an agent."
      filters={
        <form className="flex flex-wrap items-end gap-2" action="/erp/pos/bills" method="get">
          <div className="space-y-1.5">
            <label htmlFor="from" className="text-xs text-muted-foreground">
              From
            </label>
            <Input id="from" name="from" type="date" defaultValue={from} className="h-10" />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="to" className="text-xs text-muted-foreground">
              To
            </label>
            <Input id="to" name="to" type="date" defaultValue={to} className="h-10" />
          </div>
          <Button type="submit" variant="outline" className="h-10">
            Show
          </Button>
        </form>
      }
    >
      <p className="text-xs text-muted-foreground">
        {rows.length} on this page
        {page > 1 ? ` · page ${page}` : ""}
      </p>
      <div className="overflow-hidden rounded-lg border bg-card">
        <table className="min-w-[720px] w-full text-sm">
          <thead className="bg-muted/40">
            <tr>
              {["Bill", "When", "Outlet", "Guest", "Tenders", "Total", ""].map((h) => (
                <th
                  key={h}
                  className="h-10 px-3 text-left text-xs font-semibold tracking-wide text-muted-foreground uppercase"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-3 py-6 text-muted-foreground">
                  No settled POS bills in this range.
                </td>
              </tr>
            ) : (
              rows.map((row) => {
                const tenders =
                  (row.order_tenders as { method?: string; amount_btn?: number }[] | null) ??
                  [];
                const tenderText = tenders
                  .map(
                    (t) =>
                      `${tenderMethodLabel(t.method ?? "")} ${formatBtn(Number(t.amount_btn ?? 0))}`,
                  )
                  .join(" · ");
                return (
                  <tr key={row.id as string} className="border-t">
                    <td className="px-3 py-2.5 font-mono font-medium">
                      {orderRef(row.id as string)}
                      {row.voided_at ? (
                        <span className="ml-2 text-xs text-destructive">Void</span>
                      ) : null}
                    </td>
                    <td className="px-3 py-2.5 text-muted-foreground">
                      {String(row.settled_at).slice(0, 16).replace("T", " ")}
                    </td>
                    <td className="px-3 py-2.5 capitalize">{row.outlet as string}</td>
                    <td className="px-3 py-2.5">{(row.customer_name as string) || "Walk-in"}</td>
                    <td className="px-3 py-2.5 text-muted-foreground">
                      {tenderText || "—"}
                      {row.folio_id ? " · on folio" : ""}
                    </td>
                    <td className="px-3 py-2.5 font-medium tabular-nums">
                      {formatBtn(Number(row.total_btn ?? 0))}
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <a
                        href={`/erp/orders/${row.id as string}/receipt`}
                        className="text-sm font-medium text-accent underline-offset-4 hover:underline"
                      >
                        Receipt
                      </a>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
      {page > 1 || hasNext ? (
        <div className="flex items-center justify-between gap-3 text-sm">
          {page > 1 ? (
            <a href={pageHref(page - 1)} className="font-medium text-accent underline-offset-4 hover:underline">
              Newer bills
            </a>
          ) : (
            <span />
          )}
          {hasNext ? (
            <a href={pageHref(page + 1)} className="font-medium text-accent underline-offset-4 hover:underline">
              Older bills
            </a>
          ) : null}
        </div>
      ) : null}
    </DeskListShell>
  );
}
