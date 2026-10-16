"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataTable, SortableHeader } from "@/components/ui/data-table";
import type { AgentPaymentListRow } from "@/lib/agent-portal-dashboard";
import { formatBtn } from "@/lib/pricing";
import type { ColumnDef, FilterFn } from "@tanstack/react-table";
import Link from "next/link";
import { useMemo } from "react";

const searchFn: FilterFn<AgentPaymentListRow> = (row, _id, q) => {
  const needle = String(q ?? "").toLowerCase();
  if (!needle) return true;
  const r = row.original;
  return [r.method, r.reference, r.guestName, r.confirmationLabel, r.paidAt]
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
    .includes(needle);
};

export function AgentPaymentsTable({ rows }: { rows: AgentPaymentListRow[] }) {
  const columns = useMemo<ColumnDef<AgentPaymentListRow>[]>(
    () => [
      {
        accessorKey: "paidAt",
        header: () => <SortableHeader label="When" />,
        cell: ({ row }) => (
          <span className="text-sm tabular-nums">{row.original.paidAt}</span>
        ),
      },
      {
        accessorKey: "amountBtn",
        header: () => <SortableHeader label="Amount" />,
        cell: ({ row }) => (
          <span className="font-semibold tabular-nums">
            {formatBtn(row.original.amountBtn)}
          </span>
        ),
        meta: { className: "text-right", headerClassName: "text-right" },
      },
      {
        accessorKey: "method",
        header: () => <SortableHeader label="Method" />,
        cell: ({ row }) => (
          <Badge variant="secondary" className="capitalize">
            {row.original.method.replace(/_/g, " ")}
          </Badge>
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
                className="font-mono font-medium text-sky-800 underline-offset-4 hover:underline"
              >
                {row.original.confirmationLabel}
              </Link>
            ) : (
              <span className="font-mono">{row.original.confirmationLabel}</span>
            )}
            <p className="text-xs text-muted-foreground">
              {row.original.guestName ?? "—"}
              {row.original.reference ? ` · ${row.original.reference}` : ""}
            </p>
          </div>
        ),
      },
      {
        id: "actions",
        header: "",
        cell: ({ row }) =>
          row.original.bookingId ? (
            <Button asChild size="sm" variant="outline" className="h-8">
              <Link href={`/agents/app/stays/${row.original.bookingId}`}>
                Stay
              </Link>
            </Button>
          ) : null,
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
      searchPlaceholder="Search method, ref, stay…"
      emptyMessage="No payments yet."
      caption="Payments"
      pageSize={25}
      globalFilterFn={searchFn}
      className="rounded-2xl border border-border/80 bg-card p-3 sm:p-4"
    />
  );
}
