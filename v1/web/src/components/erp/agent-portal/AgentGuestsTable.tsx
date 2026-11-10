"use client";

import {
  AgentStatusPill,
  bookingStatusTone,
} from "@/components/erp/agent-portal/AgentPortalChrome";
import { Button } from "@/components/ui/button";
import { DataTable, SortableHeader } from "@/components/ui/data-table";
import type { AgentGuestRegRow } from "@/lib/agent-portal-dashboard";
import type { ColumnDef, FilterFn } from "@tanstack/react-table";
import Link from "next/link";
import { useMemo } from "react";

const searchFn: FilterFn<AgentGuestRegRow> = (row, _id, q) => {
  const needle = String(q ?? "").toLowerCase();
  if (!needle) return true;
  const r = row.original;
  return [
    r.fullName,
    r.confirmationLabel,
    r.nationality,
    r.passportOrCid,
    r.sdfRef,
    r.checkIn,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
    .includes(needle);
};

export function AgentGuestsTable({ rows }: { rows: AgentGuestRegRow[] }) {
  const columns = useMemo<ColumnDef<AgentGuestRegRow>[]>(
    () => [
      {
        accessorKey: "fullName",
        header: () => <SortableHeader label="Guest" />,
        cell: ({ row }) => (
          <div>
            <p className="font-semibold">{row.original.fullName}</p>
            <p className="text-xs text-muted-foreground">
              {row.original.nationality ?? "—"}
            </p>
          </div>
        ),
      },
      {
        accessorKey: "confirmationLabel",
        header: () => <SortableHeader label="Stay" />,
        cell: ({ row }) => (
          <div className="text-sm">
            <Link
              href={`/agents/app/stays/${row.original.bookingId}`}
              className="font-mono font-medium text-sky-800 underline-offset-4 hover:underline"
            >
              {row.original.confirmationLabel}
            </Link>
            <p className="text-xs text-muted-foreground">
              {row.original.checkIn} → {row.original.checkOut}
            </p>
          </div>
        ),
      },
      {
        accessorKey: "passportOrCid",
        header: () => <SortableHeader label="ID / SDF" />,
        cell: ({ row }) => (
          <div className="text-sm">
            <p className="font-mono text-xs">
              {row.original.passportOrCid ?? "—"}
            </p>
            {row.original.sdfRef ? (
              <p className="text-xs text-muted-foreground">
                SDF {row.original.sdfRef}
              </p>
            ) : null}
          </div>
        ),
      },
      {
        accessorKey: "stayStatus",
        header: () => <SortableHeader label="Status" />,
        cell: ({ row }) => (
          <AgentStatusPill tone={bookingStatusTone(row.original.stayStatus)}>
            {row.original.stayStatus.replace(/_/g, " ")}
          </AgentStatusPill>
        ),
      },
      {
        id: "actions",
        header: "",
        cell: ({ row }) => (
          <Button asChild size="sm" variant="outline" className="h-8">
            <Link href={`/agents/app/stays/${row.original.bookingId}`}>
              Open stay
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
      searchPlaceholder="Search guest, passport, SDF, stay…"
      emptyMessage="No guest registrations yet — desk captures IDs at check-in."
      caption="Guest registrations"
      pageSize={25}
      getRowHref={(r) => `/agents/app/stays/${r.bookingId}`}
      globalFilterFn={searchFn}
      className="rounded-2xl border border-border/80 bg-card p-3 sm:p-4"
    />
  );
}
