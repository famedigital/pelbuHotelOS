import {
  DeskListShell,
  DeskTable,
  StatusPill,
} from "@/components/erp/DeskListShell";
import { PrintButton } from "@/components/erp/PrintButton";
import { isDeskAuthenticated } from "@/lib/desk-auth";
import { fmtDate, requireDeskPropertyId } from "@/lib/erp-lists";
import { formatBtn } from "@/lib/pricing";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { notFound, redirect } from "next/navigation";

export const metadata = {
  title: "Agent statement | Pelbu OS",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

export default async function AgentStatementPage({ params }: Props) {
  if (!(await isDeskAuthenticated())) redirect("/erp/login");
  const { id } = await params;
  const admin = createSupabaseAdminClient();
  const propertyId = await requireDeskPropertyId();

  const { data: agent } = await admin
    .from("agents")
    .select(
      "id, company_name, market, contact_name, contact_phone, contact_email, status, rate_tier, credit_limit, credit_used",
    )
    .eq("id", id)
    .maybeSingle();
  if (!agent) notFound();

  const { data: bookings } = await admin
    .from("bookings")
    .select(
      "id, contact_name, check_in, check_out, status, rooms, quoted_total_btn, folios(id, label, status, folio_lines(total_btn, status))",
    )
    .eq("property_id", propertyId)
    .eq("agent_id", id)
    .order("check_in", { ascending: false })
    .limit(100);

  const bookingIds = (bookings ?? []).map((b) => b.id as string);

  const { data: payments } =
    bookingIds.length === 0
      ? { data: [] as Record<string, unknown>[] }
      : await admin
          .from("payments")
          .select("id, amount_btn, method, kind, created_at, booking_id, reference")
          .eq("property_id", propertyId)
          .in("booking_id", bookingIds)
          .order("created_at", { ascending: false })
          .limit(100);

  let folioTotal = 0;
  for (const b of bookings ?? []) {
    const folios = (b.folios as {
      folio_lines?: { total_btn: number; status: string }[];
    }[] | null) ?? [];
    for (const f of folios) {
      for (const l of f.folio_lines ?? []) {
        if (l.status === "posted") folioTotal += Number(l.total_btn);
      }
    }
  }
  const paid = (payments ?? []).reduce((s, p) => s + Number(p.amount_btn), 0);
  const outstanding = folioTotal - paid;
  const creditLimit = Number(agent.credit_limit ?? 0);
  const creditUsed = Number(agent.credit_used ?? 0);

  return (
    <DeskListShell
      title="Statement"
      eyebrow="Agent"
      heading={(agent.company_name as string) ?? "Agent"}
      blurb={`${agent.market as string} Â· ${agent.contact_name ?? ""} Â· ${agent.contact_phone ?? ""} — print this page for aging / collection.`}
    >
      <div className="grid gap-3 sm:grid-cols-4 print:grid-cols-4">
        {[
          ["Credit limit", formatBtn(creditLimit)],
          ["Credit used", formatBtn(creditUsed)],
          ["Folio charges", formatBtn(folioTotal)],
          ["Outstanding", formatBtn(outstanding)],
        ].map(([label, val]) => (
          <div key={label} className="border border-espresso/10 bg-white px-4 py-4">
            <p className="text-[11px] font-semibold tracking-[0.18em] text-gold uppercase">
              {label}
            </p>
            <p className="mt-2 text-xl tabular-nums text-espresso">{val}</p>
          </div>
        ))}
      </div>

      <div className="flex gap-2 print:hidden">
        <a
          href="/erp/agents"
          className="inline-flex min-h-10 items-center border border-espresso/20 px-4 text-sm"
        >
          ← Agents
        </a>
        <PrintButton label="Print statement" />
      </div>

      <DeskTable
        caption="Bookings"
        headers={["Guest", "Dates", "Status", "Folio", ""]}
      >
        {(bookings ?? []).length === 0 ? (
          <tr>
            <td colSpan={5} className="px-3 py-6 text-muted-foreground">
              No bookings for this agent at this property.
            </td>
          </tr>
        ) : (
          (bookings ?? []).map((b) => {
            const folios = (b.folios as { id: string; label: string }[] | null) ?? [];
            const folio = folios[0];
            return (
              <tr key={b.id as string} className="border-t border-espresso/10">
                <td className="px-3 py-2.5 font-medium">
                  {(b.contact_name as string) ?? "Guest"}
                </td>
                <td className="px-3 py-2.5 text-sm">
                  {fmtDate(b.check_in as string)} → {fmtDate(b.check_out as string)}
                </td>
                <td className="px-3 py-2.5">
                  <StatusPill value={b.status as string} />
                </td>
                <td className="px-3 py-2.5 text-sm text-muted-foreground">
                  {folio?.label ?? "—"}
                </td>
                <td className="px-3 py-2.5 text-right">
                  {folio ? (
                    <a
                      href={`/erp/folios/${folio.id}`}
                      className="text-maroon underline-offset-4 hover:underline"
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
      </DeskTable>

      <DeskTable caption="Payments" headers={["When", "Amount", "Method", "Ref"]}>
        {(payments ?? []).map((p) => (
          <tr key={p.id as string} className="border-t border-espresso/10">
            <td className="px-3 py-2.5 text-sm">
              {new Date(p.created_at as string).toLocaleDateString("en-BT")}
            </td>
            <td className="px-3 py-2.5 tabular-nums">
              {formatBtn(Number(p.amount_btn))}
            </td>
            <td className="px-3 py-2.5 text-sm">{p.method as string}</td>
            <td className="px-3 py-2.5 font-mono text-xs text-muted-foreground">
              {(p.reference as string) ?? "—"}
            </td>
          </tr>
        ))}
      </DeskTable>
    </DeskListShell>
  );
}
