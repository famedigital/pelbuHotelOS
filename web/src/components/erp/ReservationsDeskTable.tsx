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
  guide: string | null;
  meal: string | null;
  quotedTotal: number | null;
  hasInvoice: boolean;
};

export type ReservationDoor = {
  id: string;
  label: string;
  roomTypeId: string;
};

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
      ? "border-mint-500/30 bg-mint-100 text-mint-600"
      : value === "confirmed"
        ? "border-sky-300 bg-sky-100 text-sky-700"
        : value === "held" || value === "pending"
          ? "border-citrus/40 bg-citrus-tint text-citrus-600"
          : "border-border bg-muted text-muted-foreground";
  return (
    <span
      className={cn(
        "inline-flex rounded-md border px-1.5 py-0.5 text-[11px] font-medium whitespace-nowrap",
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
  return [r.guest, r.phone, r.confirmationCode, r.agentName, r.roomLabels, r.status, r.guide, r.meal]
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
      id: "guide",
      accessorFn: (row) => row.guide ?? "",
      header: "Guide",
      cell: ({ row }) => row.original.guide || "—",
    },
    {
      id: "meal",
      accessorFn: (row) => row.meal ?? "",
      header: "Meal",
      cell: ({ row }) => row.original.meal || "—",
    },
    {
      id: "rate",
      accessorFn: (row) => row.quotedTotal ?? 0,
      header: "Amount",
      cell: ({ row }) =>
        row.original.quotedTotal != null && row.original.quotedTotal > 0
          ? row.original.quotedTotal.toLocaleString("en-IN")
          : "—",
    },
    {
      id: "invoice",
      accessorFn: (row) => (row.hasInvoice ? "yes" : ""),
      header: "Invoice",
      cell: ({ row }) => (row.original.hasInvoice ? "Issued" : "—"),
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
    <div className="min-h-0">
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
