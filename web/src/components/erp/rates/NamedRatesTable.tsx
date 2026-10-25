"use client";

import type { ColumnDef } from "@tanstack/react-table";

import { DataTable } from "@/components/ui/data-table";
import { formatBtn } from "@/lib/pricing";

import { marketLabel, seasonLabel } from "./markets";

export type NamedOfferRow = {
  id: string;
  label: string;
  rateTier: string;
  agentName: string | null;
  guestLabel: string | null;
  roomTypeName: string;
  seasonKind: string;
  amountBtn: number;
  amountSingleBtn: number | null;
};

const columns: ColumnDef<NamedOfferRow>[] = [
  {
    accessorKey: "label",
    header: "Name",
    cell: ({ row }) => (
      <span className="font-medium text-foreground">{row.original.label}</span>
    ),
  },
  {
    accessorKey: "rateTier",
    header: "Market",
    cell: ({ row }) => marketLabel(row.original.rateTier),
  },
  {
    id: "who",
    accessorFn: (row) =>
      row.agentName || row.guestLabel || "Everyone in this market",
    header: "Applies to",
    cell: ({ row }) => (
      <span className="text-muted-foreground">
        {row.original.agentName ||
          row.original.guestLabel ||
          "Everyone in this market"}
      </span>
    ),
  },
  {
    accessorKey: "roomTypeName",
    header: "Room",
  },
  {
    accessorKey: "seasonKind",
    header: "Season",
    cell: ({ row }) => seasonLabel(row.original.seasonKind),
  },
  {
    accessorKey: "amountBtn",
    header: "Double",
    cell: ({ row }) => (
      <span className="tabular-nums">{formatBtn(row.original.amountBtn)}</span>
    ),
  },
  {
    id: "single",
    accessorFn: (row) => row.amountSingleBtn ?? -1,
    header: "Single",
    cell: ({ row }) => (
      <span className="tabular-nums text-muted-foreground">
        {row.original.amountSingleBtn != null && row.original.amountSingleBtn > 0
          ? formatBtn(row.original.amountSingleBtn)
          : "—"}
      </span>
    ),
  },
];

export function NamedRatesTable({ rows }: { rows: NamedOfferRow[] }) {
  return (
    <DataTable
      columns={columns}
      data={rows}
      caption="Named rates for agents and guests"
      searchPlaceholder="Search name, agent, guest, or room…"
      emptyMessage="No named rates yet. Contract and fill-up prices are added with New rate."
      pageSize={25}
    />
  );
}
