"use client";

import type { ColumnDef } from "@tanstack/react-table";
import Link from "next/link";

import { DataTable } from "@/components/ui/data-table";

export type GuestStay = {
  guestId: string;
  full_name: string;
  nationality: string | null;
  passport_or_cid: string | null;
  sdf_ref: string | null;
  sdf_doc_url: string | null;
  booking_id: string;
  contact_phone: string | null;
  check_in: string;
  check_out: string;
  status: string;
  guest_origin: string | null;
  stay_count: number;
};

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  return iso;
}

function StatusPill({ value }: { value: string }) {
  if (!value) return null;
  const tone =
    value === "checked_in" || value === "open"
      ? "border-citrus/40 bg-citrus-tint/60 text-citrus"
      : value === "confirmed"
        ? "border-accent/30 bg-accent/10 text-accent"
        : value === "held" || value === "pending"
          ? "border-destructive/30 bg-destructive/5 text-destructive"
          : "border-border bg-muted text-muted-foreground";
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide whitespace-nowrap ${tone}`}
    >
      {value.replace(/_/g, " ")}
    </span>
  );
}

const columns: ColumnDef<GuestStay>[] = [
  {
    accessorKey: "full_name",
    header: "Guest",
    cell: ({ row }) => (
      <div>
        <p className="font-medium text-foreground">{row.original.full_name}</p>
        <p className="text-xs text-muted-foreground">
          {row.original.contact_phone ?? "—"}
        </p>
      </div>
    ),
    meta: { className: "px-3" },
  },
  {
    accessorKey: "nationality",
    header: "Nationality",
    cell: ({ row }) => (
      <div className="text-muted-foreground">
        {row.original.nationality ?? "—"}
        {row.original.guest_origin ? (
          <span className="mt-0.5 block text-[10px] tracking-wide text-accent uppercase">
            {row.original.guest_origin}
          </span>
        ) : null}
      </div>
    ),
    meta: { className: "px-3" },
  },
  {
    id: "id_sdf",
    header: "ID / SDF",
    cell: ({ row }) => (
      <div className="font-mono text-xs text-foreground/80">
        <div>{row.original.passport_or_cid ?? "—"}</div>
        <div className="text-muted-foreground">
          SDF {row.original.sdf_ref ?? "—"}
        </div>
        {row.original.sdf_doc_url ? (
          <a
            href={row.original.sdf_doc_url}
            target="_blank"
            rel="noreferrer"
            className="text-accent underline-offset-2 hover:underline"
          >
            Doc
          </a>
        ) : null}
      </div>
    ),
    enableSorting: false,
    meta: { className: "px-3" },
  },
  {
    id: "stay",
    header: "Stay",
    cell: ({ row }) => (
      <span className="text-sm text-foreground">
        {fmtDate(row.original.check_in)} → {fmtDate(row.original.check_out)}
      </span>
    ),
    enableSorting: false,
    meta: { className: "px-3" },
  },
  {
    accessorKey: "stay_count",
    header: "Stays",
    cell: ({ row }) => (
      <span className="tabular-nums text-foreground">
        {row.original.stay_count}
      </span>
    ),
    meta: { className: "px-3" },
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => <StatusPill value={row.original.status} />,
    enableSorting: false,
    meta: { className: "px-3" },
  },
  {
    id: "actions",
    header: () => <span className="sr-only">Actions</span>,
    cell: ({ row }) => (
      <div className="text-right">
        <Link
          href={`/erp/check-in?id=${row.original.booking_id}`}
          className="text-sm text-accent underline-offset-4 hover:underline"
        >
          Open →
        </Link>
      </div>
    ),
    enableSorting: false,
    meta: { className: "px-3" },
  },
];

export function GuestsTable({ data }: { data: GuestStay[] }) {
  return (
    <>
      <div className="space-y-3 md:hidden">
        {data.length === 0 ? (
          <p className="rounded-xl border border-border bg-card px-4 py-6 text-sm text-muted-foreground">
            No guests match.
          </p>
        ) : (
          data.map((row) => (
            <article
              key={`${row.guestId}-${row.booking_id}`}
              className="rounded-xl border border-border bg-card p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-medium">{row.full_name}</p>
                  <p className="text-xs text-muted-foreground">
                    {row.contact_phone ?? "—"}
                  </p>
                </div>
                <StatusPill value={row.status} />
              </div>
              <p className="mt-3 text-sm text-muted-foreground">
                {row.nationality ?? "—"}
                {row.guest_origin ? ` · ${row.guest_origin}` : ""}
              </p>
              <p className="mt-1 font-mono text-xs text-muted-foreground">
                {row.passport_or_cid ?? "—"} · SDF {row.sdf_ref ?? "—"}
              </p>
              <p className="mt-1 text-sm">
                {fmtDate(row.check_in)} → {fmtDate(row.check_out)} · {row.stay_count}{" "}
                stays
              </p>
              <Link
                href={`/erp/check-in?id=${row.booking_id}`}
                className="mt-4 inline-flex min-h-11 w-full items-center justify-center rounded-xl border border-accent/30 bg-accent/10 text-sm font-medium text-accent"
              >
                Open →
              </Link>
            </article>
          ))
        )}
      </div>
      <div className="hidden md:block">
        <DataTable
          columns={columns}
          data={data}
          caption="Guests"
          emptyMessage="No guests match."
          searchPlaceholder="Name, passport/CID, SDF, phone…"
          className="erp"
          searchable={false}
        />
      </div>
    </>
  );
}
