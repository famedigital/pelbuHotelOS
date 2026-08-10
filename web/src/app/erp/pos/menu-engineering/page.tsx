import { FnbSectionHeader } from "@/components/erp/fnb/FnbSectionHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { buildMenuEngineering } from "@/lib/fnb/menu-engineering";
import { formatBtn } from "@/lib/pricing";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function MenuEngineeringPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const params = await searchParams;
  const to = params.to || new Date().toISOString().slice(0, 10);
  const from =
    params.from ||
    new Date(Date.now() - 30 * 86_400_000).toISOString().slice(0, 10);
  const rows = await buildMenuEngineering(
    `${from}T00:00:00+06:00`,
    `${to}T23:59:59.999+06:00`,
  );

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4">
      <FnbSectionHeader
        title="Menu engineering"
        description={`${from} → ${to} · stars = high pop + high margin. Wire recipe costs under Menu stock for full classes.`}
      />
      <Link href="/erp/menu" className="text-sm text-muted-foreground">
        ← Menu
      </Link>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Items</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="py-2 pr-2">Item</th>
                <th className="py-2 pr-2">Outlet</th>
                <th className="py-2 pr-2">Qty</th>
                <th className="py-2 pr-2">Sales</th>
                <th className="py-2 pr-2">Margin</th>
                <th className="py-2">Class</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.menuItemId} className="border-b border-border/50">
                  <td className="py-2 pr-2 font-medium">{r.name}</td>
                  <td className="py-2 pr-2 capitalize">{r.outlet}</td>
                  <td className="py-2 pr-2 tabular-nums">{r.qtySold}</td>
                  <td className="py-2 pr-2 tabular-nums">
                    {formatBtn(r.salesBtn)}
                  </td>
                  <td className="py-2 pr-2 tabular-nums">
                    {r.marginBtn != null ? formatBtn(r.marginBtn) : "—"}
                    {r.marginPct != null ? ` (${r.marginPct}%)` : ""}
                  </td>
                  <td className="py-2 capitalize">{r.class}</td>
                </tr>
              ))}
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-6 text-muted-foreground">
                    No settled sales in range.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
