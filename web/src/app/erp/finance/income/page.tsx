import {
  ExportButtons,
  FinanceKpi,
  FinanceShell,
} from "@/components/erp/finance/FinanceShell";
import {
  FinanceSearchField,
  MoneyRow,
  bucketFromSourceType,
} from "@/components/erp/finance/MoneyRow";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { isDeskAuthenticated } from "@/lib/desk-auth";
import { formatBtn } from "@/lib/pricing";
import { resolveActivePropertyId } from "@/lib/property-context";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Finance · Income",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

function monthStart() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

export default async function FinanceIncomePage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  if (!(await isDeskAuthenticated())) redirect("/erp/login");
  const { q } = await searchParams;
  const query = (q ?? "").trim().toLowerCase();
  const admin = createSupabaseAdminClient();
  const propertyId = await resolveActivePropertyId(admin);
  const from = monthStart();
  const to = new Date().toISOString().slice(0, 10);

  const [{ data: payments }, { data: folios }] = await Promise.all([
    admin
      .from("payments")
      .select(
        "id, amount_btn, method, kind, reference, notes, created_at, folio_id, confirmation_status",
      )
      .eq("property_id", propertyId)
      .gte("created_at", from)
      .order("created_at", { ascending: false })
      .limit(200),
    admin
      .from("folios")
      .select(
        "id, label, folio_lines(id, source_type, description, total_btn, gst_btn, status, created_at, bill_to)",
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
            bill_to?: string | null;
          }[]
        | null) ?? [];
    return rows
      .filter(
        (l) =>
          l.status === "posted" &&
          String(l.created_at) >= from &&
          !["payment", "deposit", "adjustment"].includes(l.source_type),
      )
      .map((l) => ({
        ...l,
        folio_id: f.id as string,
        folio_label: (f.label as string | null) ?? null,
      }));
  });

  const match = (hay: string) =>
    !query || hay.toLowerCase().includes(query);

  const salesFiltered = lines.filter((l) =>
    match(
      `${l.description ?? ""} ${l.source_type} ${l.total_btn} ${l.bill_to ?? ""}`,
    ),
  );
  const payFiltered = (payments ?? []).filter((p) =>
    match(
      `${p.method} ${p.kind} ${p.reference ?? ""} ${p.notes ?? ""} ${p.amount_btn}`,
    ),
  );

  const salesTotal = salesFiltered.reduce((s, l) => s + Number(l.total_btn), 0);
  const receiptsTotal = payFiltered.reduce(
    (s, p) => s + Number(p.amount_btn),
    0,
  );

  return (
    <FinanceShell
      title="Money in"
      description="Sales on folios (holding in AR until paid) and receipts into cash/bank. Search by amount, reference, or description."
      actions={<ExportButtons report="income" from={from} to={to} />}
    >
      <FinanceSearchField defaultValue={q} />

      <div className="grid gap-3 sm:grid-cols-2">
        <FinanceKpi label="Sales posted" value={formatBtn(salesTotal)} />
        <FinanceKpi
          label="Receipts collected"
          value={formatBtn(receiptsTotal)}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Sales lines (charges)</CardTitle>
        </CardHeader>
        <CardContent>
          {salesFiltered.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No posted sales this month.
            </p>
          ) : (
            <ul className="divide-y">
              {salesFiltered.slice(0, 100).map((line) => (
                <MoneyRow
                  key={line.id}
                  date={String(line.created_at).slice(0, 10)}
                  title={line.description ?? line.source_type}
                  amount={formatBtn(Number(line.total_btn))}
                  direction="hold"
                  bucket={bucketFromSourceType(line.source_type)}
                  state="posted"
                  trail={[
                    {
                      label: `Folio ${line.folio_id.slice(0, 8)}`,
                      href: `/erp/folios/${line.folio_id}`,
                    },
                    {
                      label:
                        line.bill_to === "agent" ? "Bill to agent" : "Bill to guest",
                    },
                  ]}
                  booksHref="/erp/finance/accounting"
                />
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Receipts (into hotel account)</CardTitle>
        </CardHeader>
        <CardContent>
          {payFiltered.length === 0 ? (
            <p className="text-sm text-muted-foreground">No receipts this month.</p>
          ) : (
            <ul className="divide-y">
              {payFiltered.map((p) => {
                const pending =
                  (p.confirmation_status as string) === "pending_bank";
                const kind = (p.kind as string) ?? "settlement";
                return (
                  <MoneyRow
                    key={p.id as string}
                    date={String(p.created_at).slice(0, 10)}
                    title={`${p.method as string} · ${kind}`}
                    amount={formatBtn(Number(p.amount_btn))}
                    direction={kind === "refund" ? "reversal" : "in"}
                    bucket={kind === "deposit" ? "deposit" : "other"}
                    state={pending ? "pending_bank" : "posted"}
                    trail={[
                      ...(p.folio_id
                        ? [
                            {
                              label: `Folio ${String(p.folio_id).slice(0, 8)}`,
                              href: `/erp/folios/${p.folio_id as string}`,
                            },
                          ]
                        : [{ label: "Walk-in / unattached" }]),
                      ...((p.reference as string | null)
                        ? [{ label: `Ref ${p.reference as string}` }]
                        : []),
                    ]}
                    booksHref="/erp/finance"
                  />
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </FinanceShell>
  );
}
