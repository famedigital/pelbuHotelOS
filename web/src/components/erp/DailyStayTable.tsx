"use client";

import { AgentNameLink } from "@/components/erp/AgentNameLink";
import { useStayHubOptional } from "@/components/erp/StayHubProvider";
import type { DayOpsRow } from "@/lib/erp/day-ops-board";
import { recommendStayHubStep } from "@/lib/folio/stay-hub-cycle";
import { formatBtn } from "@/lib/pricing";
import { cn } from "@/lib/utils";

export type DailyStayBoardKind = "arrivals" | "departures" | "in_house";

function openStay(
  stayHub: ReturnType<typeof useStayHubOptional>,
  row: DayOpsRow,
  board: DailyStayBoardKind,
) {
  const step = recommendStayHubStep({
    status: row.status ?? "confirmed",
    board,
    balanceBtn: row.folio_balance_btn ?? 0,
    hasRoomAssigned: Boolean(row.room_labels),
    sdfIncomplete: false,
  });
  if (stayHub) {
    stayHub.openStayHub({
      bookingId: row.id,
      step,
      board,
    });
    return;
  }
  window.location.href = `/erp/bookings/${row.id}`;
}

function PayPill({
  balance,
  paymentMode,
}: {
  balance: number | null;
  paymentMode: string | null;
}) {
  const bal = Number(balance ?? 0);
  if (Math.abs(bal) < 0.5) {
    return (
      <span className="inline-flex rounded-md border border-citrus/40 bg-citrus-tint/50 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-citrus">
        Paid
      </span>
    );
  }
  const agent =
    (paymentMode ?? "").toLowerCase().includes("agent") ||
    (paymentMode ?? "").toLowerCase() === "credit" ||
    (paymentMode ?? "").toLowerCase() === "on_account";
  return (
    <span
      className={cn(
        "inline-flex rounded-md border px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide",
        agent
          ? "border-amber-500/40 bg-amber-500/10 text-amber-900 dark:text-amber-200"
          : "border-destructive/40 bg-destructive/10 text-destructive",
      )}
    >
      {agent ? "Agent AR" : "Unpaid"}
    </span>
  );
}

export function DailyStayTable({
  rows,
  board,
  emptyMessage,
}: {
  rows: DayOpsRow[];
  board: DailyStayBoardKind;
  emptyMessage: string;
}) {
  const stayHub = useStayHubOptional();

  if (rows.length === 0) {
    return (
      <p className="rounded-lg border border-dashed bg-muted/20 px-4 py-8 text-center text-sm text-muted-foreground">
        {emptyMessage}
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border bg-card">
      <table className="w-full min-w-[640px] text-left text-sm">
        <thead className="border-b bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
          <tr>
            <th className="px-3 py-2 font-medium">Guest</th>
            {(board === "arrivals" || board === "departures") && (
              <th className="px-3 py-2 font-medium">Agent</th>
            )}
            {board === "arrivals" && (
              <th className="px-3 py-2 font-medium">Guide #</th>
            )}
            <th className="px-3 py-2 font-medium">Rooms</th>
            <th className="px-3 py-2 font-medium">Room #</th>
            <th className="px-3 py-2 font-medium">Meal</th>
            {board === "in_house" && (
              <th className="px-3 py-2 font-medium">Agent</th>
            )}
            {board === "departures" && (
              <>
                <th className="px-3 py-2 font-medium">Pay</th>
                <th className="px-3 py-2 font-medium">Folio</th>
              </>
            )}
            <th className="px-3 py-2 font-medium">
              <span className="sr-only">Open</span>
            </th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {rows.map((row) => (
            <tr
              key={row.id}
              className="hover:bg-muted/30"
            >
              <td className="px-3 py-2.5">
                <p className="font-medium text-foreground">
                  {row.contact_name ?? "Guest"}
                </p>
                <p className="text-xs text-muted-foreground tabular-nums">
                  {row.pax} pax
                  {board === "in_house" && row.check_out
                    ? ` · out ${row.check_out}`
                    : ""}
                </p>
              </td>
              {(board === "arrivals" || board === "departures") && (
                <td className="px-3 py-2.5 text-muted-foreground">
                  {row.agent_name ? (
                    <AgentNameLink
                      agentId={row.agent_id}
                      name={row.agent_name}
                      className="text-sm"
                    />
                  ) : (
                    <span className="text-xs">Walk-in</span>
                  )}
                </td>
              )}
              {board === "arrivals" && (
                <td className="px-3 py-2.5 font-mono text-xs tabular-nums">
                  {row.guide_number ?? "—"}
                </td>
              )}
              <td className="px-3 py-2.5 tabular-nums">{row.rooms}</td>
              <td className="px-3 py-2.5 font-medium tabular-nums">
                {row.room_labels ?? (
                  <span className="font-normal text-muted-foreground">
                    Unassigned
                  </span>
                )}
              </td>
              <td className="px-3 py-2.5 font-medium tabular-nums">
                {row.meal_plan_code}
              </td>
              {board === "in_house" && (
                <td className="px-3 py-2.5 text-muted-foreground">
                  {row.agent_name ? (
                    <AgentNameLink
                      agentId={row.agent_id}
                      name={row.agent_name}
                      className="text-sm"
                    />
                  ) : (
                    "—"
                  )}
                </td>
              )}
              {board === "departures" && (
                <>
                  <td className="px-3 py-2.5">
                    <PayPill
                      balance={row.folio_balance_btn}
                      paymentMode={row.payment_mode}
                    />
                  </td>
                  <td className="px-3 py-2.5 tabular-nums">
                    {row.folio_balance_btn != null ? (
                      <span
                        className={
                          Number(row.folio_balance_btn) > 0.5
                            ? "font-medium text-amber-800 dark:text-amber-200"
                            : "text-muted-foreground"
                        }
                      >
                        {formatBtn(Number(row.folio_balance_btn))}
                      </span>
                    ) : (
                      "—"
                    )}
                  </td>
                </>
              )}
              <td className="px-3 py-2.5 text-right">
                <button
                  type="button"
                  className="inline-flex min-h-9 items-center rounded-md border border-border bg-background px-3 text-sm font-medium hover:bg-muted"
                  onClick={() => openStay(stayHub, row, board)}
                >
                  {board === "arrivals"
                    ? "Check-in"
                    : board === "departures"
                      ? "Checkout"
                      : "Folio"}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
