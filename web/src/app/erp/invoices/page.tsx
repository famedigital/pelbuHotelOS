import {
  DeskListShell,
  DeskSearchForm,
  DeskTable,
  StatusPill,
} from "@/components/erp/DeskListShell";
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
      title="Invoices"
      eyebrow="Folios"
      heading="Invoices"
      blurb="Browse guest and master folios. Open to reprint lines, take payment, void, or issue deposit links."
      filters={
        <DeskSearchForm
          action="/erp/invoices"
          q={q}
          placeholder="Label, folio id, booking…"
        >
          <select
            name="status"
            defaultValue={status ?? ""}
            className="min-h-11 rounded-sm border border-espresso/15 bg-white px-3 text-sm"
          >
            <option value="">All</option>
            <option value="open">Open</option>
            <option value="closed">Closed</option>
          </select>
        </DeskSearchForm>
      }
    >
      <p className="text-xs text-muted-foreground">{rows.length} shown</p>
      <DeskTable
        caption="Invoices"
        headers={["Invoice", "Type", "Created", "GST", "Total", "Status", ""]}
      >
        {rows.length === 0 ? (
          <tr>
            <td colSpan={7} className="px-3 py-6 text-muted-foreground">
              No invoices yet.
            </td>
          </tr>
        ) : (
          rows.map((r) => (
            <tr key={r.id} className="border-t border-espresso/10">
              <td className="px-3 py-2.5">
                <p className="font-medium text-espresso">{r.label}</p>
                <p className="font-mono text-xs text-muted-foreground">{r.id.slice(0, 8)}</p>
              </td>
              <td className="px-3 py-2.5 text-sm text-muted-foreground">{r.folio_type}</td>
              <td className="px-3 py-2.5 text-sm">{fmtDateTime(r.created_at)}</td>
              <td className="px-3 py-2.5 tabular-nums">{formatBtn(r.gst)}</td>
              <td className="px-3 py-2.5 tabular-nums font-medium text-espresso">
                {formatBtn(r.total)}
              </td>
              <td className="px-3 py-2.5">
                <StatusPill value={r.status} />
              </td>
              <td className="px-3 py-2.5 text-right">
                <a
                  href={`/erp/folios/${r.id}`}
                  className="text-sm text-maroon underline-offset-4 hover:underline"
                >
                  Open / reprint →
                </a>
              </td>
            </tr>
          ))
        )}
      </DeskTable>
    </DeskListShell>
  );
}
