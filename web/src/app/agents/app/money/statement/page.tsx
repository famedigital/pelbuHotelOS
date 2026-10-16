import { PrintButton } from "@/components/erp/PrintButton";
import { requireAgentPropertySession } from "@/lib/agent-auth";
import { loadAgentMoneyCockpit } from "@/lib/agent-portal-money";
import { formatBtn } from "@/lib/pricing";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import Link from "next/link";

export const dynamic = "force-dynamic";

type Props = {
  searchParams: Promise<{ from?: string; to?: string }>;
};

/** Printable agent statement for the active hotel (+ rollup header). */
export default async function AgentStatementPage({ searchParams }: Props) {
  const session = await requireAgentPropertySession();
  const sp = await searchParams;
  const admin = createSupabaseAdminClient();
  const from =
    sp.from && /^\d{4}-\d{2}-\d{2}$/.test(sp.from) ? sp.from : undefined;
  const to = sp.to && /^\d{4}-\d{2}-\d{2}$/.test(sp.to) ? sp.to : undefined;

  const cockpit = await loadAgentMoneyCockpit(admin, {
    agentId: session.agentId,
    links: session.links,
    from,
    to,
    sessionAgentId: session.agentId,
  });
  const hotel = cockpit.hotels.find(
    (h) => h.propertyId === session.activePropertyId,
  );
  const detail = hotel?.detail;

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-2 print:max-w-none print:p-0">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Link
          href={`/agents/app/money?from=${cockpit.from}&to=${cockpit.to}`}
          className="text-sm text-accent underline-offset-4 hover:underline"
        >
          ← Money
        </Link>
        <PrintButton label="Print statement" />
      </div>

      <header className="border-b pb-4">
        <p className="text-[11px] font-semibold tracking-[0.18em] text-accent uppercase">
          Partner statement
        </p>
        <h1 className="mt-1 text-2xl font-semibold">{session.companyName}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {hotel?.propertyName ?? "Hotel"} · {cockpit.from} → {cockpit.to}
        </p>
      </header>

      <section className="grid gap-3 sm:grid-cols-4">
        <Stat label="Quoted" value={formatBtn(detail?.summary.quoted_btn ?? 0)} />
        <Stat label="Paid" value={formatBtn(detail?.summary.paid_btn ?? 0)} />
        <Stat
          label="Outstanding"
          value={formatBtn(detail?.summary.outstanding_btn ?? 0)}
        />
        <Stat
          label="Room-nights"
          value={String(detail?.summary.room_nights ?? 0)}
        />
      </section>

      {detail?.summary.habit ? (
        <p className="text-sm text-muted-foreground">{detail.summary.habit}</p>
      ) : null}

      <section>
        <h2 className="text-sm font-semibold">Stays</h2>
        <table className="mt-2 w-full text-left text-sm">
          <thead className="border-b text-xs uppercase text-muted-foreground">
            <tr>
              <th className="py-2">In</th>
              <th className="py-2">Out</th>
              <th className="py-2">R</th>
              <th className="py-2">RN</th>
              <th className="py-2">Guest</th>
              <th className="py-2 text-right">Quoted</th>
            </tr>
          </thead>
          <tbody>
            {(detail?.stays ?? []).map((s) => (
              <tr key={s.id} className="border-t">
                <td className="py-2 tabular-nums">{s.check_in}</td>
                <td className="py-2 tabular-nums">{s.check_out}</td>
                <td className="py-2 tabular-nums">{s.rooms}</td>
                <td className="py-2 tabular-nums">{s.room_nights}</td>
                <td className="py-2">{s.guest ?? "—"}</td>
                <td className="py-2 text-right tabular-nums">
                  {formatBtn(s.quoted_btn)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section>
        <h2 className="text-sm font-semibold">Payments</h2>
        <table className="mt-2 w-full text-left text-sm">
          <thead className="border-b text-xs uppercase text-muted-foreground">
            <tr>
              <th className="py-2">Date</th>
              <th className="py-2">Method</th>
              <th className="py-2 text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            {(detail?.payments ?? []).length === 0 ? (
              <tr>
                <td colSpan={3} className="py-4 text-muted-foreground">
                  No payments in range.
                </td>
              </tr>
            ) : (
              detail!.payments.map((p, i) => (
                <tr key={`${p.paid_at}-${i}`} className="border-t">
                  <td className="py-2 tabular-nums">{p.paid_at}</td>
                  <td className="py-2">{p.method}</td>
                  <td className="py-2 text-right tabular-nums">
                    {formatBtn(p.amount_btn)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>

      <p className="text-xs text-muted-foreground print:mt-8">
        Generated {cockpit.today} · Innora Partner · Confirm figures with the
        hotel desk for settlement.
      </p>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border px-3 py-3">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 text-lg font-semibold tabular-nums">{value}</p>
    </div>
  );
}
