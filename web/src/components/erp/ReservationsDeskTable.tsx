"use client";

import { assignBookingRoomUnit } from "@/app/actions/erp-reservations-party";
import { AgentNameLink } from "@/components/erp/AgentNameLink";
import { useStayHubOptional } from "@/components/erp/StayHubProvider";
import { DataTable } from "@/components/ui/data-table";
import { seedStayFromBoardRow } from "@/lib/folio/stay-hub-seed";
import { recommendStayHubStep } from "@/lib/folio/stay-hub-cycle";
import type { ReservationView } from "@/lib/erp/reservation-views";
import { cn } from "@/lib/utils";
import type { ColumnDef, FilterFn } from "@tanstack/react-table";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition, type ReactNode } from "react";
import { toast } from "sonner";

export type ReservationDeskRow = {
  id: string;
  confirmationCode: string | null;
  guest: string | null;
  phone: string | null;
  agentId: string | null;
  agentName: string | null;
  checkIn: string | null;
  checkOut: string | null;
  status: string | null;
  rooms: number;
  roomLabels: string | null;
  assignmentId: string | null;
  roomUnitId: string | null;
  roomTypeId: string | null;
  assignmentCount: number;
  folioId: string | null;
};

export type ReservationDoor = {
  id: string;
  label: string;
  roomTypeId: string;
};

const VIEWS: { id: ReservationView; label: string }[] = [
  { id: "in_house", label: "In house" },
  { id: "departures", label: "Departures" },
  { id: "arrivals", label: "Arrivals" },
  { id: "upcoming", label: "Upcoming" },
  { id: "all", label: "All" },
];

function viewHref(view: ReservationView): string {
  if (view === "in_house") return "/erp/reservations";
  return `/erp/reservations?view=${view}`;
}

function boardFor(view: ReservationView) {
  if (view === "in_house") return "in_house" as const;
  if (view === "departures") return "departures" as const;
  if (view === "arrivals") return "arrivals" as const;
  return "reservations" as const;
}

function StatusPill({ value }: { value: string | null }) {
  if (!value) return null;
  const tone =
    value === "checked_in"
      ? "border-citrus/40 bg-citrus-tint/60 text-citrus"
      : value === "confirmed"
        ? "border-sky-300 bg-sky-50 text-sky-800"
        : value === "held" || value === "pending"
          ? "border-destructive/30 bg-destructive/5 text-destructive"
          : "border-border bg-muted text-muted-foreground";
  return (
    <span
      className={cn(
        "inline-flex rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide whitespace-nowrap",
        tone,
      )}
    >
      {value.replace(/_/g, " ")}
    </span>
  );
}

const rowFilter: FilterFn<ReservationDeskRow> = (row, _columnId, filterValue) => {
  const q = String(filterValue ?? "").trim().toLowerCase();
  if (!q) return true;
  const r = row.original;
  return [r.guest, r.phone, r.confirmationCode, r.agentName, r.roomLabels, r.status]
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
    .includes(q);
};

function RoomCell({
  row,
  doors,
  enabled,
}: {
  row: ReservationDeskRow;
  doors: ReservationDoor[];
  enabled: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  if (!enabled || row.assignmentCount > 1) {
    return (
      <span className="font-medium text-sky-800 tabular-nums">
        {row.roomLabels || "—"}
      </span>
    );
  }
  const options = doors.filter(
    (door) => !row.roomTypeId || door.roomTypeId === row.roomTypeId,
  );
  const choices =
    row.roomUnitId && !options.some((door) => door.id === row.roomUnitId)
      ? [
          {
            id: row.roomUnitId,
            label: row.roomLabels || "Current",
            roomTypeId: row.roomTypeId ?? "",
          },
          ...options,
        ]
      : options;
  return (
    <select
      aria-label={`Room for ${row.guest ?? "guest"}`}
      className="h-8 w-full min-w-[7.5rem] rounded-md border border-input bg-background px-2 text-sm font-medium tabular-nums"
      value={row.roomUnitId ?? ""}
      disabled={pending}
      onClick={(event) => event.stopPropagation()}
      onChange={(event) => {
        const next = event.target.value;
        if (!next || next === row.roomUnitId) return;
        startTransition(async () => {
          const result = await assignBookingRoomUnit({
            bookingId: row.id,
            roomUnitId: next,
            assignmentId: row.assignmentId,
          });
          if (!result.ok) {
            toast.error(result.error ?? "Could not change room");
            return;
          }
          toast.success(result.message ?? "Room updated");
          router.refresh();
        });
      }}
    >
      <option value="">{row.roomUnitId ? "Room" : "Assign"}</option>
      {choices.map((door) => (
        <option key={door.id} value={door.id}>
          {door.label}
        </option>
      ))}
    </select>
  );
}

export function ReservationsDeskTable({
  rows,
  doors,
  view,
  allowRoomEdit,
  toolbar,
}: {
  rows: ReservationDeskRow[];
  doors: ReservationDoor[];
  view: ReservationView;
  allowRoomEdit: boolean;
  toolbar?: ReactNode;
}) {
  const stayHub = useStayHubOptional();
  const board = boardFor(view);

  const columns: ColumnDef<ReservationDeskRow>[] = [
    {
      id: "guest",
      accessorFn: (row) => row.guest ?? "",
      header: "Guest",
      cell: ({ row }) => (
        <div className="min-w-[12rem]">
          <p className="font-medium text-foreground">
            {row.original.guest ?? "Guest"}
          </p>
          <p className="text-xs text-muted-foreground">
            {row.original.confirmationCode || row.original.phone || "—"}
          </p>
        </div>
      ),
    },
    {
      id: "agent",
      accessorFn: (row) => row.agentName ?? "",
      header: "Agent",
      cell: ({ row }) =>
        row.original.agentName ? (
          <AgentNameLink
            agentId={row.original.agentId}
            name={row.original.agentName}
            className="text-sm"
          />
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
    {
      id: "stay",
      accessorFn: (row) => row.checkIn ?? "",
      header: "Stay",
      cell: ({ row }) => (
        <span className="whitespace-nowrap tabular-nums text-muted-foreground">
          {(row.original.checkIn ?? "—").slice(0, 10)}
          {" → "}
          {(row.original.checkOut ?? "—").slice(0, 10)}
        </span>
      ),
    },
    {
      id: "status",
      accessorFn: (row) => row.status ?? "",
      header: "Status",
      cell: ({ row }) => <StatusPill value={row.original.status} />,
    },
    {
      id: "rooms",
      accessorFn: (row) => row.roomLabels ?? "",
      header: "Rooms",
      meta: { className: "min-w-[11rem] w-[14rem]", headerClassName: "min-w-[11rem]" },
      cell: ({ row }) => (
        <RoomCell
          row={row.original}
          doors={doors}
          enabled={allowRoomEdit}
        />
      ),
    },
  ];

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1">
        {VIEWS.map((item) => (
          <Link
            key={item.id}
            href={viewHref(item.id)}
            data-state={view === item.id ? "active" : "inactive"}
            className={cn(
              "inline-flex h-8 items-center rounded-md px-3 text-sm font-medium",
              view === item.id
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            {item.label}
          </Link>
        ))}
      </div>
      <DataTable
        columns={columns}
        data={rows}
        pageSize={50}
        searchable
        searchPlaceholder="Guest, phone, confirmation, agent, room…"
        emptyMessage="No stays in this list."
        caption="Reservations"
        toolbar={toolbar}
        globalFilterFn={rowFilter}
        onRowClick={(row) => {
          const step = recommendStayHubStep({
            status: row.status ?? "confirmed",
            board,
            hasRoomAssigned: Boolean(row.roomLabels),
            balanceBtn: 0,
            sdfIncomplete: false,
          });
          if (stayHub) {
            stayHub.openStayHub({
              bookingId: row.id,
              step,
              board,
              seedStay: seedStayFromBoardRow({
                id: row.id,
                contact_name: row.guest,
                contact_phone: row.phone,
                check_in: row.checkIn,
                check_out: row.checkOut,
                status: row.status,
                rooms: row.rooms,
                agent_id: row.agentId,
                agent_name: row.agentName,
                room_labels: row.roomLabels,
                assigned_count: row.assignmentCount,
                folio_id: row.folioId,
              }),
            });
            return;
          }
          window.location.href = `/erp/bookings/${row.id}`;
        }}
      />
    </div>
  );
}
