"use client";

import type { ColumnDef } from "@tanstack/react-table";

import { DataTable } from "@/components/ui/data-table";
import { formatBtn } from "@/lib/pricing";

import { marketLabel, seasonLabel } from "./markets";

export type RateLedgerRow = {
  id: string | null;
  room_type_name: string;
  season_kind: string;
  rate_tier: string;
  amount_btn: number;
  amount_single_btn: number | null;
};

const columns: ColumnDef<RateLedgerRow>[] = [
  {
    accessorKey: "room_type_name",
    header: "Room category",
    cell: ({ row }) => (
      <span className="font-medium text-foreground">
        {row.original.room_type_name}
      </span>
    ),
  },
  {
    id: "season_kind",
    accessorFn: (row) => seasonLabel(row.season_kind),
    header: "Season",
    cell: ({ row }) => seasonLabel(row.original.season_kind),
  },
  {
    id: "rate_tier",
    accessorFn: (row) => marketLabel(row.rate_tier),
    header: "Market",
    cell: ({ row }) => marketLabel(row.original.rate_tier),
  },
  {
    accessorKey: "amount_btn",
    header: "Double",
    cell: ({ row }) => (
      <span className="tabular-nums">{formatBtn(row.original.amount_btn)}</span>
    ),
  },
  {
    id: "single",
    accessorFn: (row) => row.amount_single_btn ?? -1,
    header: "Single",
    cell: ({ row }) => (
      <span className="tabular-nums text-muted-foreground">
        {row.original.amount_single_btn != null &&
        row.original.amount_single_btn > 0
          ? formatBtn(row.original.amount_single_btn)
          : "—"}
      </span>
    ),
  },
];

export function RateLedgerTable({ rows }: { rows: RateLedgerRow[] }) {
  return (
    <DataTable
      columns={columns}
      data={rows}
      caption="Standard market rates"
      searchPlaceholder="Search room, season, or market…"
      emptyMessage="No standard rates in this market yet. Use New rate or the edit sheet."
      pageSize={25}
    />
  );
}
