"use client";

import { AgentNameLink } from "@/components/erp/AgentNameLink";
import type { ColumnDef } from "@tanstack/react-table";

import { useStayHubOptional } from "@/components/erp/StayHubProvider";
import { DataTable } from "@/components/ui/data-table";
import {
  boardActionHref,
  boardActionLabel,
  type ArrivalBadge,
} from "@/lib/arrival-board";
import { bookingConfirmationLabel } from "@/lib/booking-ref";
import { recommendStayHubStep } from "@/lib/folio/stay-hub-cycle";
import { seedStayFromBoardRow } from "@/lib/folio/stay-hub-seed";

export type BookingRow = {
  id: string;
  /** Stay confirmation PS-YYYY-##### when allocated. */
  confirmation_code?: string | null;
  contact_name: string | null;
  contact_phone: string | null;
  check_in: string | null;
  check_out: string | null;
  source: string | null;
  agent_id?: string | null;
  agent_name: string | null;
  agent_phone?: string | null;
  adults: number | null;
  children?: number | null;
  /** adults + children when known */
  pax?: number | null;
  rooms: number | null;
  meal_plan_code?: string | null;
  guide_number?: string | null;
  guide_name?: string | null;
  guide_phone?: string | null;
  driver_name?: string | null;
  driver_phone?: string | null;
  folio_id?: string | null;
  folio_balance_btn?: number | null;
  open_laundry_count?: number;
  status: string | null;
  room_labels?: string | null;
  /** Assigned physical units vs sold room count. */
  assigned_count?: number;
  room_fit?: "none" | "partial" | "full" | "n_a";
  created_at?: string | null;
  badges?: ArrivalBadge[];
  action_label?: string;
};

export type BoardKind =
  | "arrivals"
  | "in_house"
  | "departures"
  | "reservations"
  | "auto";

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

function openRow(
  stayHub: ReturnType<typeof useStayHubOptional>,
  row: BookingRow,
  board: BoardKind,
) {
  const step = recommendStayHubStep({
    status: row.status ?? "confirmed",
    board,
    balanceBtn: row.folio_balance_btn ?? 0,
    hasRoomAssigned: Boolean(row.room_labels),
    sdfIncomplete: row.badges?.some((b) => b.key === "sdf") ?? false,
  });
  if (stayHub) {
    stayHub.openStayHub({
      bookingId: row.id,
      step,
      board,
      seedStay: seedStayFromBoardRow(row),
    });
    return;
  }
  window.location.href = boardActionHref(row.status, row.id, board);
}

export function BookingsTable({
  data,
  caption = "Bookings",
  emptyMessage = "No bookings match.",
  board = "auto",
}: {
  data: BookingRow[];
  caption?: string;
  emptyMessage?: string;
  board?: BoardKind;
}) {
  const stayHub = useStayHubOptional();

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
            {bookingConfirmationLabel({
              confirmationCode: row.original.confirmation_code,
              bookingId: row.original.id,
            })}{" "}
            · {row.original.contact_phone ?? "—"}
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
            <span className="block">
              <AgentNameLink
                agentId={row.original.agent_id}
                name={row.original.agent_name}
                className="text-sm"
              />
            </span>
          ) : null}
          {row.original.agent_phone ? (
            <span className="block text-xs tabular-nums">
              {row.original.agent_phone}
            </span>
          ) : null}
        </div>
      ),
      enableSorting: false,
      meta: { className: "px-3" },
    },
    {
      accessorKey: "rooms",
      header: "Rooms / pax",
      cell: ({ row }) => {
        const pax =
          row.original.pax ??
          Number(row.original.adults ?? 0) +
            Math.max(0, Number(row.original.children ?? 0));
        const children = Math.max(0, Number(row.original.children ?? 0));
        return (
          <div className="text-sm">
            <span className="tabular-nums">
              {Number(row.original.rooms ?? 0)} rm · {pax} pax
              {children > 0 ? (
                <span className="text-muted-foreground">
                  {" "}
                  ({row.original.adults ?? 0}+{children})
                </span>
              ) : null}
            </span>
            {row.original.room_labels ? (
              <span className="mt-0.5 block text-xs text-muted-foreground">
                {row.original.room_labels}
              </span>
            ) : null}
          </div>
        );
      },
      meta: { className: "px-3" },
    },
    {
      id: "meal",
      header: "Meal",
      cell: ({ row }) => (
        <span className="text-sm font-medium tabular-nums">
          {(row.original.meal_plan_code ?? "EP").toUpperCase()}
        </span>
      ),
      enableSorting: false,
      meta: { className: "px-3" },
    },
    {
      id: "guide_driver",
      header: "Guide / driver",
      cell: ({ row }) => {
        const guide =
          row.original.guide_name ||
          row.original.guide_number ||
          null;
        const driver = row.original.driver_name;
        if (!guide && !driver) {
          return <span className="text-sm text-muted-foreground">—</span>;
        }
        return (
          <div className="max-w-[10rem] text-xs text-muted-foreground">
            {guide ? (
              <p className="truncate text-foreground" title={guide}>
                G: {guide}
                {row.original.guide_phone
                  ? ` · ${row.original.guide_phone}`
                  : ""}
              </p>
            ) : null}
            {driver ? (
              <p className="truncate" title={driver}>
                D: {driver}
                {row.original.driver_phone
                  ? ` · ${row.original.driver_phone}`
                  : ""}
              </p>
            ) : null}
          </div>
        );
      },
      enableSorting: false,
      meta: { className: "px-3" },
    },
    ...(board === "departures" || board === "in_house"
      ? ([
          {
            id: "folio_laundry",
            header: board === "departures" ? "Folio / laundry" : "Folio",
            cell: ({ row }: { row: { original: BookingRow } }) => {
              const bal = row.original.folio_balance_btn;
              const laundry = row.original.open_laundry_count ?? 0;
              return (
                <div className="text-sm tabular-nums">
                  {bal != null ? (
                    <p
                      className={
                        bal > 0
                          ? "font-medium text-amber-800 dark:text-amber-200"
                          : "text-muted-foreground"
                      }
                    >
                      Nu {Math.round(bal).toLocaleString()}
                    </p>
                  ) : (
                    <p className="text-muted-foreground">—</p>
                  )}
                  {board === "departures" && laundry > 0 ? (
                    <p className="text-xs font-medium text-destructive">
                      {laundry} laundry open
                    </p>
                  ) : null}
                </div>
              );
            },
            enableSorting: false,
            meta: { className: "px-3" },
          },
        ] as ColumnDef<BookingRow>[])
      : []),
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
          <button
            type="button"
            className="inline-flex min-h-9 items-center rounded-md border border-border bg-background px-3 text-sm font-medium text-foreground hover:bg-muted"
            onClick={(e) => {
              e.stopPropagation();
              openRow(stayHub, row.original, board);
            }}
          >
            {row.original.action_label ?? boardActionLabel(row.original.status)}{" "}
            →
          </button>
        </div>
      ),
      enableSorting: false,
      meta: { className: "px-3" },
    },
  ];

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
              role="button"
              tabIndex={0}
              onClick={() => openRow(stayHub, row, board)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  openRow(stayHub, row, board);
                }
              }}
              className="cursor-pointer rounded-xl border border-border bg-card p-4 shadow-xs"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-medium text-foreground">
                    {row.contact_name ?? "Guest"}
                  </p>
                  <p className="font-mono text-xs text-muted-foreground">
                    {bookingConfirmationLabel({
                      confirmationCode: row.confirmation_code,
                      bookingId: row.id,
                    })}{" "}
                    · {row.contact_phone ?? "—"}
                  </p>
                </div>
                <StatusPill value={row.status ?? ""} />
              </div>
              <p className="mt-3 text-sm text-foreground">
                {fmtDate(row.check_in)} → {fmtDate(row.check_out)}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {row.source ?? "—"}
                {row.agent_name ? (
                  <>
                    {" · "}
                    <AgentNameLink
                      agentId={row.agent_id}
                      name={row.agent_name}
                      className="text-sm"
                    />
                  </>
                ) : null}
              </p>
              <p className="mt-1 text-sm tabular-nums text-muted-foreground">
                {Number(row.rooms ?? 0)} rooms /{" "}
                {row.pax ??
                  Number(row.adults ?? 0) +
                    Math.max(0, Number(row.children ?? 0))}{" "}
                pax
                {row.meal_plan_code ? ` · ${row.meal_plan_code}` : ""}
                {row.room_labels ? ` · ${row.room_labels}` : ""}
              </p>
              {row.agent_phone || row.guide_name || row.driver_name ? (
                <p className="mt-1 text-xs text-muted-foreground">
                  {row.agent_phone ? `Agent ${row.agent_phone}` : null}
                  {row.guide_name
                    ? `${row.agent_phone ? " · " : ""}Guide ${row.guide_name}`
                    : null}
                  {row.driver_name
                    ? `${row.agent_phone || row.guide_name ? " · " : ""}Driver ${row.driver_name}`
                    : null}
                </p>
              ) : null}
              {board === "departures" && (row.open_laundry_count ?? 0) > 0 ? (
                <p className="mt-1 text-xs font-medium text-destructive">
                  {row.open_laundry_count} laundry open
                </p>
              ) : null}
              {(row.badges?.length ?? 0) > 0 ? (
                <div className="mt-3 flex flex-wrap gap-1">
                  {row.badges?.map((badge) => (
                    <BadgePill key={badge.key} badge={badge} />
                  ))}
                </div>
              ) : null}
              <span className="mt-4 inline-flex min-h-11 w-full items-center justify-center rounded-xl border border-border bg-background px-4 text-sm font-medium text-foreground">
                {row.action_label ?? boardActionLabel(row.status)} →
              </span>
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
          getRowHref={(row) => boardActionHref(row.status, row.id, board)}
        />
      </div>
    </>
  );
}
