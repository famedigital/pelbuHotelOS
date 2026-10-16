"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataTable, SortableHeader } from "@/components/ui/data-table";
import type { AgentInvoiceListRow } from "@/lib/agent-portal-dashboard";
import { formatBtn } from "@/lib/pricing";
import type { ColumnDef, FilterFn } from "@tanstack/react-table";
import { PrinterIcon } from "lucide-react";
import Link from "next/link";
import { useMemo } from "react";

const searchFn: FilterFn<AgentInvoiceListRow> = (row, _id, q) => {
  const needle = String(q ?? "").toLowerCase();
  if (!needle) return true;
  const r = row.original;
  return [r.docNo, r.guestName, r.confirmationLabel, r.docKind, r.status]
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
    .includes(needle);
};

export function AgentInvoicesTable({ rows }: { rows: AgentInvoiceListRow[] }) {
  const columns = useMemo<ColumnDef<AgentInvoiceListRow>[]>(
    () => [
      {
        accessorKey: "docNo",
        header: () => <SortableHeader label="Document" />,
        cell: ({ row }) => (
          <div>
            <Link
              href={`/agents/app/invoices/${row.original.id}`}
              className="font-mono text-sm font-semibold text-sky-800 underline-offset-4 hover:underline"
            >
              {row.original.docNo}
            </Link>
            <p className="text-xs capitalize text-muted-foreground">
              {row.original.docKind}
            </p>
          </div>
        ),
      },
      {
        accessorKey: "confirmationLabel",
        header: () => <SortableHeader label="Stay" />,
        cell: ({ row }) => (
          <div className="text-sm">
            {row.original.bookingId ? (
              <Link
                href={`/agents/app/stays/${row.original.bookingId}`}
                className="font-medium underline-offset-4 hover:underline"
              >
                {row.original.confirmationLabel}
              </Link>
            ) : (
              row.original.confirmationLabel
            )}
            <p className="text-xs text-muted-foreground">
              {row.original.guestName ?? "—"}
              {row.original.checkIn
                ? ` · ${row.original.checkIn} → ${row.original.checkOut}`
                : ""}
            </p>
          </div>
        ),
      },
      {
        accessorKey: "status",
        header: () => <SortableHeader label="Status" />,
        cell: ({ row }) => (
          <Badge variant="outline" className="capitalize">
            {row.original.status}
          </Badge>
        ),
      },
      {
        accessorKey: "totalBtn",
        header: () => <SortableHeader label="Amount" />,
        cell: ({ row }) => (
          <span className="font-semibold tabular-nums">
            {row.original.totalBtn == null
              ? "—"
              : formatBtn(row.original.totalBtn)}
          </span>
        ),
        meta: { className: "text-right", headerClassName: "text-right" },
      },
      {
        id: "actions",
        header: "",
        cell: ({ row }) => (
          <Button asChild size="sm" variant="outline" className="h-8 gap-1">
            <Link href={`/agents/app/invoices/${row.original.id}`}>
              <PrinterIcon className="size-3.5" />
              View
            </Link>
          </Button>
        ),
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
      searchPlaceholder="Search INV, guest, stay…"
      emptyMessage="No invoices yet — desk issues INV after charges post."
      caption="Invoices & receipts"
      pageSize={25}
      getRowHref={(r) => `/agents/app/invoices/${r.id}`}
      globalFilterFn={searchFn}
      className="rounded-2xl border border-border/80 bg-card p-3 sm:p-4"
    />
  );
}
