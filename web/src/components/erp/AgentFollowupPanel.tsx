"use client";

import { AgentNameLink } from "@/components/erp/AgentNameLink";
import { useStayHubOptional } from "@/components/erp/StayHubProvider";
import type {
  AgentPayFollowupRow,
  AgentPayStatus,
} from "@/lib/erp/daily-desk";
import { formatBtn } from "@/lib/pricing";
import { cn } from "@/lib/utils";
import Link from "next/link";

function statusLabel(s: AgentPayStatus): string {
  if (s === "paid") return "Paid";
  if (s === "agent_ar_open") return "Agent owes";
  return "Unpaid";
}

function StatusPill({ status }: { status: AgentPayStatus }) {
  return (
    <span
      className={cn(
        "inline-flex rounded-md border px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide",
        status === "paid"
          ? "border-citrus/40 bg-citrus-tint/50 text-citrus"
          : status === "agent_ar_open"
            ? "border-amber-500/40 bg-amber-500/10 text-amber-900 dark:text-amber-200"
            : "border-destructive/40 bg-destructive/10 text-destructive",
      )}
    >
      {statusLabel(status)}
    </span>
  );
}

export function AgentFollowupPanel({
  rows,
  unpaidCount,
  paidCount,
}: {
  rows: AgentPayFollowupRow[];
  unpaidCount: number;
  paidCount: number;
}) {
  const stayHub = useStayHubOptional();

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-foreground">
            Agent / checkout payments
          </h2>
          <p className="text-xs text-muted-foreground">
            Today&apos;s departures + recent agent checkouts — follow up who
            still owes.
          </p>
        </div>
        <p className="text-xs tabular-nums text-muted-foreground">
          <span className="font-medium text-destructive">{unpaidCount} open</span>
          {" · "}
          <span className="font-medium text-citrus">{paidCount} paid</span>
        </p>
      </div>

      {rows.length === 0 ? (
        <p className="rounded-lg border border-dashed bg-muted/20 px-4 py-8 text-center text-sm text-muted-foreground">
          No agent checkouts to follow up right now.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border bg-card">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="border-b bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">Agent</th>
                <th className="px-3 py-2 font-medium">Guest</th>
                <th className="px-3 py-2 font-medium">Room #</th>
                <th className="px-3 py-2 font-medium">Meal</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2 font-medium">Folio</th>
                <th className="px-3 py-2 font-medium">Pack</th>
                <th className="px-3 py-2 font-medium">
                  <span className="sr-only">Open</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.map((row) => (
                <tr key={row.bookingId} className="hover:bg-muted/30">
                  <td className="px-3 py-2.5">
                    {row.agentName ? (
                      <AgentNameLink
                        agentId={row.agentId}
                        name={row.agentName}
                        className="text-sm font-medium"
                      />
                    ) : (
                      <span className="text-muted-foreground">Walk-in</span>
                    )}
                    <p className="text-xs text-muted-foreground">
                      Out {row.checkOut}
                    </p>
                  </td>
                  <td className="px-3 py-2.5">{row.guestName}</td>
                  <td className="px-3 py-2.5 tabular-nums">
                    {row.roomLabels ?? "—"}
                    <span className="ml-1 text-xs text-muted-foreground">
                      ({row.rooms})
                    </span>
                  </td>
                  <td className="px-3 py-2.5 font-medium tabular-nums">
                    {row.mealPlan}
                  </td>
                  <td className="px-3 py-2.5">
                    <StatusPill status={row.payStatus} />
                  </td>
                  <td className="px-3 py-2.5 tabular-nums">
                    {row.folioId ? (
                      <Link
                        href={`/erp/folios/${row.folioId}`}
                        className="text-accent underline-offset-4 hover:underline"
                      >
                        {formatBtn(row.balanceBtn)}
                      </Link>
                    ) : (
                      formatBtn(row.balanceBtn)
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-xs text-muted-foreground">
                    {row.agentId
                      ? row.packSealed
                        ? "Sealed"
                        : "Pending"
                      : "—"}
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    <button
                      type="button"
                      className="inline-flex min-h-9 items-center rounded-md border border-border bg-background px-3 text-sm font-medium hover:bg-muted"
                      onClick={() => {
                        if (stayHub) {
                          stayHub.openStayHub({
                            bookingId: row.bookingId,
                            step:
                              row.bookingStatus === "checked_out"
                                ? "stay_money"
                                : "check_out",
                            board: "departures",
                          });
                        } else {
                          window.location.href = `/erp/bookings/${row.bookingId}`;
                        }
                      }}
                    >
                      Follow up
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        Full agent AR aging:{" "}
        <Link
          href="/erp/reports"
          className="text-accent underline-offset-4 hover:underline"
        >
          Reports
        </Link>
        {" · "}
        <Link
          href="/erp/agents"
          className="text-accent underline-offset-4 hover:underline"
        >
          Agents
        </Link>
        {" · "}
        <Link
          href="/erp/folios"
          className="text-accent underline-offset-4 hover:underline"
        >
          City ledger
        </Link>
      </p>
    </div>
  );
}
