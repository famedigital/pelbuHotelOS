"use client";

import { bulkUpdateHkTasks } from "@/app/actions/erp-hk";
import { createHkAssignment, type OpsState } from "@/app/actions/erp-p9-ops";
import { HkChecklistForm } from "@/components/erp/HkLostFoundForms";
import { HkStaffAssignForm } from "@/components/erp/HkStaffAssignForm";
import { HkStatusForm } from "@/components/erp/P9OpsForms";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";
import { Input } from "@/components/ui/input";
import { usePendingFeedback } from "@/hooks/use-pending-feedback";
import {
  HK_CHIP_ORDER,
  HK_FILTER_LABEL,
  rowMatchesFilter,
  type HkBoardRow,
  type HkFilterKey,
} from "@/lib/hk/board";
import type { ColumnDef, FilterFn } from "@tanstack/react-table";
import { useEffect, useMemo, useRef, useState } from "react";
import { useActionState } from "react";

const initial: OpsState = { ok: false };

const taskSearch: FilterFn<HkBoardRow> = (row, _columnId, filterValue) => {
  const q = String(filterValue ?? "").trim().toLowerCase();
  if (!q) return true;
  const task = row.original;
  return [
    task.roomLabel,
    task.guestName ?? "",
    task.mealPlan ?? "",
    task.staffName ?? "",
    task.notes ?? "",
    task.status,
    ...task.categories.map((category) => HK_FILTER_LABEL[category]),
  ]
    .join(" ")
    .toLowerCase()
    .includes(q);
};

export type { HkBoardRow };

export function HousekeepingBoard({
  rows,
  units,
  staff,
  today,
}: {
  rows: HkBoardRow[];
  units: { id: string; label: string }[];
  staff: { id: string; full_name: string }[];
  today: string;
}) {
  const [filter, setFilter] = useState<HkFilterKey>("open");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [selectionKey, setSelectionKey] = useState(0);
  const [staffChoice, setStaffChoice] = useState("keep");
  const [statusChoice, setStatusChoice] = useState("keep");
  const [bulkNotes, setBulkNotes] = useState("");
  const [state, action, pending] = useActionState(createHkAssignment, initial);
  const [bulkState, bulkAction, bulkPending] = useActionState(
    bulkUpdateHkTasks,
    initial,
  );
  const bulkWasPending = useRef(false);
  usePendingFeedback(pending, "Creating assignment…");
  usePendingFeedback(bulkPending, "Updating tasks…");

  useEffect(() => {
    if (bulkPending) {
      bulkWasPending.current = true;
      return;
    }
    if (!bulkWasPending.current || !bulkState.ok) return;
    bulkWasPending.current = false;
    setSelectionKey((key) => key + 1);
    setStaffChoice("keep");
    setStatusChoice("keep");
    setBulkNotes("");
  }, [bulkPending, bulkState.ok]);

  const filtered = useMemo(
    () => rows.filter((row) => rowMatchesFilter(row, filter)),
    [filter, rows],
  );

  const openCount = useMemo(
    () => rows.filter((row) => rowMatchesFilter(row, "open")).length,
    [rows],
  );
  const canApply =
    selectedIds.length > 0 &&
    (staffChoice !== "keep" ||
      statusChoice !== "keep" ||
      bulkNotes.trim().length > 0);

  const columns = useMemo<ColumnDef<HkBoardRow>[]>(
    () => [
      {
        accessorKey: "roomLabel",
        header: "Room",
        cell: ({ row }) => (
          <div>
            <p className="font-medium">{row.original.roomLabel}</p>
            {row.original.guestName ? (
              <p className="text-xs font-normal text-muted-foreground">
                {row.original.guestName}
                {row.original.mealPlan ? ` · ${row.original.mealPlan}` : ""}
                {row.original.pax != null ? ` · ${row.original.pax}p` : ""}
                {(row.original.openLaundry ?? 0) > 0
                  ? ` · laundry ${row.original.openLaundry}`
                  : ""}
              </p>
            ) : null}
          </div>
        ),
      },
      {
        id: "type",
        header: "Type",
        enableSorting: false,
        cell: ({ row }) =>
          row.original.categories.length ? (
            <div className="flex flex-wrap gap-1">
              {row.original.categories.map((category) => (
                <span
                  key={category}
                  className="inline-flex rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground"
                >
                  {HK_FILTER_LABEL[category]}
                </span>
              ))}
            </div>
          ) : (
            <span className="text-xs text-muted-foreground">—</span>
          ),
      },
      {
        id: "staff",
        header: "Staff",
        enableSorting: false,
        cell: ({ row }) =>
          row.original.isPending ? (
            <PendingAssignForm
              roomUnitId={row.original.roomUnitId}
              staff={staff}
              today={today}
            />
          ) : (
            <HkStaffAssignForm
              assignmentId={row.original.id}
              staffId={row.original.staffId}
              staff={staff}
              status={row.original.status}
            />
          ),
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => <StatusBadge status={row.original.status} />,
      },
      {
        accessorKey: "notes",
        header: "Notes",
        cell: ({ row }) => (
          <span className="text-sm text-muted-foreground">
            {row.original.notes ?? "—"}
          </span>
        ),
      },
      {
        id: "checklist",
        header: "Checklist",
        enableSorting: false,
        cell: ({ row }) =>
          row.original.isPending ? (
            <span className="text-xs text-muted-foreground">Assign first</span>
          ) : (
            <HkChecklistForm
              id={row.original.id}
              cleanOk={row.original.cleanOk}
              linenOk={row.original.linenOk}
              amenitiesOk={row.original.amenitiesOk}
              status={row.original.status}
            />
          ),
      },
      {
        id: "update",
        header: "",
        enableSorting: false,
        cell: ({ row }) =>
          row.original.isPending ? null : (
            <HkStatusForm id={row.original.id} status={row.original.status} />
          ),
      },
    ],
    [staff, today],
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {HK_CHIP_ORDER.map((key) => (
          <Button
            key={key}
            type="button"
            size="sm"
            variant={filter === key ? "secondary" : "outline"}
            onClick={() => setFilter(key)}
          >
            {HK_FILTER_LABEL[key]}
            {key === "open" && openCount > 0 ? ` (${openCount})` : ""}
          </Button>
        ))}
      </div>

      <form
        action={bulkAction}
        className="flex flex-wrap items-center gap-2 rounded-lg border bg-card px-3 py-2"
      >
        <input type="hidden" name="business_date" value={today} />
        {selectedIds.map((id) => (
          <input key={id} type="hidden" name="task_key" value={id} />
        ))}
        <p className="text-sm font-medium">
          {selectedIds.length === 0
            ? "Tick tasks in the table"
            : `${selectedIds.length} selected`}
        </p>
        <select
          name="staff_choice"
          value={staffChoice}
          onChange={(event) => setStaffChoice(event.target.value)}
          className="h-9 min-w-[160px] rounded-md border border-input bg-transparent px-2 text-sm"
          aria-label="Bulk assign attendant"
        >
          <option value="keep">Staff — no change</option>
          <option value="clear">Unassign</option>
          {staff.map((member) => (
            <option key={member.id} value={member.id}>
              {member.full_name}
            </option>
          ))}
        </select>
        <select
          name="status_choice"
          value={statusChoice}
          onChange={(event) => setStatusChoice(event.target.value)}
          className="h-9 min-w-[160px] rounded-md border border-input bg-transparent px-2 text-sm"
          aria-label="Bulk status"
        >
          <option value="keep">Status — no change</option>
          <option value="open">Open</option>
          <option value="in_progress">In progress</option>
          <option value="done">Done — room clean</option>
          <option value="skipped">Skipped</option>
        </select>
        <Input
          name="notes"
          value={bulkNotes}
          onChange={(event) => setBulkNotes(event.target.value)}
          placeholder="Note for selected tasks"
          className="h-9 min-w-[180px] flex-1"
          aria-label="Note for selected tasks"
        />
        <Button type="submit" size="sm" className="h-9" disabled={!canApply || bulkPending}>
          {bulkPending ? "Updating…" : "Update selected"}
        </Button>
        {selectedIds.length > 0 ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-9"
            onClick={() => setSelectionKey((key) => key + 1)}
          >
            Clear
          </Button>
        ) : null}
        {bulkState.error ? (
          <p className="w-full text-xs text-destructive" role="alert">
            {bulkState.error}
          </p>
        ) : null}
        {bulkState.message ? (
          <p className="w-full text-xs text-muted-foreground">{bulkState.message}</p>
        ) : null}
      </form>

      <form action={action} className="flex flex-wrap items-end gap-2 rounded-lg border bg-card px-3 py-2">
        <input type="hidden" name="business_date" value={today} />
        <select
          name="room_unit_id"
          required
          className="h-9 min-w-[120px] flex-1 rounded-md border border-input bg-transparent px-2 text-sm"
          defaultValue=""
        >
          <option value="" disabled>
            Add room…
          </option>
          {units.map((unit) => (
            <option key={unit.id} value={unit.id}>
              {unit.label}
            </option>
          ))}
        </select>
        <select
          name="staff_id"
          className="h-9 min-w-[140px] flex-1 rounded-md border border-input bg-transparent px-2 text-sm"
          defaultValue=""
        >
          <option value="">Unassigned</option>
          {staff.map((member) => (
            <option key={member.id} value={member.id}>
              {member.full_name}
            </option>
          ))}
        </select>
        <Input name="notes" placeholder="Notes" className="h-9 min-w-[160px] flex-[2]" />
        <Button type="submit" size="sm" disabled={pending} className="h-9">
          {pending ? "Adding…" : "Add"}
        </Button>
        {state.error ? (
          <p className="w-full text-xs text-destructive">{state.error}</p>
        ) : null}
        {state.message ? (
          <p className="w-full text-xs text-muted-foreground">{state.message}</p>
        ) : null}
      </form>

      <DataTable
        columns={columns}
        data={filtered}
        caption="Housekeeping tasks"
        searchPlaceholder="Search room, staff, notes…"
        emptyMessage={
          filter === "open"
            ? "No open housekeeping work right now."
            : "No assignments match this filter."
        }
        pageSize={100}
        globalFilterFn={taskSearch}
        enableRowSelection
        getRowId={(row) => row.id}
        selectionResetKey={selectionKey}
        onSelectedRowsChange={(picked) => setSelectedIds(picked.map((row) => row.id))}
      />
    </div>
  );
}

function PendingAssignForm({
  roomUnitId,
  staff,
  today,
}: {
  roomUnitId: string;
  staff: { id: string; full_name: string }[];
  today: string;
}) {
  const [state, action, pending] = useActionState(createHkAssignment, initial);
  usePendingFeedback(pending, "Creating assignment…");

  return (
    <form action={action} className="flex flex-wrap items-center gap-1">
      <input type="hidden" name="business_date" value={today} />
      <input type="hidden" name="room_unit_id" value={roomUnitId} />
      <select
        name="staff_id"
        className="h-8 min-w-[120px] rounded-md border border-input bg-transparent px-2 text-xs"
        defaultValue=""
      >
        <option value="">Unassigned</option>
        {staff.map((member) => (
          <option key={member.id} value={member.id}>
            {member.full_name}
          </option>
        ))}
      </select>
      <Button type="submit" size="sm" variant="outline" className="h-8 px-2" disabled={pending}>
        {pending ? "…" : "Assign"}
      </Button>
      {state.error ? (
        <p className="w-full text-[10px] text-destructive">{state.error}</p>
      ) : null}
    </form>
  );
}

function StatusBadge({ status }: { status: string }) {
  const tone =
    status === "done"
      ? "border-citrus/40 bg-citrus-tint/60 text-citrus"
      : status === "open" ||
          status === "in_progress" ||
          status === "needs_assignment"
        ? "border-destructive/30 bg-destructive/5 text-destructive"
        : "border-border bg-muted text-muted-foreground";
  const label =
    status === "needs_assignment"
      ? "needs assign"
      : status.replace("_", " ");
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide whitespace-nowrap ${tone}`}
    >
      {label}
    </span>
  );
}
