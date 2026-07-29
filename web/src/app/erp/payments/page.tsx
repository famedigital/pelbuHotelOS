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
  title: "Payments | Pelbu OS",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

export default async function PaymentsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; method?: string }>;
}) {
  if (!(await isDeskAuthenticated())) redirect("/erp/login");
  const { q, method } = await searchParams;
  const query = (q ?? "").trim();
  const admin = createSupabaseAdminClient();
  const propertyId = await requireDeskPropertyId();

  let req = admin
    .from("payments")
    .select(
      "id, amount_btn, method, kind, reference, notes, created_at, folio_id, booking_id",
    )
    .eq("property_id", propertyId)
    .order("created_at", { ascending: false })
    .limit(250);

  if (method) req = req.eq("method", method);

  const { data: payments } = await req;

  const filtered = (payments ?? []).filter((p) =>
    matchesQuery(
      [
        p.id as string,
        p.method as string,
        p.kind as string,
        p.reference as string,
        p.notes as string,
        p.folio_id as string,
        p.booking_id as string,
      ],
      query,
    ),
  );

  const byMethod = new Map<string, number>();
  for (const p of filtered) {
    const m = (p.method as string) || "other";
    byMethod.set(m, (byMethod.get(m) ?? 0) + Number(p.amount_btn ?? 0));
  }

  return (
    <DeskListShell
      title="Payments"
      eyebrow="Receipts"
      heading="Payments & receipts"
      blurb="All desk and deposit payments. Open the linked folio to reprint the receipt context."
      filters={
        <DeskSearchForm
          action="/erp/payments"
          q={q}
          placeholder="Reference, method, folio, booking…"
        >
          <input
            name="method"
            defaultValue={method ?? ""}
            placeholder="Method"
            className="min-h-11 w-36 rounded-sm border border-espresso/15 bg-white px-3 text-sm"
          />
        </DeskSearchForm>
      }
    >
      <div className="flex flex-wrap gap-3 text-xs text-espresso">
        {[...byMethod.entries()].map(([m, amt]) => (
          <span key={m} className="border border-espresso/15 bg-white px-3 py-2">
            <span className="font-medium uppercase tracking-wide text-gold">{m}</span>{" "}
            <span className="tabular-nums">{formatBtn(amt)}</span>
          </span>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">{filtered.length} shown</p>
      <DeskTable
        caption="Payments"
        headers={["When", "Amount", "Method", "Kind", "Reference", ""]}
      >
        {filtered.length === 0 ? (
          <tr>
            <td colSpan={6} className="px-3 py-6 text-muted-foreground">
              No payments match.
            </td>
          </tr>
        ) : (
          filtered.map((p) => (
            <tr key={p.id as string} className="border-t border-espresso/10">
              <td className="px-3 py-2.5 text-sm">{fmtDateTime(p.created_at as string)}</td>
              <td className="px-3 py-2.5 tabular-nums font-medium">
                {formatBtn(Number(p.amount_btn))}
              </td>
              <td className="px-3 py-2.5">
                <StatusPill value={(p.method as string) ?? "—"} />
              </td>
              <td className="px-3 py-2.5 text-sm text-muted-foreground">{(p.kind as string) ?? "—"}</td>
              <td className="px-3 py-2.5 font-mono text-xs text-muted-foreground">
                {(p.reference as string) || (p.id as string).slice(0, 8)}
              </td>
              <td className="px-3 py-2.5 text-right">
                {p.folio_id ? (
                  <a
                    href={`/erp/folios/${p.folio_id as string}`}
                    className="text-sm text-maroon underline-offset-4 hover:underline"
                  >
                    Folio →
                  </a>
                ) : (
                  "—"
                )}
              </td>
            </tr>
          ))
        )}
      </DeskTable>
    </DeskListShell>
  );
}
