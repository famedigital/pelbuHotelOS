import {
  ExportButtons,
  FinanceShell,
} from "@/components/erp/finance/FinanceShell";
import { GstBitsPackPanel } from "@/components/erp/finance/GstBitsPackPanel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { buildBitsGstPack } from "@/lib/gst/bits-pack";
import { isDeskAuthenticated } from "@/lib/desk-auth";
import { resolveActivePropertyId } from "@/lib/property-context";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Finance · GST",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

function defaultYm() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export default async function FinanceGstPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  if (!(await isDeskAuthenticated())) redirect("/erp/login");
  const { month } = await searchParams;
  const ym = month && /^\d{4}-\d{2}$/.test(month) ? month : defaultYm();

  const admin = createSupabaseAdminClient();
  const propertyId = await resolveActivePropertyId(admin);
  const pack = await buildBitsGstPack(admin, propertyId, ym);

  const [{ data: saved }, { data: statements }] = await Promise.all([
    admin
      .from("gst_return_packs")
      .select("status, bank_statement_id, filed_at")
      .eq("property_id", propertyId)
      .eq("period_month", pack.periodMonth)
      .maybeSingle(),
    admin
      .from("bank_statements")
      .select("id, bank_code, period_start, period_end, source_filename")
      .eq("property_id", propertyId)
      .order("created_at", { ascending: false })
      .limit(20),
  ]);

  const bankStatements = (statements ?? []).map((s) => ({
    id: s.id as string,
    label: `${(s.bank_code as string).toUpperCase()} · ${s.period_start ?? "?"} – ${s.period_end ?? "?"} · ${s.source_filename ?? "import"}`,
  }));

  const from = pack.periodMonth;
  const to = ym === defaultYm() ? new Date().toISOString().slice(0, 10) : pack.periodMonth;

  return (
    <FinanceShell
      title="GST / BITS month pack"
      description="Portal fields A–E from folio sales and expense input. Copy into BITS, attach bank stmt, mark filed."
      actions={
        <>
          <ExportButtons report="gst" from={from} to={to} />
          <Link
            href="/erp/gst"
            className="inline-flex h-9 items-center rounded-md border px-3 text-sm hover:bg-muted"
          >
            Classic view
          </Link>
        </>
      }
    >
      <form className="flex flex-wrap items-end gap-2" action="/erp/finance/gst" method="get">
        <div className="space-y-1.5">
          <Label htmlFor="month" className="text-xs text-muted-foreground">
            Month
          </Label>
          <Input id="month" type="month" name="month" defaultValue={ym} className="h-10 w-44" />
        </div>
        <Button type="submit" variant="outline" className="h-10">
          Apply
        </Button>
      </form>

      <GstBitsPackPanel
        pack={pack}
        savedStatus={(saved?.status as string | null) ?? null}
        bankStatements={bankStatements}
      />
    </FinanceShell>
  );
}
