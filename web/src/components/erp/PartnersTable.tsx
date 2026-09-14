"use client";

import type { ColumnDef } from "@tanstack/react-table";

import { DataTable } from "@/components/ui/data-table";
import type { PartnerRow } from "@/app/erp/partners/page";
import { PartnerDiscountForm } from "./PartnerDiscountForm";
import { PartnerRowActions } from "./PartnerRowActions";

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function relativeDays(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(`${iso}T00:00:00`).getTime();
  if (Number.isNaN(d)) return "";
  const diff = Math.round((Date.now() - d) / 86_400_000);
  if (diff <= 0) return "today";
  if (diff === 1) return "yesterday";
  if (diff < 30) return `${diff} days ago`;
  if (diff < 365) return `${Math.round(diff / 30)} mo ago`;
  return `${Math.round(diff / 365)} yr ago`;
}

function buildColumns(
  kind: "guide" | "driver",
): ColumnDef<PartnerRow>[] {
  const cols: ColumnDef<PartnerRow>[] = [
    {
      accessorKey: "full_name",
      header: kind === "guide" ? "Guide" : "Driver",
      cell: ({ row }) => (
        <span className="font-medium text-foreground">
          {row.original.full_name ?? "—"}
        </span>
      ),
      meta: { className: "px-3" },
    },
  ];

  if (kind === "guide") {
    cols.push({
      accessorKey: "guide_number",
      header: "Number",
      cell: ({ row }) => (
        <span className="font-mono text-xs text-muted-foreground">
          {row.original.guide_number ?? "—"}
        </span>
      ),
      meta: { className: "px-3" },
    });
  }

  cols.push(
    {
      accessorKey: "phone",
      header: "Phone",
      cell: ({ row }) => (
        <span className="text-muted-foreground">
          {row.original.phone ?? "—"}
        </span>
      ),
      meta: { className: "px-3" },
    },
  );

  if (kind === "driver") {
    cols.push({
      accessorKey: "vehicle_no",
      header: "Vehicle",
      cell: ({ row }) => (
        <span className="font-mono text-xs text-muted-foreground">
          {row.original.vehicle_no ?? "—"}
        </span>
      ),
      meta: { className: "px-3" },
    });
  }

  cols.push(
    {
      accessorKey: "visit_count",
      header: "Visits",
      cell: ({ row }) => (
        <span className="inline-flex items-center rounded-full border border-citrus/40 bg-citrus-tint/60 px-2 py-0.5 text-[11px] font-medium text-citrus">
          {row.original.visit_count}
        </span>
      ),
      meta: { className: "px-3 text-right" },
    },
    {
      id: "discount",
      header: "Discount",
      cell: ({ row }) => (
        <PartnerDiscountForm
          kind={kind}
          partnerId={row.original.id}
          discountPct={Number(row.original.discount_pct ?? 0)}
        />
      ),
      enableSorting: false,
      meta: { className: "px-3" },
    },
    {
      accessorKey: "last_seen_at",
      header: "Last seen",
      cell: ({ row }) => {
        const rel = relativeDays(row.original.last_seen_at);
        return (
          <span className="text-muted-foreground">
            {fmtDate(row.original.last_seen_at)}
            {rel ? <span className="ml-1 text-[11px]">· {rel}</span> : null}
          </span>
        );
      },
      meta: { className: "px-3" },
    },
    {
      id: "actions",
      header: () => <span className="sr-only">Actions</span>,
      cell: ({ row }) => (
        <div className="flex justify-end">
          <PartnerRowActions
            kind={kind}
            partnerId={row.original.id}
            searchToken={
              kind === "guide"
                ? row.original.guide_number ?? row.original.full_name ?? row.original.phone ?? ""
                : row.original.full_name ?? row.original.phone ?? ""
            }
            phone={row.original.phone}
          />
        </div>
      ),
      enableSorting: false,
      meta: { className: "px-3" },
    },
  );

  return cols;
}

export function PartnersTable({
  rows,
  kind,
}: {
  rows: PartnerRow[];
  kind: "guide" | "driver";
}) {
  if (rows.length === 0) {
    return (
      <p className="erp rounded-lg border bg-card px-5 py-6 text-sm text-muted-foreground">
        No {kind === "guide" ? "guides" : "drivers"} recorded yet. They will
        appear here after the first check-in.
      </p>
    );
  }

  return (
    <DataTable
      columns={buildColumns(kind)}
      data={rows}
      caption={`${kind === "guide" ? "Guides" : "Drivers"} sorted by visit count.`}
      emptyMessage={`No ${kind === "guide" ? "guides" : "drivers"} match.`}
      searchPlaceholder="Search by name, number, phone…"
      className="erp"
      searchable={false}
    />
  );
}
