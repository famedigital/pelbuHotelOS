import {
  DeskListShell,
  DeskSearchForm,
  DeskTable,
} from "@/components/erp/DeskListShell";
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

  // Bhutan rooms GST often 10%; F&B may differ — bucket by implied rate
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
      title="GST"
      eyebrow="Compliance"
      heading={`GST returns Â· ${ym}`}
      blurb="DRC-oriented monthly summary from posted folio lines. Export via /api/erp/export?kind=folio_lines for the same window."
      filters={
        <DeskSearchForm action="/erp/gst" q="" placeholder="">
          <label className="block text-sm text-espresso">
            Month
            <input
              type="month"
              name="month"
              defaultValue={ym}
              className="mt-1 block min-h-11 rounded-sm border border-espresso/15 bg-white px-3 text-sm"
            />
          </label>
        </DeskSearchForm>
      }
    >
      <div className="grid gap-3 sm:grid-cols-4">
        {[
          ["Taxable base", formatBtn(taxable)],
          ["Exempt base", formatBtn(exempt)],
          ["GST collected", formatBtn(gst)],
          ["Gross", formatBtn(gross)],
        ].map(([label, val]) => (
          <div key={label} className="border border-espresso/10 bg-white px-4 py-4">
            <p className="text-[11px] font-semibold tracking-[0.18em] text-gold uppercase">
              {label}
            </p>
            <p className="mt-2 text-xl tabular-nums text-espresso">{val}</p>
          </div>
        ))}
      </div>

      <DeskTable caption="By GST rate" headers={["Rate", "Lines", "Base", "GST"]}>
        {[...byRate.entries()].length === 0 ? (
          <tr>
            <td colSpan={4} className="px-3 py-6 text-muted-foreground">
              No taxable lines this month.
            </td>
          </tr>
        ) : (
          [...byRate.entries()].map(([rate, v]) => (
            <tr key={rate} className="border-t border-espresso/10">
              <td className="px-3 py-2.5 font-medium">{rate}</td>
              <td className="px-3 py-2.5 tabular-nums">{v.lines}</td>
              <td className="px-3 py-2.5 tabular-nums">{formatBtn(v.base)}</td>
              <td className="px-3 py-2.5 tabular-nums">{formatBtn(v.gst)}</td>
            </tr>
          ))
        )}
      </DeskTable>
    </DeskListShell>
  );
}
