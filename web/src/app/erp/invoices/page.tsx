import { DeskListShell } from "@/components/erp/DeskListShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { isDeskAuthenticated } from "@/lib/desk-auth";
import { fmtDateTime, matchesQuery, requireDeskPropertyId } from "@/lib/erp-lists";
import { formatBtn } from "@/lib/pricing";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";

export const metadata = {
  title: "Invoices | Pelbu OS",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

function StatusPill({ value }: { value: string }) {
  if (!value) return null;
  const tone =
    value === "open"
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
    .from("folios")
    .select(
      "id, label, status, folio_type, booking_id, created_at, closed_at, folio_lines(total_btn, gst_btn, status)",
    )
    .eq("property_id", propertyId)
    .order("created_at", { ascending: false })
    .limit(200);

  if (status) req = req.eq("status", status);

  const { data: folios } = await req;

  const rows = (folios ?? [])
    .map((f) => {
      const lines = (f.folio_lines as {
        total_btn: number;
        gst_btn: number;
        status: string;
      }[] | null) ?? [];
      const posted = lines.filter((l) => l.status === "posted");
      const total = posted.reduce((s, l) => s + Number(l.total_btn), 0);
      const gst = posted.reduce((s, l) => s + Number(l.gst_btn ?? 0), 0);
      return {
        id: f.id as string,
        label: (f.label as string) ?? "Folio",
        status: f.status as string,
        folio_type: f.folio_type as string,
        booking_id: (f.booking_id as string | null) ?? null,
        created_at: f.created_at as string,
        total,
        gst,
      };
    })
    .filter((r) =>
      matchesQuery([r.label, r.id, r.booking_id, r.status, r.folio_type], query),
    );

  return (
    <DeskListShell
      eyebrow="Folios"
      heading="Invoices"
      blurb="Browse guest and master folios. Open to reprint lines, take payment, void, or issue deposit links."
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
              placeholder="Label, folio id, booking…"
              className="h-10"
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="status" className="sr-only">
              Status
            </label>
            <select
              id="status"
              name="status"
              defaultValue={status ?? ""}
              className="h-10 rounded-md border border-input bg-transparent px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
            >
              <option value="">All</option>
              <option value="open">Open</option>
              <option value="closed">Closed</option>
            </select>
          </div>
          <Button type="submit" variant="outline" className="h-10">
            Search
          </Button>
        </form>
      }
    >
      <p className="text-xs text-muted-foreground">{rows.length} shown</p>
      <div className="space-y-3 md:hidden">
        {rows.length === 0 ? (
          <p className="rounded-xl border bg-card px-4 py-6 text-sm text-muted-foreground">
            No invoices yet.
          </p>
        ) : (
          rows.map((row) => (
            <article key={row.id} className="rounded-xl border bg-card p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-medium text-foreground">{row.label}</p>
                  <p className="mt-1 font-mono text-xs text-muted-foreground">
                    {row.id.slice(0, 8)}
                  </p>
                </div>
                <StatusPill value={row.status} />
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
                {fmtDateTime(row.created_at)}
              </p>
              <a
                href={`/erp/folios/${row.id}`}
                className="mt-4 inline-flex min-h-11 w-full items-center justify-center rounded-xl border border-accent/30 bg-accent/10 text-sm font-medium text-accent"
              >
                Open / reprint →
              </a>
            </article>
          ))
        )}
      </div>
      <div className="hidden overflow-hidden rounded-lg border bg-card md:block">
        <table className="min-w-[720px] w-full text-sm">
          <caption className="sr-only">Invoices</caption>
          <thead className="bg-muted/40">
            <tr className="hover:bg-transparent">
              {["Invoice", "Type", "Created", "GST", "Total", "Status", ""].map(
                (h) => (
                  <th
                    key={h}
                    scope="col"
                    className="h-10 px-3 text-left text-xs font-semibold tracking-wide text-muted-foreground uppercase"
                  >
                    {h}
                  </th>
                ),
              )}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-3 py-6 text-muted-foreground">
                  No invoices yet.
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.id} className="border-t">
                  <td className="px-3 py-2.5">
                    <p className="font-medium text-foreground">{r.label}</p>
                    <p className="font-mono text-xs text-muted-foreground">
                      {r.id.slice(0, 8)}
                    </p>
                  </td>
                  <td className="px-3 py-2.5 text-sm text-muted-foreground">
                    {r.folio_type}
                  </td>
                  <td className="px-3 py-2.5 text-sm text-foreground">
                    {fmtDateTime(r.created_at)}
                  </td>
                  <td className="px-3 py-2.5 tabular-nums">{formatBtn(r.gst)}</td>
                  <td className="px-3 py-2.5 font-medium tabular-nums text-foreground">
                    {formatBtn(r.total)}
                  </td>
                  <td className="px-3 py-2.5">
                    <StatusPill value={r.status} />
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    <a
                      href={`/erp/folios/${r.id}`}
                      className="text-sm text-accent underline-offset-4 hover:underline"
                    >
                      Open / reprint →
                    </a>
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
