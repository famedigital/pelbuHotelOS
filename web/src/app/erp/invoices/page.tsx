import { DeskListShell } from "@/components/erp/DeskListShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { isDeskAuthenticated } from "@/lib/desk-auth";
import { fmtDateTime, matchesQuery } from "@/lib/erp-lists";
import { requireDeskPropertyId } from "@/lib/desk-property";
import { netFolioBalance } from "@/lib/folio/balance";
import { formatBtn } from "@/lib/pricing";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";

export const metadata = {
  title: "Invoices",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

function StatusPill({ value }: { value: string }) {
  if (!value) return null;
  const tone =
    value === "unpaid" || value === "open"
      ? "border-citrus/40 bg-citrus-tint/60 text-citrus"
      : value === "closed"
        ? "border-border bg-muted text-muted-foreground"
        : "border-border bg-muted text-muted-foreground";
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide whitespace-nowrap ${tone}`}
    >
      {value}
    </span>
  );
}

export default async function InvoicesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string }>;
}) {
  if (!(await isDeskAuthenticated())) redirect("/erp/login");
  const { q, status } = await searchParams;
  const query = (q ?? "").trim();
  const admin = createSupabaseAdminClient();
  const propertyId = await requireDeskPropertyId();

  let req = admin
    .from("fiscal_documents")
    .select(
      "id, doc_no, issued_at, folio_id, folios(id, label, status, folio_type, booking_id, agent_id, agents(company_name), folio_lines(id, total_btn, gst_btn, status, reverses_line_id))",
    )
    .eq("property_id", propertyId)
    .eq("doc_kind", "invoice")
    .eq("status", "issued")
    .order("issued_at", { ascending: false })
    .limit(200);

  const { data: docs } = await req;

  const rows = (docs ?? [])
    .map((doc) => {
      const rawFolio = doc.folios;
      const folio = (Array.isArray(rawFolio) ? rawFolio[0] : rawFolio) as {
        id: string;
        label: string;
        status: string;
        folio_type: string;
        booking_id: string | null;
        agent_id?: string | null;
        agents?:
          | { company_name?: string | null }
          | { company_name?: string | null }[]
          | null;
        folio_lines: {
          id?: string;
          total_btn: number;
          gst_btn: number;
          status: string;
          reverses_line_id?: string | null;
        }[] | null;
      } | null;
      const lines = folio?.folio_lines ?? [];
      const posted = lines.filter((l) => l.status === "posted");
      const total = posted.reduce((s, l) => s + Number(l.total_btn), 0);
      const gst = posted.reduce((s, l) => s + Number(l.gst_btn ?? 0), 0);
      const folioStatus = folio?.status ?? "";
      const agentRaw = folio?.agents;
      const agentName = Array.isArray(agentRaw)
        ? agentRaw[0]?.company_name
        : agentRaw?.company_name;
      const balance = netFolioBalance(
        lines.map((l, i) => ({
          id: l.id ?? String(i),
          status: l.status,
          total_btn: Number(l.total_btn),
          reverses_line_id: l.reverses_line_id ?? null,
        })),
      );
      const unpaid =
        folioStatus === "open" && Math.abs(balance) > 0.009;
      return {
        docId: doc.id as string,
        docNo: doc.doc_no as string,
        folioId: (doc.folio_id as string) ?? "",
        label: folio?.label ?? "Folio",
        status: folioStatus,
        folio_type: folio?.folio_type ?? "guest",
        agentName: agentName?.trim() || null,
        unpaid,
        booking_id: folio?.booking_id ?? null,
        issued_at: doc.issued_at as string,
        total,
        gst,
      };
    })
    .filter((r) => {
      if (status && r.status !== status) return false;
      return matchesQuery(
        [r.docNo, r.label, r.folioId, r.booking_id, r.status, r.folio_type, r.agentName],
        query,
      );
    });

  return (
    <DeskListShell
      eyebrow="Money"
      heading="Tax invoices"
      blurb="Fiscal invoice numbers (INV-YYYY-####) from guest folios and travel-agent F&B open items. Cash walk-in tickets without a folio do not appear here."
      filters={
        <form
          className="flex flex-wrap items-end gap-2"
          action="/erp/invoices"
          method="get"
        >
          <div className="min-w-[220px] flex-1 space-y-1.5">
            <label htmlFor="q" className="sr-only">
              Search
            </label>
            <Input
              id="q"
              type="search"
              name="q"
              defaultValue={q ?? ""}
              placeholder="Invoice no, folio label, booking…"
              className="h-10"
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="status" className="sr-only">
              Folio status
            </label>
            <select
              id="status"
              name="status"
              defaultValue={status ?? ""}
              className="h-10 rounded-md border border-input bg-transparent px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
            >
              <option value="">All folio statuses</option>
              <option value="open">Open / unpaid</option>
              <option value="closed">Closed folio</option>
            </select>
          </div>
          <Button type="submit" variant="outline" className="h-10">
            Search
          </Button>
        </form>
      }
    >
      <p className="text-xs text-muted-foreground">{rows.length} issued</p>
      <div className="space-y-3 md:hidden">
        {rows.length === 0 ? (
          <p className="rounded-xl border bg-card px-4 py-6 text-sm text-muted-foreground">
            No tax invoices issued yet. Open a guest folio, or settle POS as
            Charge agent (invoice later) for travel-agent lunches.
          </p>
        ) : (
          rows.map((row) => (
            <article key={row.docId} className="rounded-xl border bg-card p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-mono font-medium text-foreground">{row.docNo}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{row.label}</p>
                  {row.agentName ? (
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {row.agentName}
                      {row.folio_type === "walk_in" ? " · TA lunch" : ""}
                    </p>
                  ) : null}
                </div>
                <StatusPill value={row.unpaid ? "unpaid" : row.status} />
              </div>
              <dl className="mt-4 grid grid-cols-3 gap-3 text-sm">
                <div>
                  <dt className="text-xs text-muted-foreground">Type</dt>
                  <dd className="mt-1">{row.folio_type}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">GST</dt>
                  <dd className="mt-1 tabular-nums">{formatBtn(row.gst)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Total</dt>
                  <dd className="mt-1 font-semibold tabular-nums">
                    {formatBtn(row.total)}
                  </dd>
                </div>
              </dl>
              <p className="mt-3 text-xs text-muted-foreground">
                Issued {fmtDateTime(row.issued_at)}
              </p>
              <div className="mt-4 flex flex-col gap-2">
                <a
                  href={`/erp/invoices/${row.docId}/print`}
                  className="inline-flex min-h-11 w-full items-center justify-center rounded-xl border border-accent/30 bg-accent/10 text-sm font-medium text-accent"
                >
                  Print / email invoice
                </a>
                <a
                  href={`/erp/folios/${row.folioId}`}
                  className="inline-flex min-h-10 w-full items-center justify-center rounded-xl border text-sm font-medium text-foreground hover:bg-muted"
                >
                  Open folio →
                </a>
              </div>
            </article>
          ))
        )}
      </div>
      <div className="hidden overflow-hidden rounded-lg border bg-card md:block">
        <table className="min-w-[720px] w-full text-sm">
          <caption className="sr-only">Tax invoices</caption>
          <thead className="bg-muted/40">
            <tr className="hover:bg-transparent">
              {[
                "Invoice no.",
                "Folio",
                "Issued",
                "GST",
                "Total",
                "Folio status",
                "",
              ].map((h) => (
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
            {rows.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-3 py-6 text-muted-foreground">
                  No tax invoices issued yet. Guest folios and travel-agent
                  F&amp;B open items appear here after INV is issued.
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.docId} className="border-t">
                  <td className="px-3 py-2.5 font-mono font-medium text-foreground">
                    {r.docNo}
                  </td>
                  <td className="px-3 py-2.5">
                    <p className="font-medium text-foreground">{r.label}</p>
                    <p className="font-mono text-xs text-muted-foreground">
                      {r.folioId.slice(0, 8)}
                      {r.agentName ? ` · ${r.agentName}` : ""}
                      {r.folio_type === "walk_in" ? " · TA lunch" : ""}
                    </p>
                  </td>
                  <td className="px-3 py-2.5 text-sm text-foreground">
                    {fmtDateTime(r.issued_at)}
                  </td>
                  <td className="px-3 py-2.5 tabular-nums">{formatBtn(r.gst)}</td>
                  <td className="px-3 py-2.5 font-medium tabular-nums text-foreground">
                    {formatBtn(r.total)}
                  </td>
                  <td className="px-3 py-2.5">
                    <StatusPill value={r.unpaid ? "unpaid" : r.status} />
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    <div className="flex flex-col items-end gap-1">
                      <a
                        href={`/erp/invoices/${r.docId}/print`}
                        className="text-sm font-medium text-accent underline-offset-4 hover:underline"
                      >
                        Print / email
                      </a>
                      <a
                        href={`/erp/folios/${r.folioId}`}
                        className="text-xs text-muted-foreground underline-offset-4 hover:underline"
                      >
                        Folio →
                      </a>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </DeskListShell>
  );
}
