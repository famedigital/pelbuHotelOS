import {
  ExportButtons,
  FinanceKpi,
  FinanceShell,
} from "@/components/erp/finance/FinanceShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { isDeskAuthenticated } from "@/lib/desk-auth";
import { formatBtn } from "@/lib/pricing";
import { resolveActivePropertyId } from "@/lib/property-context";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Finance · Income | Pelbu OS",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

function monthStart() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

export default async function FinanceIncomePage() {
  if (!(await isDeskAuthenticated())) redirect("/erp/login");
  const admin = createSupabaseAdminClient();
  const propertyId = await resolveActivePropertyId(admin);
  const from = monthStart();
  const to = new Date().toISOString().slice(0, 10);

  const [{ data: payments }, { data: folios }] = await Promise.all([
    admin
      .from("payments")
      .select("id, amount_btn, method, kind, reference, created_at, folio_id")
      .eq("property_id", propertyId)
      .gte("created_at", from)
      .order("created_at", { ascending: false })
      .limit(200),
    admin
      .from("folios")
      .select(
        "id, folio_lines(id, source_type, description, total_btn, gst_btn, status, created_at)",
      )
      .eq("property_id", propertyId)
      .limit(300),
  ]);

  const lines = (folios ?? []).flatMap((f) => {
    const rows =
      (f.folio_lines as
        | {
            id: string;
            source_type: string;
            description: string | null;
            total_btn: number;
            gst_btn: number;
            status: string;
            created_at: string;
          }[]
        | null) ?? [];
    return rows
      .filter(
        (l) =>
          l.status === "posted" &&
          String(l.created_at) >= from &&
          !["payment", "deposit", "adjustment"].includes(l.source_type),
      )
      .map((l) => ({ ...l, folio_id: f.id as string }));
  });

  const salesTotal = lines.reduce((s, l) => s + Number(l.total_btn), 0);
  const receiptsTotal = (payments ?? []).reduce(
    (s, p) => s + Number(p.amount_btn),
    0,
  );

  return (
    <FinanceShell
      title="Income register"
      description="Posted folio sales and guest receipts for the selected month."
      actions={<ExportButtons report="income" from={from} to={to} />}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <FinanceKpi label="Sales posted" value={formatBtn(salesTotal)} />
        <FinanceKpi label="Receipts collected" value={formatBtn(receiptsTotal)} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Sales lines</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs text-muted-foreground">
                <th className="py-2 pr-3">Date</th>
                <th className="py-2 pr-3">Type</th>
                <th className="py-2 pr-3">Description</th>
                <th className="py-2 pr-3 text-right">GST</th>
                <th className="py-2 text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {lines.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-6 text-muted-foreground">
                    No posted sales this month.
                  </td>
                </tr>
              ) : (
                lines.slice(0, 100).map((line) => (
                  <tr key={line.id} className="border-b last:border-0">
                    <td className="py-2 pr-3 tabular-nums">
                      {String(line.created_at).slice(0, 10)}
                    </td>
                    <td className="py-2 pr-3">{line.source_type}</td>
                    <td className="py-2 pr-3">{line.description}</td>
                    <td className="py-2 pr-3 text-right tabular-nums">
                      {formatBtn(Number(line.gst_btn))}
                    </td>
                    <td className="py-2 text-right tabular-nums">
                      {formatBtn(Number(line.total_btn))}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Receipts</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs text-muted-foreground">
                <th className="py-2 pr-3">Date</th>
                <th className="py-2 pr-3">Method</th>
                <th className="py-2 pr-3">Kind</th>
                <th className="py-2 pr-3">Reference</th>
                <th className="py-2 text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {(payments ?? []).map((p) => (
                <tr key={p.id as string} className="border-b last:border-0">
                  <td className="py-2 pr-3 tabular-nums">
                    {String(p.created_at).slice(0, 10)}
                  </td>
                  <td className="py-2 pr-3">{p.method as string}</td>
                  <td className="py-2 pr-3">{(p.kind as string) ?? "settlement"}</td>
                  <td className="py-2 pr-3">{(p.reference as string) ?? "—"}</td>
                  <td className="py-2 text-right tabular-nums">
                    {formatBtn(Number(p.amount_btn))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </FinanceShell>
  );
}
