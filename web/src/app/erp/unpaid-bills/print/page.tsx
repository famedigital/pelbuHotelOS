import { DeskListShell } from "@/components/erp/DeskListShell";
import { PrintButton } from "@/components/erp/PrintButton";
import { isDeskAuthenticated } from "@/lib/desk-auth";
import { requireDeskPropertyId } from "@/lib/desk-property";
import {
  loadUnpaidBills,
  type UnpaidBillsFilter,
} from "@/lib/erp/unpaid-bills";
import { formatBtn } from "@/lib/pricing";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import Link from "next/link";
import { redirect } from "next/navigation";

export const metadata = {
  title: "Print · Unpaid bills",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

function parseFilter(raw: string | undefined): UnpaidBillsFilter {
  if (raw === "agents" || raw === "guests") return raw;
  return "all";
}

export default async function UnpaidBillsPrintPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>;
}) {
  if (!(await isDeskAuthenticated())) redirect("/erp/login");
  const sp = await searchParams;
  const filter = parseFilter(sp.filter);

  const admin = createSupabaseAdminClient();
  const propertyId = await requireDeskPropertyId();
  const pack = await loadUnpaidBills(admin, { propertyId, filter });
  const list = [...pack.rows, ...pack.orphanAgents];
  const backQs =
    filter === "all" ? "" : `?filter=${encodeURIComponent(filter)}`;

  return (
    <DeskListShell
      eyebrow="Print"
      heading="Unpaid bills"
      blurb={`${list.length} bill(s) · ${formatBtn(pack.totals.totalDue)} to collect. Press Ctrl+P (or Cmd+P) → Save as PDF.`}
      headerAside={
        <div className="flex flex-wrap items-center gap-3 print:hidden">
          <PrintButton label="Print / Save PDF" />
          <Link
            href={`/erp/unpaid-bills${backQs}`}
            className="text-sm font-medium text-accent underline-offset-4 hover:underline"
          >
            Back to list
          </Link>
        </div>
      }
      dense
      wide
    >
      <div className="overflow-x-auto">
        <table className="w-full min-w-[800px] border-collapse text-left text-sm">
          <thead>
            <tr className="border-b text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
              <th className="px-2 py-2 text-right">Amount</th>
              <th className="px-2 py-2">Collect from</th>
              <th className="px-2 py-2">Guest</th>
              <th className="px-2 py-2">Check-in</th>
              <th className="px-2 py-2">Check-out</th>
              <th className="px-2 py-2">Room</th>
              <th className="px-2 py-2">Phone</th>
              <th className="px-2 py-2">Email</th>
              <th className="px-2 py-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {list.length === 0 ? (
              <tr>
                <td
                  colSpan={9}
                  className="px-2 py-8 text-center text-muted-foreground"
                >
                  Nothing to collect.
                </td>
              </tr>
            ) : (
              list.map((r) => (
                <tr
                  key={
                    r.folioId ??
                    `agent-${r.agentId ?? r.collectFrom}-${r.amountDue}`
                  }
                  className="border-b border-border/50"
                >
                  <td className="px-2 py-1.5 text-right tabular-nums font-medium whitespace-nowrap">
                    {formatBtn(r.amountDue)}
                  </td>
                  <td className="px-2 py-1.5">{r.collectFrom}</td>
                  <td className="px-2 py-1.5">{r.guestName}</td>
                  <td className="px-2 py-1.5 tabular-nums whitespace-nowrap">
                    {r.checkIn ?? "—"}
                  </td>
                  <td className="px-2 py-1.5 tabular-nums whitespace-nowrap">
                    {r.checkOut ?? "—"}
                  </td>
                  <td className="px-2 py-1.5">{r.rooms || "—"}</td>
                  <td className="px-2 py-1.5">{r.phone || "—"}</td>
                  <td className="px-2 py-1.5">{r.email || "—"}</td>
                  <td className="px-2 py-1.5 whitespace-nowrap">
                    {r.statusLabel}
                  </td>
                </tr>
              ))
            )}
          </tbody>
          {list.length > 0 ? (
            <tfoot>
              <tr className="border-t font-semibold">
                <td className="px-2 py-2 text-right tabular-nums">
                  {formatBtn(pack.totals.totalDue)}
                </td>
                <td className="px-2 py-2" colSpan={8}>
                  Total · {list.length} bill(s)
                </td>
              </tr>
            </tfoot>
          ) : null}
        </table>
      </div>
    </DeskListShell>
  );
}
