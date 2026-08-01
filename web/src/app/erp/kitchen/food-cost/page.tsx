import { DeskListShell } from "@/components/erp/DeskListShell";
import { computeFoodCostPeriod } from "@/lib/kitchen/food-cost";
import { isDeskAuthenticated } from "@/lib/desk-auth";
import { requireDeskPropertyId, thimphuToday } from "@/lib/erp-lists";
import { formatBtn } from "@/lib/pricing";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import Link from "next/link";
import { redirect } from "next/navigation";

export const metadata = {
  title: "Food cost | Pelbu OS",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

type Props = {
  searchParams: Promise<{ from?: string; to?: string }>;
};

function monthStart(today: string): string {
  return `${today.slice(0, 7)}-01`;
}

export default async function FoodCostPage({ searchParams }: Props) {
  if (!(await isDeskAuthenticated())) redirect("/erp/login");

  const sp = await searchParams;
  const admin = createSupabaseAdminClient();
  const propertyId = await requireDeskPropertyId();
  const today = thimphuToday();
  const defaultFrom = monthStart(today);
  const from =
    sp.from && /^\d{4}-\d{2}-\d{2}$/.test(sp.from) ? sp.from : defaultFrom;
  const to = sp.to && /^\d{4}-\d{2}-\d{2}$/.test(sp.to) ? sp.to : today;

  const period = await computeFoodCostPeriod(admin, propertyId, from, to);

  const rows = [
    {
      label: "Opening inventory",
      value: formatBtn(period.openingBtn),
      note: period.openingSource === "audit" ? "From posted audit" : "Estimated",
    },
    {
      label: "Purchases (receive)",
      value: formatBtn(period.purchasesBtn),
      note: "F&B categories in period",
    },
    {
      label: "Closing inventory",
      value: formatBtn(period.closingBtn),
      note: period.closingSource === "audit" ? "From posted audit" : "Estimated",
    },
    {
      label: "COGS (open + purchases − close)",
      value: formatBtn(period.cogsBtn),
      note: "Cost of goods sold",
    },
    {
      label: "F&B POS sales",
      value: formatBtn(period.fnbSalesBtn),
      note: "Non-cancelled orders",
    },
    {
      label: "Food cost pct",
      value: String(period.foodCostPct) + "%",
      note: "COGS / F&B sales",
    },
  ];

  return (
    <DeskListShell
      eyebrow="Kitchen"
      heading="Food cost worksheet"
      blurb="COGS = opening inventory + purchases - closing inventory. Food cost pct = COGS / F&B sales."
      filters={
        <div className="flex flex-wrap items-end gap-2">
          <form className="flex flex-wrap items-end gap-2" action="/erp/kitchen/food-cost" method="get">
            <label className="text-xs text-muted-foreground">
              From
              <input
                type="date"
                name="from"
                defaultValue={from}
                className="ml-1 h-9 rounded-md border px-2 text-sm"
              />
            </label>
            <label className="text-xs text-muted-foreground">
              To
              <input
                type="date"
                name="to"
                defaultValue={to}
                className="ml-1 h-9 rounded-md border px-2 text-sm"
              />
            </label>
            <button
              type="submit"
              className="inline-flex h-9 items-center rounded-md border px-3 text-xs hover:bg-muted"
            >
              Apply
            </button>
          </form>
          <Link
            href="/erp/kitchen"
            className="inline-flex h-9 items-center rounded-md border px-3 text-xs hover:bg-muted"
          >
            Kitchen board
          </Link>
          <Link
            href="/erp/inventory/audits"
            className="inline-flex h-9 items-center rounded-md border px-3 text-xs hover:bg-muted"
          >
            Stock audits
          </Link>
        </div>
      }
    >
      <div className="overflow-x-auto rounded-lg border bg-card">
        <table className="w-full min-w-[480px] text-left text-sm">
          <thead className="border-b bg-muted/40 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
            <tr>
              <th className="px-4 py-3">Line</th>
              <th className="px-4 py-3 text-right">Amount</th>
              <th className="px-4 py-3">Source</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {rows.map((row) => (
              <tr key={row.label}>
                <td className="px-4 py-3 font-medium">{row.label}</td>
                <td className="px-4 py-3 text-right tabular-nums">{row.value}</td>
                <td className="px-4 py-3 text-muted-foreground">{row.note}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-4 text-xs text-muted-foreground">
        Post stock audits on{" "}
        <Link href="/erp/inventory/audits" className="text-accent underline-offset-4 hover:underline">
          Inventory → Audits
        </Link>{" "}
        to improve opening/closing accuracy. Purchases come from receive movements on produce,
        meat, dairy, dry, and beverage SKUs.
      </p>
    </DeskListShell>
  );
}
