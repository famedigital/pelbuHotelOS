import { PrintButton } from "@/components/erp/PrintButton";
import { assertDeskProperty } from "@/lib/desk/property-guard";
import { isDeskAuthenticated } from "@/lib/desk-auth";
import { netFolioBalance } from "@/lib/folio/balance";
import { formatBtn } from "@/lib/pricing";
import { loadProperty, resolveActivePropertyId } from "@/lib/property-context";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

export const metadata = {
  title: "Group AR statement | Hotel OS",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

/** Consolidated master folio + child guest folios for group / city-ledger settle. */
export default async function GroupArStatementPage({ params }: Props) {
  if (!(await isDeskAuthenticated())) redirect("/erp/login");

  const { id } = await params;
  const admin = createSupabaseAdminClient();
  const propertyId = await resolveActivePropertyId(admin);

  const { data: master } = await admin
    .from("folios")
    .select(
      "id, label, status, folio_type, booking_id, created_at, property_id, folio_lines(id, description, total_btn, status, reverses_line_id, source_type, created_at)",
    )
    .eq("id", id)
    .maybeSingle();

  if (!master) notFound();
  try {
    assertDeskProperty(propertyId, master.property_id as string, "Folio");
  } catch {
    notFound();
  }

  if ((master.folio_type as string) !== "master") {
    redirect(`/erp/folios/${id}/receipt`);
  }

  const property = await loadProperty(admin, propertyId);
  if (!property) notFound();

  const { data: children } = await admin
    .from("folios")
    .select(
      "id, label, status, booking_id, folio_lines(id, total_btn, status, reverses_line_id)",
    )
    .eq("property_id", propertyId)
    .eq("master_folio_id", id)
    .order("created_at", { ascending: true });

  type Line = {
    id: string;
    description?: string;
    total_btn: number;
    status: string;
    reverses_line_id?: string | null;
    source_type?: string;
    created_at?: string;
  };

  const masterLines = (master.folio_lines as Line[] | null) ?? [];
  const masterBalance = netFolioBalance(masterLines);
  const childRows = (children ?? []).map((c) => {
    const lines = (c.folio_lines as Line[] | null) ?? [];
    return {
      id: c.id as string,
      label: (c.label as string) || (c.id as string).slice(0, 8),
      status: c.status as string,
      bookingId: (c.booking_id as string | null) ?? null,
      balance: netFolioBalance(lines),
    };
  });
  const childrenTotal = childRows.reduce((s, r) => s + r.balance, 0);
  const groupTotal = masterBalance + childrenTotal;

  const postedMaster = masterLines.filter((l) => l.status === "posted");

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6 print:max-w-none print:p-0">
      <div className="flex flex-wrap items-start justify-between gap-3 print:hidden">
        <div>
          <p className="text-[11px] font-semibold tracking-[0.18em] text-accent uppercase">
            City ledger
          </p>
          <h1 className="text-2xl font-semibold tracking-tight">
            Group AR statement
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Master folio plus attached guest folios.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <PrintButton />
          <Link
            href={`/erp/folios/${id}`}
            className="inline-flex h-9 items-center rounded-md border px-3 text-sm hover:bg-muted"
          >
            Open folio
          </Link>
        </div>
      </div>

      <header className="border-b pb-4">
        <p className="text-lg font-semibold">{property.name}</p>
        {property.legal_name ? (
          <p className="text-sm text-muted-foreground">{property.legal_name}</p>
        ) : null}
        <p className="mt-2 text-sm">
          <span className="font-medium">
            {(master.label as string) || "Master folio"}
          </span>
          {" · "}
          <span className="uppercase tracking-wide text-muted-foreground">
            {master.status as string}
          </span>
        </p>
        <p className="text-xs text-muted-foreground">
          Opened {String(master.created_at).slice(0, 10)} · Ref{" "}
          <span className="font-mono">{id.slice(0, 8)}</span>
        </p>
      </header>

      <section>
        <h2 className="text-sm font-semibold tracking-wide uppercase text-muted-foreground">
          Summary
        </h2>
        <dl className="mt-2 grid gap-2 sm:grid-cols-3">
          <div className="rounded-lg border p-3">
            <dt className="text-xs text-muted-foreground">Master balance</dt>
            <dd className="mt-1 text-lg font-semibold tabular-nums">
              {formatBtn(masterBalance)}
            </dd>
          </div>
          <div className="rounded-lg border p-3">
            <dt className="text-xs text-muted-foreground">Child folios</dt>
            <dd className="mt-1 text-lg font-semibold tabular-nums">
              {formatBtn(childrenTotal)}
            </dd>
          </div>
          <div className="rounded-lg border border-accent/40 bg-accent/5 p-3">
            <dt className="text-xs text-muted-foreground">Group total due</dt>
            <dd className="mt-1 text-lg font-semibold tabular-nums">
              {formatBtn(groupTotal)}
            </dd>
          </div>
        </dl>
      </section>

      {childRows.length > 0 ? (
        <section>
          <h2 className="text-sm font-semibold tracking-wide uppercase text-muted-foreground">
            Attached guest folios
          </h2>
          <table className="mt-2 w-full text-left text-sm">
            <thead className="border-b text-[11px] uppercase text-muted-foreground">
              <tr>
                <th className="py-2">Folio</th>
                <th className="py-2">Status</th>
                <th className="py-2 text-right">Balance</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {childRows.map((r) => (
                <tr key={r.id}>
                  <td className="py-2">
                    <Link
                      href={`/erp/folios/${r.id}`}
                      className="underline-offset-4 hover:underline print:no-underline"
                    >
                      {r.label}
                    </Link>
                  </td>
                  <td className="py-2 uppercase text-muted-foreground">
                    {r.status}
                  </td>
                  <td className="py-2 text-right tabular-nums">
                    {formatBtn(r.balance)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ) : (
        <p className="text-sm text-muted-foreground">
          No guest folios attached yet.
        </p>
      )}

      {postedMaster.length > 0 ? (
        <section>
          <h2 className="text-sm font-semibold tracking-wide uppercase text-muted-foreground">
            Master lines
          </h2>
          <table className="mt-2 w-full text-left text-sm">
            <thead className="border-b text-[11px] uppercase text-muted-foreground">
              <tr>
                <th className="py-2">Description</th>
                <th className="py-2 text-right">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {postedMaster.map((l) => (
                <tr key={l.id}>
                  <td className="py-2">
                    {l.description || l.source_type || "Line"}
                  </td>
                  <td className="py-2 text-right tabular-nums">
                    {formatBtn(Number(l.total_btn))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ) : null}
    </div>
  );
}
