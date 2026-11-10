"use client";

import { Badge } from "@/components/ui/badge";
import { DataTable, SortableHeader } from "@/components/ui/data-table";
import type { AttendanceKind } from "@/lib/attendance-types";
import type { ColumnDef } from "@tanstack/react-table";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export type DutyBoardRow = {
  id: string;
  employeeCode: string;
  fullName: string;
  department: string | null;
  role: string;
  eventKind: AttendanceKind | null;
  arrivedLabel: string | null;
  leftLabel: string | null;
  shiftLabel: string | null;
};

const STATUS: Record<
  AttendanceKind,
  { label: string; variant: "default" | "secondary" | "outline" }
> = {
  clock_in: { label: "On duty", variant: "default" },
  break_start: { label: "On break", variant: "secondary" },
  break_end: { label: "On duty", variant: "default" },
  clock_out: { label: "Off duty", variant: "outline" },
};

const columns: ColumnDef<DutyBoardRow>[] = [
  {
    accessorKey: "employeeCode",
    header: () => <SortableHeader label="Code" />,
    cell: ({ row }) => (
      <span className="font-mono text-xs">{row.original.employeeCode}</span>
    ),
  },
  {
    accessorKey: "fullName",
    header: () => <SortableHeader label="Staff member" />,
    cell: ({ row }) => (
      <div>
        <p className="font-medium">{row.original.fullName}</p>
        <p className="text-xs text-muted-foreground">
          {row.original.department ?? row.original.role.replaceAll("_", " ")}
        </p>
      </div>
    ),
  },
  {
    id: "dutyStatus",
    accessorFn: (row) => (row.eventKind ? STATUS[row.eventKind].label : "Not started"),
    header: () => <SortableHeader label="Duty status" />,
    cell: ({ row }) => {
      const status = row.original.eventKind
        ? STATUS[row.original.eventKind]
        : { label: "Not started", variant: "outline" as const };
      return <Badge variant={status.variant}>{status.label}</Badge>;
    },
  },
  {
    accessorKey: "arrivedLabel",
    header: () => <SortableHeader label="Arrived" />,
    cell: ({ row }) => (
      <span className="text-xs tabular-nums">
        {row.original.arrivedLabel ?? "—"}
      </span>
    ),
  },
  {
    accessorKey: "leftLabel",
    header: () => <SortableHeader label="Left" />,
    cell: ({ row }) => (
      <span className="text-xs tabular-nums">
        {row.original.leftLabel ?? "—"}
      </span>
    ),
  },
  {
    accessorKey: "shiftLabel",
    header: "Scheduled shift",
    enableSorting: false,
    cell: ({ row }) => (
      <span className="text-xs">{row.original.shiftLabel ?? "No published shift"}</span>
    ),
  },
];

export function LiveDutyBoard({ data }: { data: DutyBoardRow[] }) {
  const router = useRouter();
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    let stream: EventSource | null = null;
    let refreshTimer: ReturnType<typeof setTimeout> | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let stopped = false;

    const connect = () => {
      if (stopped) return;
      stream = new EventSource("/api/erp/hr/attendance/stream");
      stream.addEventListener("ready", () => setConnected(true));
      stream.addEventListener("attendance", () => {
        if (refreshTimer) clearTimeout(refreshTimer);
        refreshTimer = setTimeout(() => router.refresh(), 250);
      });
      stream.addEventListener("reconnect", () => {
        setConnected(true);
        stream?.close();
        stream = null;
        if (!stopped) {
          if (reconnectTimer) clearTimeout(reconnectTimer);
          reconnectTimer = setTimeout(connect, 200);
        }
      });
      stream.onerror = () => {
        setConnected(false);
        stream?.close();
        stream = null;
        if (!stopped) {
          if (reconnectTimer) clearTimeout(reconnectTimer);
          reconnectTimer = setTimeout(connect, 2_500);
        }
      };
    };

    connect();
    return () => {
      stopped = true;
      if (refreshTimer) clearTimeout(refreshTimer);
      if (reconnectTimer) clearTimeout(reconnectTimer);
      stream?.close();
    };
  }, [router]);

  return (
    <DataTable
      columns={columns}
      data={data}
      caption="Live staff duty board"
      searchPlaceholder="Search staff or status…"
      emptyMessage="No active staff."
      pageSize={50}
      toolbar={
        <Badge variant={connected ? "default" : "outline"}>
          {connected ? "Live" : "Reconnecting…"}
        </Badge>
      }
    />
  );
}
