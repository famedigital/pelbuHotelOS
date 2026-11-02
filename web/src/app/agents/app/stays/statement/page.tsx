import { AgentPrintButton } from "@/components/erp/agent-portal/AgentPrintButton";
import { requireAgentPropertySession } from "@/lib/agent-auth";
import {
  agentStayDateBounds,
  loadAgentStayRows,
  stayOverlapsRange,
} from "@/lib/agent-portal-stays";
import { formatBtn } from "@/lib/pricing";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import Link from "next/link";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Account statement · Partner",
  robots: { index: false, follow: false },
};

type Props = {
  searchParams: Promise<{
    from?: string;
    to?: string;
    q?: string;
    preset?: string;
  }>;
};

export default async function AgentStaysStatementPage({ searchParams }: Props) {
  const session = await requireAgentPropertySession();
  const sp = await searchParams;
  const admin = createSupabaseAdminClient();

  let rows = await loadAgentStayRows(admin, {
    agentId: session.agentId,
    propertyId: session.activePropertyId,
    sessionAgentId: session.agentId,
    limit: 500,
  });
  const bounds = agentStayDateBounds(rows);
  const from =
    sp.from && /^\d{4}-\d{2}-\d{2}$/.test(sp.from)
      ? sp.from
      : bounds.from ?? "";
  const to =
    sp.to && /^\d{4}-\d{2}-\d{2}$/.test(sp.to) ? sp.to : bounds.to ?? "";

  if (from && to) {
    rows = rows.filter((r) =>
      stayOverlapsRange(r.checkIn, r.checkOut, from, to),
    );
  }
  if (sp.preset === "pending") {
    rows = rows.filter(
      (r) => r.paymentStatus === "unpaid" || r.paymentStatus === "partial",
    );
  }
  const q = (sp.q ?? "").trim().toLowerCase();
  if (q) {
    rows = rows.filter((r) =>
      [r.confirmationLabel, r.guestName, r.guideNumber, r.nationality]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(q),
    );
  }

  const hotel =
    session.links.find((l) => l.propertyId === session.activePropertyId)
      ?.propertyName ?? "Hotel";

  const nights = rows.reduce(
    (s, r) => s + r.nights * Math.max(1, r.roomsCount),
    0,
  );
  const amount = rows.reduce((s, r) => s + r.grandTotalBtn, 0);
  const paid = rows.reduce((s, r) => s + r.paidBtn, 0);
  const dues = rows.reduce(
    (s, r) => s + (Math.abs(r.dueBtn) > 0.5 ? r.dueBtn : 0),
    0,
  );

  return (
    <div className="mx-auto max-w-[1100px] bg-white p-6 text-[#0f172a] print:max-w-none print:p-4">
      <div className="mb-4 flex items-start justify-between gap-4 print:hidden">
        <Link
          href={`/agents/app/stays?tab=bookings&from=${from}&to=${to}`}
          className="text-sm text-sky-800 underline"
        >
          Back to ledger
        </Link>
        <AgentPrintButton label="Print statement" />
      </div>

      <header className="border-b border-slate-200 pb-4">
        <p className="text-xs tracking-wide text-slate-500 uppercase">
          B2B partner account statement
        </p>
        <h1 className="mt-1 text-2xl font-semibold">{session.companyName}</h1>
        <p className="mt-1 text-sm text-slate-600">
          {hotel} · {from || "—"} → {to || "—"}
        </p>
      </header>

      <table className="mt-6 w-full border-collapse text-xs">
        <thead>
          <tr className="border-b text-left text-[10px] tracking-wide text-slate-500 uppercase">
            <th className="py-2 pr-2">#</th>
            <th className="py-2 pr-2">Guest</th>
            <th className="py-2 pr-2">Dates</th>
            <th className="py-2 pr-2 text-right">Nights</th>
            <th className="py-2 pr-2">Meal</th>
            <th className="py-2 pr-2 text-right">G.total</th>
            <th className="py-2 pr-2 text-right">Paid</th>
            <th className="py-2 text-right">Due</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.id} className="border-b border-slate-100">
              <td className="py-1.5 pr-2 tabular-nums text-slate-500">{i + 1}</td>
              <td className="py-1.5 pr-2 font-medium">
                {r.guestName ?? "—"}
                <span className="mt-0.5 block font-mono text-[10px] font-normal text-slate-500">
                  {r.confirmationLabel}
                </span>
              </td>
              <td className="py-1.5 pr-2 tabular-nums">
                {r.checkIn} → {r.checkOut}
              </td>
              <td className="py-1.5 pr-2 text-right tabular-nums">{r.nights}</td>
              <td className="py-1.5 pr-2">{r.mealPlanCode}</td>
              <td className="py-1.5 pr-2 text-right tabular-nums">
                {formatBtn(r.grandTotalBtn)}
              </td>
              <td className="py-1.5 pr-2 text-right tabular-nums">
                {formatBtn(r.paidBtn)}
              </td>
              <td className="py-1.5 text-right tabular-nums font-semibold">
                {formatBtn(r.dueBtn)}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t-2 border-slate-800 font-semibold">
            <td className="py-2" colSpan={3}>
              Totals
            </td>
            <td className="py-2 text-right tabular-nums">{nights}</td>
            <td className="py-2" />
            <td className="py-2 text-right tabular-nums">{formatBtn(amount)}</td>
            <td className="py-2 text-right tabular-nums">{formatBtn(paid)}</td>
            <td className="py-2 text-right tabular-nums">{formatBtn(dues)}</td>
          </tr>
        </tfoot>
      </table>

      <p className="mt-8 text-[10px] text-slate-500">
        Generated for {session.companyName}. Posted folio lines preferred when
        present; otherwise quoted stay totals.
      </p>
    </div>
  );
}
