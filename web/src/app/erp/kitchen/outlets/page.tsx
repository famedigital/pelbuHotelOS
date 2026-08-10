import { FnbSectionHeader } from "@/components/erp/fnb/FnbSectionHeader";
import { Card, CardContent } from "@/components/ui/card";
import { buildChainOutletFlash } from "@/lib/fnb/chain-outlet-flash";
import { formatBtn } from "@/lib/pricing";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function ChainOutletFlashPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const params = await searchParams;
  const flash = await buildChainOutletFlash(params.date);

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-4">
      <FnbSectionHeader
        title="Outlet rollup"
        description={`${flash.propertyName} · ${flash.businessDate}. Same-tenant multi-hotel rollup uses property switcher + this view per site (chain board next when multi-property dashboards ship).`}
      />
      <Link href="/erp/kitchen/day-pack" className="text-sm text-muted-foreground">
        ← Day pack
      </Link>
      <div className="grid gap-3 sm:grid-cols-2">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Total sales</p>
            <p className="text-2xl font-semibold tabular-nums">
              {formatBtn(flash.salesTotalBtn)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Covers</p>
            <p className="text-2xl font-semibold tabular-nums">{flash.covers}</p>
          </CardContent>
        </Card>
      </div>
      <Card>
        <CardContent className="space-y-2 p-4">
          {flash.outlets.map((o) => (
            <div
              key={o.outlet}
              className="flex justify-between text-sm border-b border-border/40 py-2"
            >
              <span className="capitalize">{o.outlet}</span>
              <span className="tabular-nums">
                {o.tickets} · {formatBtn(o.salesBtn)}
              </span>
            </div>
          ))}
          {flash.outlets.length === 0 ? (
            <p className="text-sm text-muted-foreground">No sales today.</p>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
