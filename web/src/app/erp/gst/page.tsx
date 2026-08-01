import { DeskListShell } from "@/components/erp/DeskListShell";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { isDeskAuthenticated } from "@/lib/desk-auth";
import { requireDeskPropertyId } from "@/lib/erp-lists";
import { formatBtn } from "@/lib/pricing";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";

export const metadata = {
  title: "GST returns | Pelbu OS",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

export default async function GstReturnsPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  if (!(await isDeskAuthenticated())) redirect("/erp/login");
  const { month } = await searchParams;
  const now = new Date();
  const ym =
    month && /^\d{4}-\d{2}$/.test(month)
      ? month
      : `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const [y, m] = ym.split("-").map(Number);
  const from = new Date(Date.UTC(y, m - 1, 1)).toISOString();
  const to = new Date(Date.UTC(y, m, 1)).toISOString();

  const admin = createSupabaseAdminClient();
  const propertyId = await requireDeskPropertyId();

  const { data: lines } = await admin
    .from("folio_lines")
    .select(
      "amount_btn, gst_btn, total_btn, gst_applicable, status, created_at, folios!inner(property_id)",
    )
    .eq("folios.property_id", propertyId)
    .eq("status", "posted")
    .gte("created_at", from)
    .lt("created_at", to)
    .limit(5000);

  let taxable = 0;
  let exempt = 0;
  let gst = 0;
  let gross = 0;
  for (const l of lines ?? []) {
    const amt = Number(l.amount_btn ?? 0);
    const g = Number(l.gst_btn ?? 0);
    const t = Number(l.total_btn ?? 0);
    gross += t;
    gst += g;
    if (l.gst_applicable) taxable += amt;
    else exempt += amt;
  }

  const byRate = new Map<string, { base: number; gst: number; lines: number }>();
  for (const l of lines ?? []) {
    if (!l.gst_applicable) continue;
    const base = Number(l.amount_btn ?? 0);
    const g = Number(l.gst_btn ?? 0);
    const rate =
      base > 0 ? `${Math.round((g / base) * 1000) / 10}%` : "0%";
    const cur = byRate.get(rate) ?? { base: 0, gst: 0, lines: 0 };
    cur.base += base;
    cur.gst += g;
    cur.lines += 1;
    byRate.set(rate, cur);
  }

  return (
    <DeskListShell
      eyebrow="Compliance"
      heading={`GST returns · ${ym}`}
      blurb="DRC-oriented monthly summary from posted folio lines. Download fiscal filing CSV with doc numbers via GST filing export."
      filters={
        <form
          className="flex flex-wrap items-end gap-2"
          action="/erp/gst"
          method="get"
        >
          <div className="space-y-1.5">
            <Label htmlFor="month" className="text-xs text-muted-foreground">
              Month
            </Label>
            <Input
              id="month"
              type="month"
              name="month"
              defaultValue={ym}
              className="h-10 w-44"
            />
          </div>
          <Button type="submit" variant="outline" className="h-10">
            Apply
          </Button>
          <Button asChild variant="outline" className="h-10">
            <a
              href={`/api/erp/export?kind=gst_filing&since=${ym}-01`}
            >
              GST filing CSV
            </a>
          </Button>
        </form>
      }
    >
      <div className="grid gap-3 sm:grid-cols-4">
        {[
          ["Taxable base", formatBtn(taxable)],
          ["Exempt base", formatBtn(exempt)],
          ["GST collected", formatBtn(gst)],
          ["Gross", formatBtn(gross)],
        ].map(([label, val]) => (
          <Card key={label} className="gap-2 py-4">
            <CardContent>
              <p className="text-[11px] font-semibold tracking-[0.18em] text-accent uppercase">
                {label}
              </p>
              <p className="mt-2 text-xl font-semibold tabular-nums text-foreground">
                {val}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="space-y-3 md:hidden">
        {[...byRate.entries()].length === 0 ? (
          <p className="rounded-xl border bg-card px-4 py-6 text-sm text-muted-foreground">
            No taxable lines this month.
          </p>
        ) : (
          [...byRate.entries()].map(([rate, value]) => (
            <article key={rate} className="rounded-xl border bg-card p-4">
              <div className="flex items-center justify-between gap-3">
                <p className="font-semibold text-foreground">{rate} GST</p>
                <span className="text-xs text-muted-foreground">
                  {value.lines} {value.lines === 1 ? "line" : "lines"}
                </span>
              </div>
              <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
                <div>
                  <dt className="text-xs text-muted-foreground">Taxable base</dt>
                  <dd className="mt-1 font-medium tabular-nums">
                    {formatBtn(value.base)}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">GST</dt>
                  <dd className="mt-1 font-medium tabular-nums">
                    {formatBtn(value.gst)}
                  </dd>
                </div>
              </dl>
            </article>
          ))
        )}
      </div>
      <div className="hidden overflow-hidden rounded-lg border bg-card md:block">
        <table className="min-w-[480px] w-full text-sm">
          <caption className="sr-only">By GST rate</caption>
          <thead className="bg-muted/40">
            <tr className="hover:bg-transparent">
              {["Rate", "Lines", "Base", "GST"].map((h) => (
                <th
                  key={h}
                  scope="col"
                  className="h-10 px-3 text-left text-xs font-semibold tracking-wide text-muted-foreground uppercase"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[...byRate.entries()].length === 0 ? (
              <tr>
                <td colSpan={4} className="px-3 py-6 text-muted-foreground">
                  No taxable lines this month.
                </td>
              </tr>
            ) : (
              [...byRate.entries()].map(([rate, v]) => (
                <tr key={rate} className="border-t">
                  <td className="px-3 py-2.5 font-medium text-foreground">{rate}</td>
                  <td className="px-3 py-2.5 tabular-nums">{v.lines}</td>
                  <td className="px-3 py-2.5 tabular-nums">{formatBtn(v.base)}</td>
                  <td className="px-3 py-2.5 tabular-nums">{formatBtn(v.gst)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </DeskListShell>
  );
}
