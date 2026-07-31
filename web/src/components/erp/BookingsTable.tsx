"use client";

import type { ColumnDef } from "@tanstack/react-table";
import Link from "next/link";

import { DataTable } from "@/components/ui/data-table";
import {
  boardActionHref,
  boardActionLabel,
  type ArrivalBadge,
} from "@/lib/arrival-board";

export type BookingRow = {
  id: string;
  contact_name: string | null;
  contact_phone: string | null;
  check_in: string | null;
  check_out: string | null;
  source: string | null;
  agent_name: string | null;
  adults: number | null;
  rooms: number | null;
  status: string | null;
  room_labels?: string | null;
  badges?: ArrivalBadge[];
  action_label?: string;
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
          : value === "checked_out" ||
              value === "cancelled" ||
              value === "no_show"
            ? "border-border bg-muted text-muted-foreground"
            : "border-border bg-muted text-muted-foreground";
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium tracking-wide uppercase whitespace-nowrap ${tone}`}
    >
      {value.replace(/_/g, " ")}
    </span>
  );
}

function BadgePill({ badge }: { badge: ArrivalBadge }) {
  const tone =
    badge.tone === "danger"
      ? "border-destructive/40 bg-destructive/10 text-destructive"
      : badge.tone === "warn"
        ? "border-amber-500/40 bg-amber-500/10 text-amber-800 dark:text-amber-200"
        : badge.tone === "ok"
          ? "border-citrus/40 bg-citrus-tint/50 text-citrus"
          : "border-border bg-muted text-muted-foreground";
  return (
    <span
      className={`inline-flex max-w-[9rem] truncate items-center rounded-full border px-2 py-0.5 text-[10px] font-medium ${tone}`}
      title={badge.label}
    >
      {badge.label}
    </span>
  );
}

const columns: ColumnDef<BookingRow>[] = [
  {
    accessorKey: "contact_name",
    header: "Guest",
    cell: ({ row }) => (
      <div>
        <p className="font-medium text-foreground">
          {row.original.contact_name ?? "Guest"}
        </p>
        <p className="font-mono text-xs text-muted-foreground">
          {row.original.id.slice(0, 8)} · {row.original.contact_phone ?? "—"}
        </p>
      </div>
    ),
    meta: { className: "px-3" },
  },
  {
    id: "dates",
    header: "Dates",
    cell: ({ row }) => (
      <span className="text-sm">
        {fmtDate(row.original.check_in)} → {fmtDate(row.original.check_out)}
      </span>
    ),
    enableSorting: false,
    meta: { className: "px-3" },
  },
  {
    id: "source_agent",
    header: "Source / agent",
    cell: ({ row }) => (
      <div className="text-sm text-muted-foreground">
        <span className="text-foreground">{row.original.source ?? "—"}</span>
        {row.original.agent_name ? (
          <span className="block">{row.original.agent_name}</span>
        ) : null}
      </div>
    ),
    enableSorting: false,
    meta: { className: "px-3" },
  },
  {
    accessorKey: "rooms",
    header: "Rooms",
    cell: ({ row }) => (
      <div className="text-sm">
        <span className="tabular-nums">
          {Number(row.original.rooms ?? 0)} / {Number(row.original.adults ?? 0)}{" "}
          pax
        </span>
        {row.original.room_labels ? (
          <span className="mt-0.5 block text-xs text-muted-foreground">
            {row.original.room_labels}
          </span>
        ) : null}
      </div>
    ),
    meta: { className: "px-3" },
  },
  {
    id: "readiness",
    header: "Readiness",
    cell: ({ row }) => {
      const badges = row.original.badges ?? [];
      if (badges.length === 0) {
        return <StatusPill value={row.original.status ?? ""} />;
      }
      return (
        <div className="flex max-w-[16rem] flex-wrap gap-1">
          <StatusPill value={row.original.status ?? ""} />
          {badges.map((b) => (
            <BadgePill key={b.key} badge={b} />
          ))}
        </div>
      );
    },
    enableSorting: false,
    meta: { className: "px-3" },
  },
  {
    id: "actions",
    header: () => <span className="sr-only">Actions</span>,
    cell: ({ row }) => (
      <div className="text-right">
        <Link
          href={boardActionHref(row.original.status, row.original.id)}
          className="inline-flex min-h-9 items-center rounded-md border border-accent/30 bg-accent/10 px-3 text-sm font-medium text-accent hover:bg-accent/15"
        >
          {row.original.action_label ?? boardActionLabel(row.original.status)} →
        </Link>
      </div>
    ),
    enableSorting: false,
    meta: { className: "px-3" },
  },
];

export function BookingsTable({
  data,
  caption = "Bookings",
  emptyMessage = "No bookings match.",
}: {
  data: BookingRow[];
  caption?: string;
  emptyMessage?: string;
}) {
  return (
    <>
      <div className="space-y-3 md:hidden">
        {data.length === 0 ? (
          <p className="rounded-xl border border-border bg-card px-4 py-6 text-sm text-muted-foreground">
            {emptyMessage}
          </p>
        ) : (
          data.map((row) => (
            <article
              key={row.id}
              className="rounded-xl border border-border bg-card p-4 shadow-xs"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-medium text-foreground">
                    {row.contact_name ?? "Guest"}
                  </p>
                  <p className="font-mono text-xs text-muted-foreground">
                    {row.id.slice(0, 8)} · {row.contact_phone ?? "—"}
                  </p>
                </div>
                <StatusPill value={row.status ?? ""} />
              </div>
              <p className="mt-3 text-sm text-foreground">
                {fmtDate(row.check_in)} → {fmtDate(row.check_out)}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {row.source ?? "—"}
                {row.agent_name ? ` · ${row.agent_name}` : ""}
              </p>
              <p className="mt-1 text-sm tabular-nums text-muted-foreground">
                {Number(row.rooms ?? 0)} rooms / {Number(row.adults ?? 0)} pax
                {row.room_labels ? ` · ${row.room_labels}` : ""}
              </p>
              {(row.badges?.length ?? 0) > 0 ? (
                <div className="mt-3 flex flex-wrap gap-1">
                  {row.badges?.map((badge) => (
                    <BadgePill key={badge.key} badge={badge} />
                  ))}
                </div>
              ) : null}
              <Link
                href={boardActionHref(row.status, row.id)}
                className="mt-4 inline-flex min-h-11 w-full items-center justify-center rounded-xl border border-accent/30 bg-accent/10 px-4 text-sm font-medium text-accent"
              >
                {row.action_label ?? boardActionLabel(row.status)} →
              </Link>
            </article>
          ))
        )}
      </div>

      <div className="hidden md:block">
        <DataTable
          columns={columns}
          data={data}
          caption={caption}
          emptyMessage={emptyMessage}
          searchPlaceholder="Guest, phone, agent…"
          className="erp"
          searchable={false}
        />
      </div>
    </>
  );
}
