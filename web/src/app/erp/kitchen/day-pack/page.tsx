import { FnbSectionHeader } from "@/components/erp/fnb/FnbSectionHeader";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { buildRestaurantDayPack } from "@/lib/fnb/restaurant-day-pack";
import { formatBtn } from "@/lib/pricing";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function RestaurantDayPackPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const params = await searchParams;
  const pack = await buildRestaurantDayPack(params.date);

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-4 print:p-2">
      <FnbSectionHeader
        title="Restaurant day pack"
        description={`Business day ${pack.businessDate} · operational flash (not full P&L). Ledger books stay under Finance reports.`}
      />

      <div className="flex flex-wrap gap-2 print:hidden">
        <Link
          href={`/erp/kitchen/day-pack?date=${pack.businessDate}`}
          className="text-sm text-accent underline"
        >
          Refresh
        </Link>
        <button
          type="button"
          className="text-sm text-accent underline"
          // client print via link is enough in browser with window not available SSR
        >
          Use browser Print for X/Z handoff
        </button>
        <Link href="/erp/kitchen" className="text-sm text-muted-foreground">
          ← Kitchen board
        </Link>
        <Link
          href="/erp/night-audit"
          className="text-sm text-muted-foreground"
        >
          Night audit
        </Link>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label="Sales" value={formatBtn(pack.salesTotalBtn)} />
        <Kpi label="Tickets" value={String(pack.ticketCount)} />
        <Kpi label="Covers" value={String(pack.covers)} />
        <Kpi label="Avg check" value={formatBtn(pack.avgCheckBtn)} />
        <Kpi label="Voids" value={`${pack.voidCount} · ${formatBtn(pack.voidTotalBtn)}`} />
        <Kpi label="Open KOTs" value={String(pack.openKotCount)} />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">By outlet</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {pack.byOutlet.length === 0 ? (
              <p className="text-sm text-muted-foreground">No settled sales.</p>
            ) : (
              pack.byOutlet.map((row) => (
                <div
                  key={row.outlet}
                  className="flex items-center justify-between text-sm"
                >
                  <span className="capitalize">{row.outlet}</span>
                  <span className="tabular-nums">
                    {row.tickets} · {formatBtn(row.salesBtn)}
                  </span>
                </div>
              ))
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">By tender</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {pack.byTender.length === 0 ? (
              <p className="text-sm text-muted-foreground">No tenders yet.</p>
            ) : (
              pack.byTender.map((row) => (
                <div
                  key={row.method}
                  className="flex items-center justify-between text-sm"
                >
                  <span>{row.label}</span>
                  <span className="tabular-nums">{formatBtn(row.amountBtn)}</span>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="print:border-black">
        <CardHeader>
          <CardTitle className="text-base">Cashier sign-off</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <p>
            POS shift X/Z-report is on{" "}
            <Link href="/erp/pos" className="underline">
              POS → Closing
            </Link>
            . Night audit continues to own hotel day roll. This pack is F&amp;B
            flash only.
          </p>
          <div className="grid gap-6 sm:grid-cols-2">
            <div className="border-t pt-8">Cashier: ________________</div>
            <div className="border-t pt-8">Manager: ________________</div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardContent className="space-y-1 p-4">
        <p className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
          {label}
        </p>
        <p className="text-lg font-semibold tabular-nums">{value}</p>
      </CardContent>
    </Card>
  );
}
