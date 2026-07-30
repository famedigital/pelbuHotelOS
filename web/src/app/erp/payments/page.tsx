import { DeskListShell } from "@/components/erp/DeskListShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
      eyebrow="Receipts"
      heading="Payments & receipts"
      blurb="All desk and deposit payments. Open the linked folio to reprint the receipt context."
      filters={
        <form
          className="flex flex-wrap items-end gap-2"
          action="/erp/payments"
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
              placeholder="Reference, method, folio, booking…"
              className="h-10"
            />
          </div>
          <div className="w-36 space-y-1.5">
            <label htmlFor="method" className="sr-only">
              Method
            </label>
            <Input
              id="method"
              name="method"
              defaultValue={method ?? ""}
              placeholder="Method"
              className="h-10"
            />
          </div>
          <Button type="submit" variant="outline" className="h-10">
            Search
          </Button>
        </form>
      }
    >
      <div className="flex flex-wrap gap-3 text-xs text-foreground">
        {[...byMethod.entries()].map(([m, amt]) => (
          <span
            key={m}
            className="inline-flex items-center gap-2 rounded-md border bg-card px-3 py-2"
          >
            <span className="font-medium tracking-wide text-accent uppercase">
              {m}
            </span>
            <span className="tabular-nums">{formatBtn(amt)}</span>
          </span>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">{filtered.length} shown</p>
      <div className="space-y-3 md:hidden">
        {filtered.length === 0 ? (
          <p className="rounded-xl border bg-card px-4 py-6 text-sm text-muted-foreground">
            No payments match.
          </p>
        ) : (
          filtered.map((payment) => {
            const methodValue = (payment.method as string) ?? "—";
            return (
              <article
                key={payment.id as string}
                className="rounded-xl border bg-card p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-lg font-semibold tabular-nums">
                      {formatBtn(Number(payment.amount_btn))}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {fmtDateTime(payment.created_at as string)}
                    </p>
                  </div>
                  <span className="rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide">
                    {methodValue}
                  </span>
                </div>
                <p className="mt-3 text-sm text-muted-foreground">
                  {(payment.kind as string) ?? "—"} ·{" "}
                  {(payment.reference as string) ||
                    (payment.id as string).slice(0, 8)}
                </p>
                {payment.folio_id ? (
                  <a
                    href={`/erp/folios/${payment.folio_id as string}`}
                    className="mt-4 inline-flex min-h-11 w-full items-center justify-center rounded-xl border border-accent/30 bg-accent/10 text-sm font-medium text-accent"
                  >
                    Open folio →
                  </a>
                ) : null}
              </article>
            );
          })
        )}
      </div>
      <div className="hidden overflow-hidden rounded-lg border bg-card md:block">
        <table className="min-w-[720px] w-full text-sm">
          <caption className="sr-only">Payments</caption>
          <thead className="bg-muted/40">
            <tr className="hover:bg-transparent">
              {["When", "Amount", "Method", "Kind", "Reference", ""].map((h) => (
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
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-muted-foreground">
                  No payments match.
                </td>
              </tr>
            ) : (
              filtered.map((p) => {
                const methodValue = (p.method as string) ?? "—";
                const tone =
                  methodValue === "cash" || methodValue === "deposit"
                    ? "border-citrus/40 bg-citrus-tint/60 text-citrus"
                    : methodValue === "bank" || methodValue === "bank_qr"
                      ? "border-accent/30 bg-accent/10 text-accent"
                      : "border-border bg-muted text-muted-foreground";
                return (
                  <tr key={p.id as string} className="border-t">
                    <td className="px-3 py-2.5 text-sm">
                      {fmtDateTime(p.created_at as string)}
                    </td>
                    <td className="px-3 py-2.5 font-medium tabular-nums">
                      {formatBtn(Number(p.amount_btn))}
                    </td>
                    <td className="px-3 py-2.5">
                      <span
                        className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide whitespace-nowrap ${tone}`}
                      >
                        {methodValue}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-sm text-muted-foreground">
                      {(p.kind as string) ?? "—"}
                    </td>
                    <td className="px-3 py-2.5 font-mono text-xs text-muted-foreground">
                      {(p.reference as string) || (p.id as string).slice(0, 8)}
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      {p.folio_id ? (
                        <a
                          href={`/erp/folios/${p.folio_id as string}`}
                          className="text-sm text-accent underline-offset-4 hover:underline"
                        >
                          Folio →
                        </a>
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </DeskListShell>
  );
}
