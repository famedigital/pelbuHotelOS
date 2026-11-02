"use client";

import { HoldCountdown } from "@/components/erp/HoldCountdown";
import {
  AgentStatusPill,
  bookingStatusTone,
} from "@/components/erp/agent-portal/AgentPortalChrome";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import type { AgentStayRow } from "@/lib/agent-portal-stays";
import { formatBtn } from "@/lib/pricing";
import { cn } from "@/lib/utils";
import {
  ExternalLinkIcon,
  PrinterIcon,
  UploadIcon,
} from "lucide-react";
import Link from "next/link";
import { useMemo } from "react";

function paymentPill(status: AgentStayRow["paymentStatus"]) {
  if (status === "paid") {
    return (
      <span className="glass-badge-clean inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold tracking-wide uppercase">
        Paid
      </span>
    );
  }
  if (status === "partial") {
    return (
      <span className="glass-badge-vip inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold tracking-wide uppercase">
        Partial
      </span>
    );
  }
  if (status === "hold") {
    return (
      <AgentStatusPill tone={bookingStatusTone("held")}>Hold</AgentStatusPill>
    );
  }
  return (
    <span className="glass-badge-dirty inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold tracking-wide uppercase">
      Due
    </span>
  );
}

export function AgentStaysTable({
  rows,
  search = "",
  pendingOnly = false,
}: {
  rows: AgentStayRow[];
  search?: string;
  pendingOnly?: boolean;
}) {
  const filtered = useMemo(() => {
    let list = rows;
    if (pendingOnly) {
      list = list.filter(
        (r) => r.paymentStatus === "unpaid" || r.paymentStatus === "partial",
      );
    }
    const q = search.trim().toLowerCase();
    if (!q) return list;
    return list.filter((r) => {
      const hay = [
        r.confirmationLabel,
        r.guestName,
        r.guideNumber,
        r.nationality,
        r.mealPlanCode,
        r.checkIn,
        r.checkOut,
        ...r.invoices.map((i) => i.docNo),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [rows, search, pendingOnly]);

  const totals = useMemo(() => {
    return filtered.reduce(
      (acc, r) => {
        acc.nights += r.nights * Math.max(1, r.roomsCount);
        acc.amount += r.grandTotalBtn;
        acc.paid += r.paidBtn;
        acc.dues += Math.abs(r.dueBtn) > 0.5 ? r.dueBtn : 0;
        return acc;
      },
      { nights: 0, amount: 0, paid: 0, dues: 0 },
    );
  }, [filtered]);

  return (
    <div className="glass-happy-table-container flex flex-col overflow-hidden">
      <div className="max-h-[min(70vh,52rem)] overflow-auto">
        <table className="w-full min-w-[1100px] border-collapse text-sm">
          <thead className="sticky top-0 z-20 border-b bg-white/95 backdrop-blur-md">
            <tr className="text-left text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
              <th className="sticky left-0 z-30 bg-white/95 px-2 py-2.5 backdrop-blur-md">
                #
              </th>
              <th className="px-2 py-2.5">Ref</th>
              <th className="sticky left-8 z-30 bg-white/95 px-2 py-2.5 backdrop-blur-md sm:left-10">
                Guest
              </th>
              <th className="px-2 py-2.5">Nationality</th>
              <th className="px-2 py-2.5">Guide</th>
              <th className="px-2 py-2.5">Dates</th>
              <th className="px-2 py-2.5 text-right">Nights</th>
              <th className="px-2 py-2.5">Rooms & meal</th>
              <th className="px-2 py-2.5 text-right">Rate</th>
              <th className="px-2 py-2.5 text-right">Total</th>
              <th className="px-2 py-2.5 text-right">GST</th>
              <th className="px-2 py-2.5 text-right">S.C</th>
              <th className="px-2 py-2.5 text-right">G.total</th>
              <th className="px-2 py-2.5">Payment</th>
              <th className="px-2 py-2.5 text-right"> </th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td
                  colSpan={15}
                  className="px-3 py-10 text-center text-sm text-muted-foreground"
                >
                  No stays in this range — adjust the filter or hold rooms.
                </td>
              </tr>
            ) : (
              filtered.map((row, idx) => {
                const inHouse = row.status === "checked_in";
                const dueHot = Math.abs(row.dueBtn) > 0.5;
                return (
                  <tr
                    key={row.id}
                    className={cn(
                      "border-b border-border/60 bg-white transition-transform duration-150 hover:translate-x-1",
                      dueHot
                        ? "hover:bg-rose-50/80"
                        : row.paymentStatus === "paid"
                          ? "hover:bg-emerald-50/70"
                          : "hover:bg-sky-50/60",
                      inHouse && "shadow-[inset_3px_0_0_0_rgba(2,132,199,0.55)]",
                    )}
                  >
                    <td className="sticky left-0 z-10 bg-inherit px-2 py-2 font-mono text-xs text-muted-foreground">
                      {idx + 1}
                    </td>
                    <td className="px-2 py-2">
                      <Link
                        href={`/agents/app/stays/${row.id}`}
                        className="font-mono text-xs font-semibold text-sky-800 underline-offset-2 hover:underline"
                      >
                        {row.confirmationLabel}
                      </Link>
                    </td>
                    <td className="sticky left-8 z-10 bg-inherit px-2 py-2 sm:left-10">
                      <Link
                        href={`/agents/app/stays/${row.id}`}
                        className="font-semibold text-foreground hover:underline"
                      >
                        {row.guestName?.trim() || "—"}
                      </Link>
                      <p className="mt-0.5 text-[11px] text-muted-foreground">
                        <span className="rounded-full bg-secondary px-1.5 py-px font-medium tabular-nums">
                          {row.paxCount} pax
                        </span>
                      </p>
                    </td>
                    <td className="px-2 py-2">
                      {row.nationality ? (
                        <span className="rounded-full border bg-secondary px-2 py-0.5 text-[11px] font-medium">
                          {row.nationality}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-2 py-2 font-mono text-xs text-muted-foreground">
                      {row.guideNumber?.trim() || "—"}
                    </td>
                    <td className="px-2 py-2">
                      <p
                        className={cn(
                          "tabular-nums text-xs font-medium",
                          inHouse && "text-sky-800",
                        )}
                      >
                        {row.checkIn} → {row.checkOut}
                      </p>
                      {row.status === "held" && row.holdExpiresAt ? (
                        <HoldCountdown
                          expiresAt={row.holdExpiresAt}
                          className="mt-0.5 font-mono text-[10px] font-semibold text-amber-800"
                        />
                      ) : null}
                    </td>
                    <td className="px-2 py-2 text-right tabular-nums font-medium">
                      {row.nights}
                    </td>
                    <td className="px-2 py-2">
                      {row.roomDetails.length > 1 ? (
                        <Popover>
                          <PopoverTrigger className="rounded-md border bg-secondary px-2 py-1 text-left text-xs hover:bg-muted">
                            {row.roomsCount} rm · {row.mealPlanCode}
                          </PopoverTrigger>
                          <PopoverContent className="w-56 p-2 text-xs" align="start">
                            <ul className="space-y-1">
                              {row.roomDetails.map((d, i) => (
                                <li key={`${d.categoryName}-${i}`}>
                                  {d.count}× {d.categoryName} · {d.mealPlan}
                                </li>
                              ))}
                            </ul>
                          </PopoverContent>
                        </Popover>
                      ) : (
                        <span className="text-xs">
                          {row.roomLabel ?? `${row.roomsCount} rm`} ·{" "}
                          <span className="font-medium">{row.mealPlanCode}</span>
                        </span>
                      )}
                    </td>
                    <td className="px-2 py-2 text-right tabular-nums text-xs">
                      {formatBtn(row.rateBtn)}
                    </td>
                    <td className="px-2 py-2 text-right tabular-nums text-xs">
                      {formatBtn(row.subtotalBtn)}
                    </td>
                    <td className="px-2 py-2 text-right tabular-nums text-xs">
                      {formatBtn(row.gstBtn)}
                    </td>
                    <td className="px-2 py-2 text-right tabular-nums text-xs">
                      {formatBtn(row.serviceChargeBtn)}
                    </td>
                    <td className="px-2 py-2 text-right tabular-nums text-sm font-semibold">
                      {formatBtn(row.grandTotalBtn)}
                    </td>
                    <td className="px-2 py-2">{paymentPill(row.paymentStatus)}</td>
                    <td className="px-2 py-2">
                      <div className="flex justify-end gap-1">
                        <Button asChild size="sm" variant="ghost" className="h-7 px-2">
                          <Link href={`/agents/app/stays/${row.id}`}>
                            <ExternalLinkIcon className="size-3.5" />
                          </Link>
                        </Button>
                        <Button asChild size="sm" variant="ghost" className="h-7 px-2">
                          <Link
                            href={`/agents/app/stays/${row.id}/voucher`}
                            target="_blank"
                          >
                            <PrinterIcon className="size-3.5" />
                          </Link>
                        </Button>
                        <Button asChild size="sm" variant="ghost" className="h-7 px-2">
                          <Link href={`/agents/app/stays/${row.id}#payment-proof`}>
                            <UploadIcon className="size-3.5" />
                          </Link>
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="sticky bottom-0 z-20 flex flex-wrap items-center gap-3 border-t bg-white px-3 py-2.5 shadow-[0_-8px_24px_rgba(15,23,42,0.06)]">
        <p className="text-xs text-muted-foreground">
          <span className="font-semibold text-foreground">{filtered.length}</span>{" "}
          stays
        </p>
        <p className="text-xs">
          Nights{" "}
          <span className="font-semibold tabular-nums">{totals.nights}</span>
        </p>
        <p className="text-xs">
          Amount{" "}
          <span className="font-semibold tabular-nums">
            {formatBtn(totals.amount)}
          </span>
        </p>
        <p className="text-xs">
          Paid{" "}
          <span className="font-semibold tabular-nums text-emerald-700">
            {formatBtn(totals.paid)}
          </span>
        </p>
        <p className="text-xs">
          Dues{" "}
          <span
            className={cn(
              "font-semibold tabular-nums",
              totals.dues > 0.5 ? "text-amber-700" : "text-foreground",
            )}
          >
            {formatBtn(totals.dues)}
          </span>
        </p>
        {totals.dues > 0.5 ? (
          <div className="ml-auto flex flex-wrap gap-1.5">
            <Button asChild size="sm" variant="outline" className="h-8 text-xs">
              <Link href="/agents/app/money">Pay / RMA QR</Link>
            </Button>
            <Button asChild size="sm" className="h-8 text-xs">
              <Link href="/agents/app/stays?tab=bookings#payment-proof">
                Upload bank advice
              </Link>
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
