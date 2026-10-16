"use client";

import { HoldCountdown } from "@/components/erp/HoldCountdown";
import {
  AgentStatusPill,
  bookingStatusTone,
} from "@/components/erp/agent-portal/AgentPortalChrome";
import { Button } from "@/components/ui/button";
import { DataTable, SortableHeader } from "@/components/ui/data-table";
import type { AgentStayRow } from "@/lib/agent-portal-stays";
import { formatBtn } from "@/lib/pricing";
import type { ColumnDef, FilterFn } from "@tanstack/react-table";
import {
  ExternalLinkIcon,
  FileTextIcon,
  PrinterIcon,
  UploadIcon,
} from "lucide-react";
import Link from "next/link";
import { useMemo } from "react";

const staySearch: FilterFn<AgentStayRow> = (row, _columnId, filterValue) => {
  const q = String(filterValue ?? "")
    .trim()
    .toLowerCase();
  if (!q) return true;
  const r = row.original;
  const hay = [
    r.confirmationLabel,
    r.guestName,
    r.status,
    r.guideNumber,
    r.roomLabel,
    r.checkIn,
    r.checkOut,
    ...r.invoices.map((i) => i.docNo),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return hay.includes(q);
};

export function AgentStaysTable({
  rows,
  compact = false,
}: {
  rows: AgentStayRow[];
  compact?: boolean;
}) {
  const columns = useMemo<ColumnDef<AgentStayRow>[]>(
    () => [
      {
        accessorKey: "confirmationLabel",
        header: () => <SortableHeader label="Ref" />,
        cell: ({ row }) => (
          <div className="min-w-[7rem]">
            <Link
              href={`/agents/app/stays/${row.original.id}`}
              className="font-mono text-sm font-semibold text-sky-800 underline-offset-4 hover:underline"
            >
              {row.original.confirmationLabel}
            </Link>
            {row.original.guestName ? (
              <p className="mt-0.5 truncate text-xs text-muted-foreground">
                {row.original.guestName}
              </p>
            ) : null}
          </div>
        ),
      },
      {
        accessorKey: "checkIn",
        header: () => <SortableHeader label="Dates" />,
        cell: ({ row }) => (
          <div className="text-sm">
            <p className="font-medium tabular-nums">
              {row.original.checkIn} → {row.original.checkOut}
            </p>
            <p className="text-xs text-muted-foreground">
              {row.original.nights}n · {row.original.rooms} rm
              {row.original.roomLabel
                ? ` · ${row.original.roomLabel}`
                : ""}
            </p>
          </div>
        ),
      },
      {
        accessorKey: "status",
        header: () => <SortableHeader label="Status" />,
        cell: ({ row }) => (
          <div className="space-y-1">
            <AgentStatusPill tone={bookingStatusTone(row.original.status)}>
              {row.original.status.replace(/_/g, " ")}
            </AgentStatusPill>
            {row.original.status === "held" && row.original.holdExpiresAt ? (
              <div className="text-[11px]">
                <HoldCountdown
                  expiresAt={row.original.holdExpiresAt}
                  className="font-mono font-semibold text-amber-800"
                />
              </div>
            ) : null}
          </div>
        ),
      },
      {
        accessorKey: "quotedBtn",
        header: () => <SortableHeader label="Quoted" />,
        cell: ({ row }) => (
          <span className="tabular-nums text-sm font-medium">
            {row.original.quotedBtn == null
              ? "—"
              : formatBtn(row.original.quotedBtn)}
          </span>
        ),
        meta: { className: "text-right", headerClassName: "text-right" },
      },
      {
        accessorKey: "paidBtn",
        header: () => <SortableHeader label="Paid" />,
        cell: ({ row }) => (
          <span className="tabular-nums text-sm">
            {formatBtn(row.original.paidBtn)}
          </span>
        ),
        meta: { className: "text-right", headerClassName: "text-right" },
      },
      {
        accessorKey: "dueBtn",
        header: () => <SortableHeader label="Due" />,
        cell: ({ row }) => {
          const due = row.original.dueBtn;
          return (
            <span
              className={`tabular-nums text-sm font-semibold ${
                Math.abs(due) > 0.5 ? "text-destructive" : "text-foreground"
              }`}
            >
              {formatBtn(due)}
            </span>
          );
        },
        meta: { className: "text-right", headerClassName: "text-right" },
      },
      {
        id: "docs",
        header: "Docs",
        cell: ({ row }) => {
          const inv = row.original.invoices.filter(
            (i) => i.docKind === "invoice",
          );
          return (
            <div className="flex flex-col gap-0.5 text-xs">
              {inv.length === 0 ? (
                <span className="text-muted-foreground">No INV</span>
              ) : (
                inv.slice(0, 2).map((i) => (
                  <Link
                    key={i.id}
                    href={`/agents/app/invoices/${i.id}`}
                    className="font-mono text-sky-800 underline-offset-2 hover:underline"
                  >
                    {i.docNo}
                  </Link>
                ))
              )}
              {row.original.proofCount > 0 ? (
                <span className="text-muted-foreground">
                  {row.original.proofCount} proof
                  {row.original.proofCount === 1 ? "" : "s"}
                </span>
              ) : null}
            </div>
          );
        },
      },
      {
        id: "actions",
        header: "",
        cell: ({ row }) => {
          const id = row.original.id;
          return (
            <div className="flex flex-wrap justify-end gap-1">
              <Button asChild size="sm" variant="default" className="h-8">
                <Link href={`/agents/app/stays/${id}`}>
                  <ExternalLinkIcon className="size-3.5" />
                  Open
                </Link>
              </Button>
              <Button asChild size="sm" variant="outline" className="h-8">
                <Link href={`/agents/app/stays/${id}/voucher`} target="_blank">
                  <PrinterIcon className="size-3.5" />
                  Print
                </Link>
              </Button>
              <Button asChild size="sm" variant="outline" className="h-8">
                <Link href={`/agents/app/stays/${id}#payment-proof`}>
                  <UploadIcon className="size-3.5" />
                  Proof
                </Link>
              </Button>
              {row.original.invoices[0] ? (
                <Button asChild size="sm" variant="ghost" className="h-8">
                  <Link
                    href={`/agents/app/invoices/${row.original.invoices[0].id}`}
                  >
                    <FileTextIcon className="size-3.5" />
                    INV
                  </Link>
                </Button>
              ) : null}
            </div>
          );
        },
        meta: { className: "text-right" },
      },
    ],
    [],
  );

  return (
    <DataTable
      columns={columns}
      data={rows}
      searchable
      searchPlaceholder="Search ref, guest, INV, dates…"
      emptyMessage="No stays yet — Hold rooms to create a timed booking."
      caption="Your stays"
      pageSize={compact ? 8 : 25}
      getRowHref={(r) => `/agents/app/stays/${r.id}`}
      globalFilterFn={staySearch}
      className="rounded-2xl border border-border/80 bg-card p-3 sm:p-4"
    />
  );
}
