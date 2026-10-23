"use client";

import { CashierFolioActions } from "@/components/erp/bills/CashierFolioActions";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyState } from "@/components/ui/empty-state";
import type { CashierFolioRow } from "@/lib/erp/cashier-desk";
import { stayFolioHref } from "@/lib/folio/stay-hub-cycle";
import { formatBtn } from "@/lib/pricing";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { useMemo, useState } from "react";

export function BillsStayRegister({ rows }: { rows: CashierFolioRow[] }) {
  const [q, setQ] = useState("");
  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return rows;
    return rows.filter((row) => {
      const hay = [
        row.guestName,
        row.confirmationCode,
        row.rooms,
        row.agentName,
        row.phone,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(needle);
    });
  }, [rows, q]);

  if (rows.length === 0) {
    return (
      <EmptyState
        title="No open bills"
        description="A bill opens when the guest is checked in. Nothing is open on this property."
      />
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-end gap-2">
        <label className="min-w-[14rem] flex-1 space-y-0.5 text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
          Search open bills
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Guest, PS, room, agent"
            className="h-9 text-sm"
            autoFocus
          />
        </label>
        <p className="pb-2 text-[11px] text-muted-foreground">
          {filtered.length} of {rows.length}
        </p>
      </div>
      {filtered.length === 0 ? (
        <EmptyState
          title="No bills match"
          description="Try another guest, room, or confirmation."
        />
      ) : (
        <div className="overflow-x-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="h-8 text-[11px]">Guest</TableHead>
                <TableHead className="h-8 text-[11px]">Rooms</TableHead>
                <TableHead className="h-8 text-[11px]">Agent</TableHead>
                <TableHead className="h-8 text-[11px]">Stay</TableHead>
                <TableHead className="h-8 text-right text-[11px]">Charges</TableHead>
                <TableHead className="h-8 text-right text-[11px]">Paid</TableHead>
                <TableHead className="h-8 text-right text-[11px]">Due</TableHead>
                <TableHead className="h-8 text-[11px]">Invoice</TableHead>
                <TableHead className="h-8 text-[11px]"> </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((row) => {
                const href = stayFolioHref(row.bookingId, row.folioId);
                return (
                  <TableRow key={row.folioId} className="h-11">
                    <TableCell className="max-w-[14rem] text-xs">
                      <Link
                        href={href}
                        className="font-medium text-foreground underline-offset-2 hover:underline"
                      >
                        {row.guestName}
                      </Link>
                      <span className="block truncate text-[10px] text-muted-foreground">
                        {row.confirmationCode ?? "No confirmation"}
                      </span>
                    </TableCell>
                    <TableCell className="max-w-[8rem] truncate text-xs text-muted-foreground">
                      {row.rooms || "—"}
                    </TableCell>
                    <TableCell className="max-w-[10rem] truncate text-xs text-muted-foreground">
                      {row.agentName ?? "—"}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-xs tabular-nums text-muted-foreground">
                      {row.checkIn ?? "—"}
                      <span className="mx-1">–</span>
                      {row.checkOut ?? "—"}
                    </TableCell>
                    <TableCell className="text-right text-xs tabular-nums">
                      {formatBtn(row.chargesBtn)}
                    </TableCell>
                    <TableCell className="text-right text-xs tabular-nums text-muted-foreground">
                      {formatBtn(row.paidBtn)}
                    </TableCell>
                    <TableCell
                      className={cn(
                        "text-right text-xs font-medium tabular-nums",
                        row.dueBtn > 0.5 && "text-destructive",
                      )}
                    >
                      {formatBtn(row.dueBtn)}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-xs">
                      {row.invoiceDocNo ? (
                        <span className="font-mono">{row.invoiceDocNo}</span>
                      ) : (
                        <span className="text-muted-foreground">Not issued</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <CashierFolioActions
                        folioId={row.folioId}
                        bookingId={row.bookingId}
                        invoiceId={row.invoiceId}
                      />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
